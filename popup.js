document.getElementById("send").addEventListener("click", async () => {
  const msg = document.getElementById("msg");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !/bilibili\.com\/(video|bangumi\/play)\//i.test(tab.url)) {
      msg.textContent = "请在 B 站视频或番剧播放页使用";
      return;
    }
    // Inject bridge script (ISOLATED) to handle storage/runtime
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content_bridge.js"],
      world: "ISOLATED"
    });
    // Inject variables and libraries (MAIN)
    const ffmpegUrl = chrome.runtime.getURL("ffmpeg/ffmpeg.min.js");
    const coreUrl = chrome.runtime.getURL("ffmpeg/ffmpeg-core.js");
    const coreStUrl = chrome.runtime.getURL("ffmpeg/ffmpeg-core-st.js");
    
    // Inject ffmpeg.min.js directly to define window.FFmpeg
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["ffmpeg/ffmpeg.min.js"],
      world: "MAIN"
    });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (u1, u2, u3) => {
        window.__FFMPEG_URL__ = u1;
        window.__FFMPEG_CORE_URL__ = u2;
        window.__FFMPEG_CORE_ST_URL__ = u3;
      },
      args: [ffmpegUrl, coreUrl, coreStUrl],
      world: "MAIN"
    });
    // Inject main logic (MAIN)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content_merge.js"],
      world: "MAIN"
    });
    
    // Clear old status explicitly on new start
    await chrome.storage.local.remove("vd_status");
    // Also reset UI immediately
    // statusEl.innerHTML = '<span style="color:#999">正在启动...</span>';

    // 不再自动关闭 popup，让用户看到启动状态
    msg.textContent = "已启动下载... (请留意网页右下角浮窗)";
  } catch (e) {
    msg.textContent = "启动失败: " + (e && e.message ? e.message : "未知错误");
  }
});

// 轮询展示下载状态 (REMOVED: User requested to remove status display in popup)
// const statusEl = document.getElementById("status");
// let lastTs = 0;
// let timer = setInterval(async () => { ... });
