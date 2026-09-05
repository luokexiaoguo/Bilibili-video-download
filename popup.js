const I18N = {
  zh: {
    popupTitle: "B站离线舱-番剧电影下载器",
    tipsTitle: "💡 使用小贴士",
    tipMerge: "<b>自动合并</b>：首选方案，适合大多数视频，自动合成 MP4。",
    tipSplit: "<b>自动分流</b>：当合并失败时，插件会自动尝试分别下载音视频（由浏览器接管）。",
    tipStream: "针对超大文件，插件会自动弹出两次保存窗口（视频/音频），建议都保存到浏览器默认下载文件夹，方便统一管理。请点击保存并保持当前页面开启，直至下载完成。",
    tipQuality: "插件会自动选择当前视频可用的最高画质（如 4K/1080P+），请确保大会员账号已登录。如果您选择了 HDR 但当前视频（或您的账号）不支持，插件会自动降级为您下载最高画质的 SDR 版本。",
    lblSdr: "SDR (H.265)",
    descSdr: "兼容性好 推荐",
    lblHdr: "HDR / 杜比",
    descHdr: "色彩生动 专用",
    btnDownload: "一键下载（最高支持8K）",
    btnBatch: "批量下载合集",
    batchUnsupported: "当前页面不是合集/多P,无法批量下载",
    footerEmail: "反馈邮箱：",
    footerFeedback: "插件制作不易，如果它确实帮到了你，希望能支持一下，让我有动力持续更新！",
    linkSupport: "支持",
    msgPageError: "请在 B 站视频或番剧播放页使用",
    msgStart: "已启动下载... (请留意网页右下角浮窗)",
    msgError: "启动失败: "
  },
  en: {
    popupTitle: "BiliDown",
    tipsTitle: "💡 Tips",
    tipMerge: "<b>Auto Merge</b>: Best choice. Merges audio & video into MP4 automatically.",
    tipSplit: "<b>Auto Split</b>: If merge fails, tries to download audio/video separately.",
    tipStream: "For extra-large files, two save dialogs will appear (video/audio). Tip: save both to your browser's default download folder for easy management. Click save and keep the page open until download completes.",
    tipQuality: "Automatically selects the highest quality available for the video (e.g., 4K/1080P+). Please ensure your Premium account is logged in. If HDR is selected but unavailable, it will automatically fallback to the best SDR quality.",
    lblSdr: "SDR (H.265)",
    descSdr: "Compatible (Rec.)",
    lblHdr: "HDR / Dolby",
    descHdr: "Vivid Colors",
    btnDownload: "One-Click Download (Max 8K)",
    btnBatch: "Batch Download Collection",
    batchUnsupported: "Current page is not a collection/multi-part, cannot batch download",
    footerFeedback: "This extension is hard to make. If it has truly helped you, I hope you can support me — it gives me the motivation to keep updating!",
    footerEmail: "Feedback: ",
    linkSupport: "Support",
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
    if (!tab || !tab.url || !/bilibili\.com\/(video|bangumi\/play|cheese\/play)\//i.test(tab.url)) {
      msg.textContent = t.msgPageError;
      return;
    }

    // Get quality preference FIRST
    const quality = document.querySelector('input[name="video_quality"]:checked').value;
    const preferHDR = quality === 'hdr';

    // Get FFmpeg URLs
    const ffmpegUrl = chrome.runtime.getURL("ffmpeg/ffmpeg.min.js");
    const coreUrl = chrome.runtime.getURL("ffmpeg/ffmpeg-core.js");
    const coreStUrl = chrome.runtime.getURL("ffmpeg/ffmpeg-core-st.js");

    console.log('[Popup] Starting injection, preferHDR:', preferHDR);

    // 1. Inject bridge (ISOLATED world)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content_bridge.js"],
      world: "ISOLATED"
    });
    console.log('[Popup] Bridge injected');

    // 2. Set config globals via executeScript func (this is the reliable way)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (ffmpeg, core, coreSt, lang, hdr) => {
        window.__FFMPEG_URL__ = ffmpeg;
        window.__FFMPEG_CORE_URL__ = core;
        window.__FFMPEG_CORE_ST_URL__ = coreSt;
        window.__BILI_LANG__ = lang;
        window.__BILI_DOWN_PREF__ = { preferHDR: hdr };
        console.log('[Popup->Content] Config set: preferHDR =', hdr, '| lang =', lang);
      },
      args: [ffmpegUrl, coreUrl, coreStUrl, currentLang, preferHDR],
      world: "MAIN"
    });
    console.log('[Popup] Config injected');

    // 3. Inject ffmpeg.min.js (MAIN world)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["ffmpeg/ffmpeg.min.js"],
      world: "MAIN"
    });
    console.log('[Popup] FFmpeg injected');

    // 4. Inject content_merge.js (MAIN world) - the overlay and main logic
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content_merge.js"],
      world: "MAIN"
    });
    console.log('[Popup] content_merge.js injected - should show overlay now');

    // Clear old status
    await chrome.storage.local.remove("vd_status");

    msg.textContent = t.msgStart;
  } catch (e) {
    console.error('[Popup] Error:', e);
    msg.textContent = t.msgError + (e && e.message ? e.message : "Unknown Error");
  }
});

// 批量下载:复用单次下载的注入流程,只是多注入一个 __BILI_BATCH__ 标志,
// content_merge.js 检测到该标志后进入批量流程(目录选择器 + 串行下载多集)。
document.getElementById("batch").addEventListener("click", async () => {
  const msg = document.getElementById("msg");
  const t = I18N[currentLang];
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !/bilibili\.com\/(video|bangumi\/play|cheese\/play)\//i.test(tab.url)) {
      msg.textContent = t.msgPageError;
      return;
    }

    const quality = document.querySelector('input[name="video_quality"]:checked').value;
    const preferHDR = quality === 'hdr';

    const ffmpegUrl = chrome.runtime.getURL("ffmpeg/ffmpeg.min.js");
    const coreUrl = chrome.runtime.getURL("ffmpeg/ffmpeg-core.js");
    const coreStUrl = chrome.runtime.getURL("ffmpeg/ffmpeg-core-st.js");

    console.log('[Popup] Starting BATCH injection, preferHDR:', preferHDR);

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content_bridge.js"],
      world: "ISOLATED"
    });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (ffmpeg, core, coreSt, lang, hdr) => {
        window.__FFMPEG_URL__ = ffmpeg;
        window.__FFMPEG_CORE_URL__ = core;
        window.__FFMPEG_CORE_ST_URL__ = coreSt;
        window.__BILI_LANG__ = lang;
        window.__BILI_DOWN_PREF__ = { preferHDR: hdr };
        // 批量下载标志:content_merge.js 据此走批量流程而非单次流程
        window.__BILI_BATCH__ = true;
        console.log('[Popup->Content] BATCH mode set');
      },
      args: [ffmpegUrl, coreUrl, coreStUrl, currentLang, preferHDR],
      world: "MAIN"
    });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["ffmpeg/ffmpeg.min.js"],
      world: "MAIN"
    });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content_merge.js"],
      world: "MAIN"
    });

    await chrome.storage.local.remove("vd_status");
    msg.textContent = t.msgStart;
  } catch (e) {
    console.error('[Popup] Batch error:', e);
    msg.textContent = t.msgError + (e && e.message ? e.message : "Unknown Error");
  }
});
