/* global chrome */

const log = (...args) => {
  console.log('[Service Worker]', ...args);
};

const STORAGE_KEYS = {
  PROXY_ENABLED: 'proxy_enabled',
  PROXY_PORT: 'proxy_port',
  PROXY_HOST: 'proxy_host',
};

const desiredFilenameByUrl = new Map();
const downloadMetaById = new Map();
const pendingDownloadIdsBySender = new Map();
const DYNAMIC_RULE_ID = 20001;

const ensureDownloadHeaders = async (refererUrl) => {
  const referer = typeof refererUrl === 'string' && refererUrl.startsWith('http')
    ? refererUrl
    : 'https://www.bilibili.com/';
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [DYNAMIC_RULE_ID],
      addRules: [{
        id: DYNAMIC_RULE_ID,
        priority: 2,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'referer', operation: 'set', value: referer },
            { header: 'origin', operation: 'remove' }
          ]
        },
        condition: {
          regexFilter: 'https:\\/\\/(?:[^\\/]*\\.)?(bilivideo\\.com|bilivideo\\.cn|hdslb\\.com)\\/',
          initiatorDomains: ['www.bilibili.com']
        }
      }]
    });
  } catch (e) {
    log('Failed to update dynamic rules:', e && e.message ? e.message : e);
  }
};

// Chrome Extension Service Worker
// Initialize
chrome.runtime.onInstalled.addListener((details) => {
  log('Extension installed/updated:', details.reason);
  // Set default storage values
  chrome.storage.local.set({
    [STORAGE_KEYS.PROXY_ENABLED]: false,
    [STORAGE_KEYS.PROXY_PORT]: '7890',
    [STORAGE_KEYS.PROXY_HOST]: '127.0.0.1',
  });
});

// Background Tasks
chrome.runtime.onStartup.addListener(() => {
  log('Extension started');
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'GET_STORAGE') {
    chrome.storage.local.get(msg.keys, (data) => {
      sendResponse(data);
    });
    return true;
  }

  if (msg.action === 'SET_STORAGE') {
    chrome.storage.local.set(msg.data, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // ------------------------------------------------------------
  // Page button → run the same injection the popup does.
  // Lives here so the content script doesn't need `scripting` on its own
  // and so the panel's click stays the last real user gesture.
  // ------------------------------------------------------------
  if (msg.action === 'PAGE_START_DOWNLOAD') {
    const tabId = sender && sender.tab && sender.tab.id;
    if (tabId == null) { sendResponse({ ok: false, error: 'no tab' }); return false; }
    (async () => {
      try {
        const preferHDR = msg.preferHDR === true;
        const batch = msg.batch === true;
        // Must follow the language the user picked in the popup — not the
        // browser locale. chrome.storage.local is the shared source of truth
        // (see popup.js updateLang); the content script writes it there.
        let lang = (navigator.language || '').startsWith('zh') ? 'zh' : 'en';
        try {
          const stored = await chrome.storage.local.get('bili_lang');
          if (stored && (stored.bili_lang === 'zh' || stored.bili_lang === 'en')) {
            lang = stored.bili_lang;
          }
        } catch (_) {}
        const ffmpegUrl = chrome.runtime.getURL('ffmpeg/ffmpeg.min.js');
        const coreUrl = chrome.runtime.getURL('ffmpeg/ffmpeg-core.js');
        const coreStUrl = chrome.runtime.getURL('ffmpeg/ffmpeg-core-st.js');

        // Tear down any previous run first — its guard flag would otherwise
        // make the newly injected script return immediately.
        await chrome.scripting.executeScript({
          target: { tabId },
          world: 'MAIN',
          func: () => {
            try { window.__BILI_DRIVER_TEARDOWN__ && window.__BILI_DRIVER_TEARDOWN__(); } catch (_) {}
            window.__BILI_DRIVER_ACTIVE__ = false;
            window.__BILI_BATCH__ = false;
          },
        });

        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content_bridge.js'],
          world: 'ISOLATED',
        });

        await chrome.scripting.executeScript({
          target: { tabId },
          world: 'MAIN',
          func: (ffmpeg, core, coreSt, lg, hdr, isBatch) => {
            window.__FFMPEG_URL__ = ffmpeg;
            window.__FFMPEG_CORE_URL__ = core;
            window.__FFMPEG_CORE_ST_URL__ = coreSt;
            window.__BILI_LANG__ = lg;
            window.__BILI_DOWN_PREF__ = { preferHDR: hdr };
            window.__BILI_BATCH__ = isBatch;
          },
          args: [ffmpegUrl, coreUrl, coreStUrl, lang, preferHDR, batch],
        });

        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['ffmpeg/ffmpeg.min.js'],
          world: 'MAIN',
        });

        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content_merge.js'],
          world: 'MAIN',
        });

        await chrome.storage.local.remove('vd_status');
        sendResponse({ ok: true });
      } catch (e) {
        log('[ServiceWorker] PAGE_START_DOWNLOAD failed:', e && e.message);
        sendResponse({ ok: false, error: (e && e.message) || String(e) });
      }
    })();
    return true; // async response
  }

  // Page button asks whether a download is already running.
  // page_button.js lives in the ISOLATED world while content_merge.js runs
  // in MAIN — `window` is not shared, so the flag must be read from MAIN
  // here and relayed back.
  if (msg.action === 'PAGE_IS_BUSY') {
    const tabId = sender && sender.tab && sender.tab.id;
    if (tabId == null) { sendResponse({ busy: false }); return false; }
    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => ({
        busy: window.__BILI_DRIVER_BUSY__ === true,
        // A download that crashed before teardown would leave BUSY stuck;
        // the overlay element is the liveness signal.
        alive: !!document.getElementById('bili-download-overlay'),
      }),
    }).then((r) => sendResponse((r && r[0] && r[0].result) || { busy: false, alive: false }))
      .catch(() => sendResponse({ busy: false }));
    return true;
  }

  // Page button asks whether this page has a collection / multi-P,
  // so the panel can disable the batch option instead of letting the
  // user click into an error. Must run in MAIN world (page globals).
  if (msg.action === 'PAGE_PROBE_COLLECTION') {
    const tabId = sender && sender.tab && sender.tab.id;
    if (tabId == null) { sendResponse({ available: false }); return false; }
    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        try {
          const st = window.__INITIAL_STATE__ || {};
          const vd = st.videoData || {};
          if (vd.pages?.length > 1) return { available: true, count: vd.pages.length };
          if (st.epList?.length > 1) return { available: true, count: st.epList.length };
          if (st.mediaInfo?.episodes?.length > 1) return { available: true, count: st.mediaInfo.episodes.length };
          const ugc = vd.ugc_season;
          if (ugc) {
            const eps = ugc.sections?.length
              ? ugc.sections.reduce((n, s) => n + (s.episodes?.length || 0), 0)
              : (ugc.episodes?.length || 0);
            if (eps > 1) return { available: true, count: eps };
          }
          if (vd.series?.list?.length > 1) return { available: true, count: vd.series.list.length };
          return { available: false, count: 0 };
        } catch (_) { return { available: false, count: 0 }; }
      },
    }).then((r) => sendResponse(r?.[0]?.result || { available: false, count: 0 }))
      .catch(() => sendResponse({ available: false, count: 0 }));
    return true;
  }

  if (msg.action === 'GET_VERSION') {
    const manifest = chrome.runtime.getManifest();
    sendResponse({ version: manifest.version });
    return false;
  }

  if (msg.action === 'IS_EXTENSION_ENABLED') {
    sendResponse({ enabled: true });
    return false;
  }

  // Serve FFmpeg files to content script
  if (msg.action === 'GET_FFMPEG') {
    const files = msg.files || [
      'ffmpeg/ffmpeg.min.js',
      'ffmpeg/ffmpeg-core.js',
      'ffmpeg/ffmpeg-core.wasm',
      'ffmpeg/ffmpeg-core-st.js',
      'ffmpeg/ffmpeg-core-st.wasm'
    ];
    log('[ServiceWorker] GET_FFMPEG requested:', files);

    // Content script loads files via chrome-extension:// URLs directly (web_accessible_resources)
    // Just verify files exist and return their paths/sizes
    const checkFile = async (path) => {
      const url = chrome.runtime.getURL(path);
      const res = await fetch(url, { method: 'HEAD' });
      if (!res.ok) throw new Error(`FFmpeg file not found: ${path} (${res.status})`);
      return { path, size: Number(res.headers.get('content-length')) || 0 };
    };

    Promise.all(files.map(checkFile))
      .then(results => {
        log('[ServiceWorker] All FFmpeg files verified');
        sendResponse({ success: true, files: results });
      })
      .catch(err => {
        log('[ServiceWorker] FFmpeg check error:', err);
        sendResponse({ success: false, error: err.message });
      });

    return true; // async response
  }

  // Fetch video/audio streams from CDN (bypasses content script CORS)
  if (msg.action === 'FETCH_STREAMS') {
    const { videoUrl, audioUrl } = msg;
    console.log('[SW] FETCH_STREAMS:', { videoUrl: videoUrl?.substring(0, 80), audioUrl: audioUrl?.substring(0, 80) });
    (async () => {
      try {
        const headers = { 'Referer': 'https://www.bilibili.com/' };
        const [vRes, aRes] = await Promise.all([
          fetch(videoUrl, { headers, credentials: 'include' }),
          fetch(audioUrl, { headers, credentials: 'include' })
        ]);
        console.log('[SW] Fetch results:', { video: vRes.status, audio: aRes.status });
        if (!vRes.ok || !aRes.ok) {
          sendResponse({ success: false, error: `HTTP ${vRes.status}/${aRes.status}` });
          return;
        }
        const [vBuf, aBuf] = await Promise.all([vRes.arrayBuffer(), aRes.arrayBuffer()]);
        console.log('[SW] Stream sizes:', { video: vBuf.byteLength, audio: aBuf.byteLength });
        sendResponse({ success: true, video: vBuf, audio: aBuf });
      } catch (e) {
        console.log('[SW] FETCH_STREAMS error:', e.message);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  // Example: open a new tab
  if (msg.action === 'OPEN_TAB') {
    chrome.tabs.create({ url: msg.url, active: msg.active !== false }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (msg.action === 'DOWNLOAD') {
    const urls = Array.isArray(msg.urls) && msg.urls.length ? msg.urls : (msg.url ? [msg.url] : []);
    const filename = msg.filename;
    const senderKey = sender && sender.tab && sender.tab.id != null ? String(sender.tab.id) : 'unknown';
    const startOne = (url) => new Promise((resolve) => {
      if (url && filename) desiredFilenameByUrl.set(url, filename);
      chrome.downloads.download({
        url,
        filename,
        saveAs: false,
        conflictAction: 'uniquify'
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          log('Download failed:', chrome.runtime.lastError);
          desiredFilenameByUrl.delete(url);
          resolve({ error: chrome.runtime.lastError.message });
        } else {
          log('Download started, ID:', downloadId);
          if (downloadId != null) {
            downloadMetaById.set(downloadId, { tabId: sender && sender.tab ? sender.tab.id : null, filename, url });
            pendingDownloadIdsBySender.set(senderKey, downloadId);
            if (filename) {
              // Note: renaming might fail if file already exists or permissions issue, but we try anyway
              // In some contexts, filename is set via onDeterminingFilename, so this rename might be redundant or fail safely.
              chrome.downloads.search({ id: downloadId }, (items) => {
                 if (items && items[0] && items[0].state === 'in_progress') {
                     // Only rename if it's still in progress and we haven't set it via onDeterminingFilename yet?
                     // Actually, chrome.downloads.download 'filename' param usually handles this.
                     // But if that failed, we try here.
                 }
              });
            }
          }
          resolve({ success: true, downloadId });
        }
      });
    });

    (async () => {
      await ensureDownloadHeaders(sender && sender.tab ? sender.tab.url : null);
      for (const url of urls) {
        const res = await startOne(url);
        if (res && res.success) {
          setTimeout(async () => {
            try {
              const id = pendingDownloadIdsBySender.get(senderKey);
              if (!id) return;
              const items = await chrome.downloads.search({ id });
              const item = items && items[0];
              if (item && item.state === 'interrupted') {
                const meta = downloadMetaById.get(id);
                pendingDownloadIdsBySender.delete(senderKey);
                downloadMetaById.delete(id);
                const msgText = item.error ? `下载失败(${item.error})` : '下载失败';
                if (meta && meta.tabId != null) {
                  chrome.tabs.sendMessage(meta.tabId, { action: 'DOWNLOAD_FAILED', message: msgText });
                }
              }
            } catch (_) {}
          }, 1500);
          sendResponse(res);
          return;
        }
      }
      sendResponse({ error: '下载失败' });
    })();

    return true;
  }

  log('Unknown message:', msg);
  sendResponse({ error: 'Unknown action' });
  return true;
});

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  const desired =
    (item.finalUrl && desiredFilenameByUrl.get(item.finalUrl)) ||
    desiredFilenameByUrl.get(item.url);
  if (desired) {
    desiredFilenameByUrl.delete(item.finalUrl || item.url);
    suggest({ filename: desired, conflictAction: 'uniquify' });
    return;
  }
  suggest();
});

chrome.downloads.onChanged.addListener(async (delta) => {
  if (!delta || delta.id == null) return;
  if (delta.state && (delta.state.current === 'interrupted' || delta.state.current === 'complete')) {
    const meta = downloadMetaById.get(delta.id);
    if (meta) {
      downloadMetaById.delete(delta.id);
      const items = await chrome.downloads.search({ id: delta.id });
      const item = items && items[0];
      if (delta.state.current === 'interrupted') {
        const msgText = item && item.error ? `下载失败(${item.error})` : '下载失败';
        if (meta.tabId != null) {
          chrome.tabs.sendMessage(meta.tabId, { action: 'DOWNLOAD_FAILED', message: msgText });
        }
      }
    }
    // Clean up dynamic DNR rule after downloads finish — prevents interference with live streaming
    if (!downloadMetaById.size) {
      setTimeout(async () => {
        try {
          await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [DYNAMIC_RULE_ID] });
          log('Dynamic DNR rule cleaned up');
        } catch (_) {}
      }, 3000);
    }
  }
});
