window.addEventListener("BILI_DOWN_STATUS", (e) => {
  if (e.detail) {
    try {
      chrome.storage.local.set({ vd_status: { ...e.detail, ts: Date.now() } });
    } catch (_) {}
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.action === "DOWNLOAD_FAILED") {
    window.dispatchEvent(new CustomEvent("BILI_DOWNLOAD_ERROR", { detail: { message: msg.message || "下载失败" } }));
  }
});

// Listen for download requests from the main world script
window.addEventListener("BILI_TRIGGER_DOWNLOAD", (e) => {
    if (e.detail && e.detail.filename && (e.detail.url || (e.detail.urls && e.detail.urls.length))) {
        try {
            chrome.runtime.sendMessage({
                action: 'DOWNLOAD',
                url: e.detail.url,
                urls: e.detail.urls,
                filename: e.detail.filename
            }, (resp) => {
                if (chrome.runtime.lastError) {
                    window.dispatchEvent(new CustomEvent("BILI_DOWNLOAD_ERROR", { detail: { message: chrome.runtime.lastError.message } }));
                    return;
                }
                if (resp && resp.error) {
                    window.dispatchEvent(new CustomEvent("BILI_DOWNLOAD_ERROR", { detail: { message: resp.error } }));
                }
            });
        } catch (err) {
            console.error("[Bridge] Failed to send download message", err);
        }
    }
});
