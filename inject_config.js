(function() {
  // 1. Get args from dataset (injected by popup.js)
  const script = document.currentScript || document.querySelector('script[data-bili-config]');
  if (!script) return;
  
  const ffmpegUrl = script.dataset.ffmpeg;
  const coreUrl = script.dataset.core;
  const coreStUrl = script.dataset.coreSt;
  const lang = script.dataset.lang;
  const preferHDR = script.dataset.hdr === 'true';

  // 2. Set globals
  window.__FFMPEG_URL__ = ffmpegUrl;
  window.__FFMPEG_CORE_URL__ = coreUrl;
  window.__FFMPEG_CORE_ST_URL__ = coreStUrl;
  window.__BILI_LANG__ = lang;
  window.__BILI_DOWN_PREF__ = { preferHDR };
})();