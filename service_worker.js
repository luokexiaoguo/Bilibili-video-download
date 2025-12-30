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
          resourceTypes: ['xmlhttprequest', 'media', 'other']
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
    if (!meta) return;
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
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // You can add tab-specific logic here
  }
});
