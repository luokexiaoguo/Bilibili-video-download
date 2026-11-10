/* global chrome */
// ============================================================
// BiliDown page button (ISOLATED world content script)
//
// Adds a text button to the Bilibili player control bar so users don't
// have to discover the toolbar icon. Clicking it opens a small panel
// (quality + single/batch) and only the panel's own button starts the
// download — that keeps a fresh transient user activation alive for the
// save-file picker inside content_merge.js.
//
// This file never touches page state, never injects into MAIN world and
// never calls download code itself; it only asks the service worker to
// run the same injection the popup does.
// ============================================================
(() => {
  if (window.__BILIDOWN_PAGE_BUTTON__) return;
  window.__BILIDOWN_PAGE_BUTTON__ = true;

  const ID_BTN = 'bilidown-page-btn';
  const ID_PANEL = 'bilidown-page-panel';
  const ID_STYLE = 'bilidown-page-style';

  // ------------------------------------------------------------
  // Language
  // Resolution order: chrome.storage.local (the popup's toggle writes
  // here) → browser language. popup.js keeps its own localStorage too,
  // but content scripts can't read the extension page's localStorage,
  // which is why the storage key is the source of truth.
  // ------------------------------------------------------------
  const STRINGS = {
    zh: {
      btn: '下载',
      title: '下载视频',
      quality: '画质',
      hdr: 'HDR / 杜比',
      hdrHint: '色彩更生动',
      sdr: 'SDR (H.265)',
      sdrHint: '兼容性最好',
      single: '下载本集',
      batch: '下载整个合集',
      batchHint: '选择要下载的分集',
      batchNA: '当前不是合集',
      close: '关闭',
      starting: '正在启动…',
      err: '启动失败',
      notReady: '播放器还没加载好，请稍等',
      busy: '已有下载正在进行，请等它结束或先取消',
      tipsTitle: '💡 使用小贴士',
      tipStream: '针对超大文件，会弹出两次保存窗口（视频/音频），建议都保存到同一个文件夹。请保持页面开启直至完成。',
      tipQuality: '自动选择当前视频可用的最高画质，请确保大会员账号已登录。若所选 HDR 不可用，会自动降级为最高画质 SDR。',
      tipBatch: '批量下载会先让你多选分集，再选一个保存目录，所有分集依次写入该目录。',
      tipsMore: '展开更多',
      tipsLess: '收起',
      sponsorText: '插件制作不易，如果它确实帮到了你，希望能支持一下！',
      sponsorBtn: '❤️ 爱发电支持',
      feedbackLabel: '反馈邮箱：',
    },
    en: {
      btn: 'Download',
      title: 'Download Video',
      quality: 'Quality',
      hdr: 'HDR / Dolby',
      hdrHint: 'Vivid colors',
      sdr: 'SDR (H.265)',
      sdrHint: 'Best compatibility',
      single: 'This episode',
      batch: 'Whole collection',
      batchHint: 'Pick the episodes to download',
      batchNA: 'Not a collection',
      close: 'Close',
      starting: 'Starting…',
      err: 'Failed to start',
      notReady: 'Player not ready yet, please wait',
      busy: 'A download is already running — wait or cancel it first',
      tipsTitle: '💡 Tips',
      tipStream: 'For extra-large files two save dialogs appear (video/audio). Save both to the same folder and keep the page open until it finishes.',
      tipQuality: 'Picks the highest quality available. Please make sure your Premium account is signed in. If HDR is unavailable it falls back to the best SDR.',
      tipBatch: 'Batch mode asks you to pick episodes, then a folder — all episodes are written there one by one.',
      tipsMore: 'More tips',
      tipsLess: 'Less',
      sponsorText: 'This extension is hard to make. If it has truly helped you, please consider supporting it!',
      sponsorBtn: '❤️ Sponsor on afdian',
      feedbackLabel: 'Feedback: ',
    },
  };

  const detectLang = () => ((navigator.language || '').startsWith('zh') ? 'zh' : 'en');
  let lang = detectLang();
  let T = STRINGS[lang];

  const applyLang = (next) => {
    const l = next === 'zh' || next === 'en' ? next : detectLang();
    if (l === lang) return false;
    lang = l;
    T = STRINGS[lang];
    return true;
  };

  // Filled in after closePanel() is defined (avoids a TDZ error if the
  // storage callback somehow fires before then).
  let refreshUiAfterLangChange = () => {};

  // Load the language the user picked in the popup, then re-render.
  try {
    chrome.storage.local.get('bili_lang', (d) => {
      const stored = d && d.bili_lang;
      if (applyLang(stored)) refreshUiAfterLangChange();
    });
    // React instantly when the user flips the language in the popup.
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.bili_lang) return;
      if (applyLang(changes.bili_lang.newValue)) refreshUiAfterLangChange();
    });
  } catch (_) {}

  // ------------------------------------------------------------
  // Styles
  // ------------------------------------------------------------
  const injectStyle = () => {
    if (document.getElementById(ID_STYLE)) return;
    const s = document.createElement('style');
    s.id = ID_STYLE;
    s.textContent = `
#${ID_BTN}{display:inline-flex;align-items:center;gap:4px;height:22px;padding:0 8px;margin-right:8px;
  border:0;border-radius:4px;background:rgba(251,114,153,.9);color:#fff;font-size:12px;
  font-family:system-ui,sans-serif;line-height:22px;cursor:pointer;white-space:nowrap;
  transition:background .15s;vertical-align:middle}
#${ID_BTN}:hover{background:#ff85a8}
#${ID_BTN}.bd-float{position:fixed;right:16px;bottom:64px;z-index:1000;height:32px;line-height:32px;
  padding:0 14px;border-radius:16px;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,.35)}
#${ID_PANEL}{position:fixed;z-index:2147483646;width:300px;max-height:calc(100vh - 24px);
  overflow-y:auto;background:#1f1f1f;color:#e0e0e0;
  border:1px solid #3a3a3a;border-radius:10px;padding:14px;font:13px/1.6 system-ui,sans-serif;
  box-shadow:0 8px 28px rgba(0,0,0,.55)}
#${ID_PANEL} h4{margin:0 0 10px;font-size:14px;color:#FB7299;font-weight:600}
#${ID_PANEL} .bd-q{display:flex;gap:8px;margin-bottom:12px}
#${ID_PANEL} .bd-q label{flex:1;cursor:pointer}
#${ID_PANEL} .bd-q input{position:absolute;opacity:0;width:0;height:0}
#${ID_PANEL} .bd-card{display:block;background:#2d2d2d;border:1px solid #3a3a3a;border-radius:7px;
  padding:7px 8px;text-align:center;transition:all .15s}
#${ID_PANEL} .bd-q input:checked + .bd-card{background:rgba(251,114,153,.12);border-color:#FB7299}
#${ID_PANEL} .bd-card b{display:block;font-size:12px;color:#fff;font-weight:600}
#${ID_PANEL} .bd-q input:checked + .bd-card b{color:#FB7299}
#${ID_PANEL} .bd-card i{display:block;font-size:11px;color:#888;font-style:normal;margin-top:1px}
#${ID_PANEL} .bd-actions{display:flex;flex-direction:column;gap:7px}
#${ID_PANEL} .bd-main{width:100%;padding:9px;border:0;border-radius:7px;background:#FB7299;color:#fff;
  font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
#${ID_PANEL} .bd-main:hover{background:#ff85a8}
#${ID_PANEL} .bd-main:disabled{background:#555;cursor:not-allowed}
#${ID_PANEL} .bd-sub{width:100%;padding:8px;border:1px solid rgba(251,114,153,.5);border-radius:7px;
  background:transparent;color:#FB7299;font-size:12px;cursor:pointer;font-family:inherit}
#${ID_PANEL} .bd-sub:hover{background:rgba(251,114,153,.1)}
#${ID_PANEL} .bd-sub:disabled{opacity:.45;cursor:not-allowed}
#${ID_PANEL} .bd-msg{min-height:16px;margin-top:8px;font-size:11px;color:#ff6b6b;text-align:center}
#${ID_PANEL} .bd-close{position:absolute;top:8px;right:10px;background:none;border:0;color:#888;
  font-size:16px;line-height:1;cursor:pointer;padding:0}
#${ID_PANEL} .bd-close:hover{color:#fff}
#${ID_PANEL} .bd-tips{margin-top:12px;padding-top:10px;border-top:1px solid #333}
#${ID_PANEL} .bd-tips-h{display:flex;align-items:center;justify-content:space-between;
  font-size:12px;color:#bbb;font-weight:600;cursor:pointer;user-select:none}
#${ID_PANEL} .bd-tips-h span{color:#FB7299;font-weight:400;font-size:11px}
#${ID_PANEL} .bd-tips-body{display:none;margin-top:7px}
#${ID_PANEL} .bd-tips.open .bd-tips-body{display:block}
#${ID_PANEL} .bd-tips-body ul{margin:0;padding-left:15px;font-size:11px;line-height:1.65;color:#999}
#${ID_PANEL} .bd-tips-body li{margin-bottom:5px}
#${ID_PANEL} .bd-tips-body li:last-child{margin-bottom:0}
#${ID_PANEL} .bd-foot{margin-top:11px;padding-top:9px;border-top:1px solid #333;text-align:center}
#${ID_PANEL} .bd-foot p{margin:0 0 7px;font-size:11px;color:#888;line-height:1.5}
#${ID_PANEL} .bd-sponsor{display:inline-block;padding:4px 16px;border:1px solid rgba(251,114,153,.55);
  border-radius:14px;color:#FB7299;font-size:11px;text-decoration:none;transition:background .15s}
#${ID_PANEL} .bd-sponsor:hover{background:rgba(251,114,153,.12);text-decoration:none}
#${ID_PANEL} .bd-mail{margin-top:6px;font-size:10px;color:#777}
#${ID_PANEL} .bd-mail a{color:#888;text-decoration:none}
#${ID_PANEL} .bd-mail a:hover{color:#FB7299;text-decoration:underline}
@media (prefers-color-scheme:light){
  #${ID_PANEL}{background:#fff;color:#222;border-color:#ddd}
  #${ID_PANEL} .bd-card{background:#f4f4f4;border-color:#e0e0e0}
  #${ID_PANEL} .bd-card b{color:#222}
  #${ID_PANEL} .bd-tips,#${ID_PANEL} .bd-foot{border-color:#e6e6e6}
  #${ID_PANEL} .bd-tips-h{color:#555}
  #${ID_PANEL} .bd-tips-body ul{color:#666}
  #${ID_PANEL} .bd-foot p{color:#777}
  #${ID_PANEL} .bd-mail,#${ID_PANEL} .bd-mail a{color:#999}
}
`;
    (document.head || document.documentElement).appendChild(s);
  };

  // ------------------------------------------------------------
  // Control-bar discovery
  // Bilibili rebuilds the player DOM on navigation and on quality
  // switching, so we probe a list of known containers and re-mount.
  // ------------------------------------------------------------
  // Ordered from most specific to most generic. Bilibili has renamed these
  // before and A/B-tests the player, so the tail of the list deliberately
  // falls back to structural/semantic hooks rather than class names alone:
  // a miss in the first few entries still lands somewhere usable.
  const CONTROL_HOSTS = [
    '.bpx-player-ctrl-bottom-right',              // current player
    '.bpx-player-control-bottom-right',           // variant seen in A/B builds
    '.bpx-player-control-bottom .bpx-player-control-bottom-right',
    '.bilibili-player-video-control-bottom-right',// legacy player
    '.bilibili-player-video-btn-fullscreen',      // insert before this
    '[class*="ctrl-bottom-right"]',               // any renamed *-bottom-right
    '[class*="control-bottom-right"]',
  ];

  // Last-resort anchors: a control bar is anything that looks like one and
  // sits inside the player container. Used only when every class hook missed.
  const STRUCTURAL_HINTS = [
    '.bpx-player-control-bottom',
    '.bpx-player-container',
    '#bilibili-player',
    '.bilibili-player-video-control',
  ];

  const findControlHost = () => {
    for (const sel of CONTROL_HOSTS) {
      const el = document.querySelector(sel);
      if (el) {
        // Fullscreen button host: insert before it rather than inside
        if (sel.endsWith('fullscreen') && el.parentElement) return { host: el.parentElement, before: el };
        return { host: el, before: null };
      }
    }
    // Class hooks all missed (B站 renamed the player): append to the control
    // bar container instead of floating, so the button still sits in the UI.
    for (const sel of STRUCTURAL_HINTS) {
      const el = document.querySelector(sel);
      if (el) return { host: el, before: null };
    }
    return null;
  };

  // ------------------------------------------------------------
  // Panel
  // ------------------------------------------------------------
  let panelEl = null;

  const closePanel = () => {
    if (panelEl) { try { panelEl.remove(); } catch (_) {} panelEl = null; }
  };

  // Language switched (from the popup toggle): rebuild the panel next time
  // it opens and relabel the mounted button immediately.
  refreshUiAfterLangChange = () => {
    closePanel();
    const btn = document.getElementById(ID_BTN);
    if (btn) btn.textContent = T.btn;
  };

  const startDownload = async (mode, preferHDR) => {
    const msgEl = panelEl && panelEl.querySelector('.bd-msg');
    const btns = panelEl ? panelEl.querySelectorAll('button.bd-main,button.bd-sub') : [];
    const setBusy = (busy) => {
      btns.forEach(b => { b.disabled = busy; });
      if (msgEl) { msgEl.style.color = '#aaa'; msgEl.textContent = busy ? T.starting : ''; }
    };
    setBusy(true);
    try {
      // NOTE: this script runs in the ISOLATED world; content_merge runs in
      // MAIN. `window` is not shared, so `window.__BILI_DRIVER_BUSY__` here
      // is always undefined — the real check happens in the service worker
      // via PAGE_IS_BUSY (see below). Kept as a fast path for any future
      // same-world deployment.
      if (window.__BILI_DRIVER_BUSY__ === true) {
        setBusy(false);
        if (msgEl) { msgEl.style.color = '#ff6b6b'; msgEl.textContent = T.busy; }
        return;
      }
      let status = null;
      try {
        status = await chrome.runtime.sendMessage({ action: 'PAGE_IS_BUSY' });
      } catch (_) {}
      // A stuck BUSY flag (script crashed before teardown) would block the
      // user forever, so only refuse while the overlay is actually on screen.
      if (status && status.busy && status.alive) {
        setBusy(false);
        if (msgEl) { msgEl.style.color = '#ff6b6b'; msgEl.textContent = T.busy; }
        return;
      }
      const resp = await chrome.runtime.sendMessage({
        action: 'PAGE_START_DOWNLOAD',
        batch: mode === 'batch',
        preferHDR,
      });
      if (resp && resp.ok) {
        closePanel();
      } else {
        setBusy(false);
        if (msgEl) { msgEl.style.color = '#ff6b6b'; msgEl.textContent = (resp && resp.error) || T.err; }
      }
    } catch (e) {
      setBusy(false);
      if (msgEl) { msgEl.style.color = '#ff6b6b'; msgEl.textContent = T.err + ': ' + (e && e.message ? e.message : e); }
    }
  };

  const openPanel = (anchor) => {
    if (panelEl) { closePanel(); return; }
    injectStyle();

    const p = document.createElement('div');
    p.id = ID_PANEL;
    p.innerHTML = `
      <button class="bd-close" title="${T.close}">×</button>
      <h4>${T.title}</h4>
      <div class="bd-q">
        <label><input type="radio" name="bd_q" value="sdr" checked>
          <span class="bd-card"><b>${T.sdr}</b><i>${T.sdrHint}</i></span></label>
        <label><input type="radio" name="bd_q" value="hdr">
          <span class="bd-card"><b>${T.hdr}</b><i>${T.hdrHint}</i></span></label>
      </div>
      <div class="bd-actions">
        <button class="bd-main">${T.single}</button>
        <button class="bd-sub">${T.batch}</button>
      </div>
      <div class="bd-msg"></div>
      <div class="bd-tips">
        <div class="bd-tips-h">${T.tipsTitle}<span>${T.tipsMore} ▾</span></div>
        <div class="bd-tips-body">
          <ul>
            <li>${T.tipQuality}</li>
            <li>${T.tipStream}</li>
            <li>${T.tipBatch}</li>
          </ul>
        </div>
      </div>
      <div class="bd-foot">
        <p>${T.sponsorText}</p>
        <a class="bd-sponsor" href="https://afdian.com/a/luokexiaoguo" target="_blank" rel="noopener noreferrer">${T.sponsorBtn}</a>
        <div class="bd-mail">${T.feedbackLabel}<a href="mailto:luokexiaoguo@foxmail.com">luokexiaoguo@foxmail.com</a></div>
      </div>`;
    document.body.appendChild(p);
    panelEl = p;

    // Position under the button, clamped to the viewport
    try {
      const r = anchor.getBoundingClientRect();
      const w = 300, h = p.offsetHeight || 320;
      let left = Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8);
      let top = r.top - h - 10;
      if (top < 8) top = Math.min(r.bottom + 10, window.innerHeight - h - 8);
      p.style.left = left + 'px';
      p.style.top = top + 'px';
    } catch (_) {
      p.style.right = '16px';
      p.style.bottom = '100px';
    }

    const getHDR = () => {
      const r = p.querySelector('input[name="bd_q"]:checked');
      return !!r && r.value === 'hdr';
    };

    p.querySelector('.bd-close').onclick = (e) => { e.stopPropagation(); closePanel(); };

    // Tips are collapsed by default so the panel stays compact; the header
    // row toggles them. Stops propagation so the outside-click handler
    // (which closes the panel) doesn't fire.
    const tipsBox = p.querySelector('.bd-tips');
    tipsBox.querySelector('.bd-tips-h').onclick = (ev) => {
      ev.stopPropagation();
      const open = tipsBox.classList.toggle('open');
      tipsBox.querySelector('.bd-tips-h span').textContent =
        (open ? T.tipsLess : T.tipsMore) + (open ? ' ▴' : ' ▾');
    };
    // Links inside the panel must not be swallowed by the outside-click close
    p.querySelectorAll('.bd-foot a').forEach(a => {
      a.addEventListener('click', (ev) => ev.stopPropagation());
    });
    p.querySelector('.bd-main').onclick = () => startDownload('single', getHDR());

    // Batch only makes sense on collections / multi-P. Probe the page and
    // disable the button up-front rather than failing after the click.
    const subBtn = p.querySelector('.bd-sub');
    subBtn.onclick = () => startDownload('batch', getHDR());
    chrome.runtime.sendMessage({ action: 'PAGE_PROBE_COLLECTION' }, (r) => {
      if (!panelEl || !document.body.contains(p)) return;
      if (chrome.runtime.lastError) return;
      if (r && r.available) {
        if (r.count > 1) subBtn.textContent = `${T.batch} (${r.count})`;
      } else {
        subBtn.disabled = true;
        subBtn.textContent = T.batchNA;
      }
    });

    // Dismiss on outside click
    setTimeout(() => {
      const onDocClick = (ev) => {
        if (!panelEl) { document.removeEventListener('mousedown', onDocClick, true); return; }
        if (!panelEl.contains(ev.target) && ev.target.id !== ID_BTN) {
          closePanel();
          document.removeEventListener('mousedown', onDocClick, true);
        }
      };
      document.addEventListener('mousedown', onDocClick, true);
    }, 0);
  };

  // ------------------------------------------------------------
  // Button mount
  // ------------------------------------------------------------
  const createButton = (float) => {
    const b = document.createElement('button');
    b.id = ID_BTN;
    b.type = 'button';
    b.textContent = T.btn;
    if (float) b.classList.add('bd-float');
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openPanel(b);
    });
    return b;
  };

  // Declared before mount() so its `_suspendObserver` guard is not in TDZ.
  let _suspendObserver = false;

  const mount = () => {
    // Our own DOM writes would re-trigger the MutationObserver and cause a
    // feedback loop on a page this busy, so swallow mutations while mounted.
    _suspendObserver = true;
    try {
      injectStyle();
      const existing = document.getElementById(ID_BTN);

      const found = findControlHost();
      if (found) {
        // Already in the right place?
        if (existing && existing.parentElement === found.host) return;
        if (existing) existing.remove();
        const btn = createButton(false);
        if (found.before && found.before.parentElement === found.host) {
          found.host.insertBefore(btn, found.before);
        } else {
          found.host.appendChild(btn);
        }
        btn.title = T.btn;
        return;
      }

      // Player not mounted yet (or unknown layout): float a fallback button
      // so the feature still works on player variants we don't recognise.
      if (existing) return;
      if (!document.querySelector('video')) return; // not a video page yet
      document.body.appendChild(createButton(true));
    } finally {
      _suspendObserver = false;
    }
  };

  let mountTimer = null;
  const scheduleMount = () => {
    if (_suspendObserver || mountTimer) return;
    mountTimer = setTimeout(() => { mountTimer = null; mount(); }, 300);
  };

  // ------------------------------------------------------------
  // SPA navigation: Bilibili swaps videos without a page reload
  // ------------------------------------------------------------
  let lastUrl = location.href;
  const onNavigate = () => {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    closePanel();
    // Let the new player render before re-mounting
    setTimeout(mount, 600);
    setTimeout(mount, 1600);
  };

  const boot = () => {
    mount();
    // Player is rebuilt often (quality switch, fullscreen, theatre mode)
    const mo = new MutationObserver(() => scheduleMount());
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setInterval(onNavigate, 1000);
    // A couple of delayed attempts for slow players
    setTimeout(mount, 1200);
    setTimeout(mount, 3000);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
