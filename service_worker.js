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
          resourceTypes: ['xmlhttprequest', 'other']
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
