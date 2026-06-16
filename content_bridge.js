window.addEventListener("BILI_DOWN_STATUS", (e) => {
  // This listener might be redundant if the event is dispatched in MAIN world but this script is ISOLATED world.
  // Events dispatched on window in MAIN world are NOT visible in ISOLATED world directly on 'window' object usually?
  // Actually, CustomEvents on window ARE shared across worlds if detail is serializable.
  // But let's support the new explicit event name just in case.
  if (e.detail) {
    try {
        // Merge with existing status to preserve fields not in this update
        chrome.storage.local.get("vd_status", (items) => {
            const old = items.vd_status || {};
            const nu = { ...old, ...e.detail, ts: Date.now() };
            chrome.storage.local.set({ vd_status: nu });
        });
    } catch (_) {}
  }
});

window.addEventListener("BILI_BRIDGE_STATUS_UPDATE", (e) => {
    if (e.detail) {
        try {
            chrome.storage.local.get("vd_status", (items) => {
                const old = items.vd_status || {};
                const nu = { ...old, ...e.detail, ts: Date.now() };
                chrome.storage.local.set({ vd_status: nu });
            });
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

// Handle FFmpeg file requests from MAIN world (chrome.runtime not available there)
window.addEventListener("BILI_TRIGGER_FFMPEG", (e) => {
    const requestId = e.detail?.requestId;
    try {
        chrome.runtime.sendMessage({ action: 'GET_FFMPEG' }, (resp) => {
            if (chrome.runtime.lastError) {
                window.dispatchEvent(new CustomEvent("BILI_FFMPEG_RESPONSE", { detail: { requestId, success: false, error: chrome.runtime.lastError.message } }));
                return;
            }
            window.dispatchEvent(new CustomEvent("BILI_FFMPEG_RESPONSE", { detail: { requestId, success: resp?.success, files: resp?.files, error: resp?.error, extId: chrome.runtime.id } }));
        });
    } catch (err) {
        console.error("[Bridge] FFmpeg request failed", err);
        window.dispatchEvent(new CustomEvent("BILI_FFMPEG_RESPONSE", { detail: { requestId, success: false, error: err.message } }));
    }
});
