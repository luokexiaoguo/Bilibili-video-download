const I18N = {
  zh: {
    popupTitle: "B站离线舱-番剧电影下载器",
    tipsTitle: "💡 使用小贴士",
    tipMerge: "<b>自动合并</b>：首选方案，适合大多数视频，自动合成 MP4。",
    tipSplit: "<b>自动分流</b>：当合并失败时，插件会自动尝试分别下载音视频（由浏览器接管）。",
    tipStream: "针对超大文件（>1.8GB），插件会自动弹出两次保存窗口（视频/音频），请点击保存并保持当前页面开启，直至下载完成。",
    tipQuality: "插件会自动选择当前视频可用的最高画质（如 4K/1080P+），请确保大会员账号已登录。",
    btnDownload: "一键下载（最高支持8K）",
    footerEmail: "反馈邮箱：",
    footerSupport: "感觉不错可以支持个鸡腿：",
    linkSupport: "支持",
    msgPageError: "请在 B 站视频或番剧播放页使用",
    msgStart: "已启动下载... (请留意网页右下角浮窗)",
    msgError: "启动失败: "
  },
  en: {
    popupTitle: "BiliDown - HD Video Downloader",
    tipsTitle: "💡 Tips",
    tipMerge: "<b>Auto Merge</b>: Best choice. Merges audio & video into MP4 automatically.",
    tipSplit: "<b>Auto Split</b>: If merge fails, tries to download audio/video separately.",
    tipStream: "For large files (>1.8GB), two save dialogs will appear (video/audio). Click save and keep the page open until download completes.",
    tipQuality: "Automatically selects the highest quality available for the video (e.g., 4K/1080P+). Please ensure your Premium account is logged in.",
    btnDownload: "One-Click Download (Max 8K)",
    footerEmail: "Feedback: ",
    footerSupport: "Support me: ",
    linkSupport: "Donate",
    msgPageError: "Please use on Bilibili video/anime page",
    msgStart: "Started... (Check bottom-right overlay)",
    msgError: "Failed: "
  }
};

let currentLang = localStorage.getItem("bili_lang") || (navigator.language.startsWith("zh") ? "zh" : "en");

function updateLang(lang) {
  currentLang = lang;
  localStorage.setItem("bili_lang", lang);
  const t = I18N[lang];
  
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (t[key]) el.innerHTML = t[key];
  });
  
  const btn = document.getElementById("langToggle");
  btn.textContent = lang === "zh" ? "EN" : "中";
}

document.getElementById("langToggle").addEventListener("click", () => {
  updateLang(currentLang === "zh" ? "en" : "zh");
});

// Initialize language
updateLang(currentLang);

document.getElementById("send").addEventListener("click", async () => {
  const msg = document.getElementById("msg");
  const t = I18N[currentLang];
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !/bilibili\.com\/(video|bangumi\/play)\//i.test(tab.url)) {
      msg.textContent = t.msgPageError;
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
      func: (u1, u2, u3, lang) => {
        window.__FFMPEG_URL__ = u1;
        window.__FFMPEG_CORE_URL__ = u2;
        window.__FFMPEG_CORE_ST_URL__ = u3;
        window.__BILI_LANG__ = lang; // Pass language to content script
      },
      args: [ffmpegUrl, coreUrl, coreStUrl, currentLang],
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
    msg.textContent = t.msgStart;
  } catch (e) {
    msg.textContent = t.msgError + (e && e.message ? e.message : "Unknown Error");
  }
});

// 轮询展示下载状态 (REMOVED: User requested to remove status display in popup)
// const statusEl = document.getElementById("status");
// let lastTs = 0;
// let timer = setInterval(async () => { ... });
