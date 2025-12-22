window.addEventListener("BILI_DOWN_STATUS", (e) => {
  if (e.detail) {
    try {
      chrome.storage.local.set({ vd_status: { ...e.detail, ts: Date.now() } });
    } catch (_) {}
  }
});
