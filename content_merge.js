(async () => {
  // 防重复注入:同一页面每次点击"下载"都会重新注入本脚本。
  // 没有守卫的话,反复下载会叠加多个 overlay 和 window 监听器(内存泄漏)。
  if (window.__BILI_DRIVER_ACTIVE__) return;
  window.__BILI_DRIVER_ACTIVE__ = true;
  try {
    console.log("[BilibiliDownloader] Script started");

    const lang = window.__BILI_LANG__ || "zh";
    const preferHDR = window.__BILI_DOWN_PREF__?.preferHDR === true;
    console.log("[BilibiliDownloader] HDR Preference:", preferHDR ? "HDR" : "SDR");

    const T = {
      zh: {
        title: "B站离线舱",
        init: "初始化中...",
        cancel: "取消",
        close: "关闭",
        confirmCancel: "确定要取消下载吗？",
        parse: "正在解析视频信息...",
        parseErr: "解析出错",
        noInfo: "未找到视频流信息",
        noInfoDetail: "无法获取 DASH 格式地址，请确认视频是否有效或需要登录。",
        noTrack: "解析失败",
        noTrackDetail: "未找到有效的视频或音频轨道。",
        browserDl: "已调用浏览器下载",
        browserDlDetail: "请查看浏览器右上角下载列表",
        saving: "正在保存",
        dlFail: "下载失败",
        exportAudio: "正在导出音频...",
        dlDone: "下载完成",
        dlFailTitle: "下载失败",
        streamSave: "流式保存",
        coreLoad: "正在加载核心组件...",
        dlStep: "正在下载",
        merge: "正在合并...",
        saveFile: "保存文件中...",
        canceled: "已取消",
        bigFile: "文件过大",
        bigFileDetail: "文件大小超出当前设备推荐合并能力",
        bigFileConfirm: "检测到文件过大(或内存不足)，无法合并。\n\n是否分别下载视频和音频轨道？",
        errTitle: "出错啦",
        mergeFailConfirm: "合并失败: {msg}\n\n是否尝试分别下载已获取的视频/音频轨道？\n(如果不保存，已下载的数据将丢失)",
        video: "视频",
        audio: "音频",
        noStreamSave: "当前浏览器不支持流式保存",
        selectAudio: "请继续选择音频保存位置...",
        scriptFail: "脚本启动失败: ",
        multiPartDetected: "检测到多P视频，请选择要下载的分P",
        batchTitle: "批量下载 - 选择分集",
        batchSelectAll: "全选",
        batchSelectNone: "全不选",
        batchStart: "开始下载",
        batchDl: "批量下载",
        batchPickDir: "请选择保存目录",
        batchPickDirHint: "选择一个文件夹，所有分集将保存到此目录",
        batchNoDir: "目录未选择",
        batchNoDirHint: "将使用浏览器默认下载目录逐个保存",
        batchDone: "批量完成",
        batchEpFail: "集失败",
        batchTooLarge: "文件较大，分轨保存",
        batchSplit: "改为分轨保存",
        batchNoCollection: "当前页面不是合集或多P，无法批量下载",
        batchDirAbortFallback: "未选择保存目录。\n\n是否改用浏览器默认下载目录逐个保存？\n（与单次下载大文件音频的保存方式一致）",
        batchDirRejectedFallback: "所选目录无法打开（可能是系统目录）。\n\n是否改用浏览器默认下载目录逐个保存？\n（与单次下载大文件音频的保存方式一致）",
        batchNoDirPickerFallback: "当前浏览器不支持目录选择。\n\n是否改用浏览器默认下载目录逐个保存？\n（与单次下载大文件音频的保存方式一致）",
        batchBlobTooLarge: "该集文件过大，无法在默认下载目录模式保存（会内存溢出），请选择目录后重试"
      },
      en: {
        title: "BiliDown",
        init: "Initializing...",
        cancel: "Cancel",
        close: "Close",
        confirmCancel: "Confirm cancel download?",
        parse: "Parsing video info...",
        parseErr: "Parse Error",
        noInfo: "Video info not found",
        noInfoDetail: "Cannot fetch DASH url. Please check video validity or login.",
        noTrack: "Parse Failed",
        noTrackDetail: "No valid video or audio track found.",
        browserDl: "Browser download started",
        browserDlDetail: "Check browser download list.",
        saving: "Saving ",
        dlFail: "Download Failed",
        exportAudio: "Exporting Audio...",
        dlDone: "Download Complete",
        dlFailTitle: "Download Failed",
        streamSave: "Stream Save",
        coreLoad: "Loading Core...",
        dlStep: "Downloading ",
        merge: "Merging...",
        saveFile: "Saving file...",
        canceled: "Canceled",
        bigFile: "File Too Large",
        bigFileDetail: "File size exceeds recommended merge capacity for this device",
        bigFileConfirm: "File too large (or OOM). Cannot merge.\n\nDownload video/audio separately?",
        errTitle: "Error",
        mergeFailConfirm: "Merge failed: {msg}\n\nDownload fetched video/audio tracks separately?\n(Data will be lost if not saved)",
        video: "Video",
        audio: "Audio",
        noStreamSave: "Browser does not support stream save",
        selectAudio: "Select location for AUDIO file...",
        scriptFail: "Script failed to start: ",
        multiPartDetected: "Multi-part video detected. Select which part to download.",
        batchTitle: "Batch Download - Select Episodes",
        batchSelectAll: "Select All",
        batchSelectNone: "Select None",
        batchStart: "Start Download",
        batchDl: "Batching",
        batchPickDir: "Choose Save Folder",
        batchPickDirHint: "Select a folder; all episodes will be saved here",
        batchNoDir: "No folder selected",
        batchNoDirHint: "Will save each to browser default download dir",
        batchDone: "Batch Done",
        batchEpFail: "episodes failed",
        batchTooLarge: "large file, saving tracks separately",
        batchSplit: "splitting instead",
        batchNoCollection: "Current page is not a collection/multi-part, cannot batch download",
        batchDirAbortFallback: "No save folder selected.\n\nUse browser default download dir instead?\n(Same as single-download large audio)",
        batchDirRejectedFallback: "Selected folder cannot be opened (may be a system dir).\n\nUse browser default download dir instead?\n(Same as single-download large audio)",
        batchNoDirPickerFallback: "Browser does not support folder selection.\n\nUse browser default download dir instead?\n(Same as single-download large audio)",
        batchBlobTooLarge: "This episode is too large for default-dir mode (would OOM). Please select a folder and retry."
      }
    }[lang];

    // ============================================================
    // 1. Overlay UI Component
    // ============================================================
    const overlay = (() => {
      const el = document.createElement("div");
      el.id = "bili-download-overlay";
      el.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;background:rgba(0,0,0,0.85);color:#fff;font:14px/1.6 system-ui,sans-serif;padding:16px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.5);min-width:260px;max-width:360px;user-select:none;cursor:move;";

      let isDrag = false, sx, sy, il, it;
      const onMouseDown = e => {
        if (e.target.tagName === "BUTTON") return;
        isDrag = true; sx = e.clientX; sy = e.clientY;
        const r = el.getBoundingClientRect(); il = r.left; it = r.top;
        el.style.right = "auto"; el.style.bottom = "auto";
        el.style.left = il + "px"; el.style.top = it + "px";
        e.preventDefault();
      };
      const onMouseMove = e => { if (!isDrag) return; el.style.left = (il + e.clientX - sx) + "px"; el.style.top = (it + e.clientY - sy) + "px"; };
      const onMouseUp = () => isDrag = false;
      el.addEventListener("mousedown", onMouseDown);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);

      const titleDiv = document.createElement("div");
      titleDiv.style.cssText = "font-weight:bold;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.2);padding-bottom:4px;";
      titleDiv.textContent = T.title;
      el.appendChild(titleDiv);

      const stepDiv = document.createElement("div");
      el.appendChild(stepDiv);

      const barCon = document.createElement("div");
      barCon.style.cssText = "margin-top:8px;height:6px;background:rgba(255,255,255,0.2);border-radius:3px;overflow:hidden;";
      const barDiv = document.createElement("div");
      barDiv.style.cssText = "height:100%;width:0%;background:#00aeec;transition:width 0.2s;";
      barCon.appendChild(barDiv);
      el.appendChild(barCon);

      const detailDiv = document.createElement("div");
      detailDiv.style.cssText = "margin-top:8px;font-size:12px;opacity:0.8;word-break:break-all;";
      el.appendChild(detailDiv);

      // 批量进度元素(默认隐藏,setBatchMode 启用)
      const batchInfoDiv = document.createElement("div");
      batchInfoDiv.style.cssText = "margin-top:6px;font-size:12px;color:#4cc9f0;display:none;";
      el.appendChild(batchInfoDiv);
      const batchBarCon = document.createElement("div");
      batchBarCon.style.cssText = "margin-top:4px;height:4px;background:rgba(255,255,255,0.15);border-radius:2px;overflow:hidden;display:none;";
      const batchBarDiv = document.createElement("div");
      batchBarDiv.style.cssText = "height:100%;width:0%;background:#4cc9f0;transition:width 0.3s;";
      batchBarCon.appendChild(batchBarDiv);
      el.appendChild(batchBarCon);

      const btnArea = document.createElement("div");
      btnArea.style.cssText = "margin-top:12px;display:flex;justify-content:flex-end;gap:10px;";
      el.appendChild(btnArea);

      const mkBtn = (txt, color, onClk) => {
        const b = document.createElement("button");
        b.textContent = txt;
        b.style.cssText = "background:transparent;border:none;color:" + color + ";cursor:pointer;font-size:12px;padding:0;text-decoration:underline;";
        b.onclick = onClk;
        return b;
      };

      const cancelBtn = mkBtn(T.cancel, "#ff6b6b", () => { if (confirm(T.confirmCancel)) { controller.abort(); my.remove(); } });
      btnArea.appendChild(cancelBtn);
      document.body.appendChild(el);

      const my = {};
      my.remove = () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); try { el.remove(); } catch (_) {} };
      return {
        remove: () => my.remove(),
        setStep: t => { stepDiv.textContent = t; },
        setProgress: p => { barDiv.style.width = Math.max(0, Math.min(100, p)) + "%"; },
        setDetail: t => { detailDiv.textContent = t; },
        addBtn: (txt, onClk) => {
          const b = mkBtn(txt, "#4cc9f0", onClk);
          b.style.cssText = "margin-right:8px;text-decoration:none;background:rgba(255,255,255,0.1);padding:2px 8px;border-radius:4px;";
          btnArea.insertBefore(b, cancelBtn);
          return b;
        },
        done: () => {
          cancelBtn.textContent = T.close;
          cancelBtn.style.cssText = "background:transparent;border:none;color:#fff;cursor:pointer;font-size:12px;padding:0;text-decoration:none;";
          cancelBtn.onclick = () => my.remove();
        },
        resetCancel: () => {
          cancelBtn.textContent = T.cancel;
          cancelBtn.style.cssText = "background:transparent;border:none;color:#ff6b6b;cursor:pointer;font-size:12px;padding:0;text-decoration:underline;";
          cancelBtn.onclick = () => { if (confirm(T.confirmCancel)) { controller.abort(); my.remove(); } };
        },
        // 批量模式:显示总进度信息 + 总进度条
        setBatchMode: (on) => {
          batchInfoDiv.style.display = on ? "block" : "none";
          batchBarCon.style.display = on ? "block" : "none";
        },
        setBatchInfo: (txt) => { batchInfoDiv.textContent = txt; },
        setBatchProgress: (p) => { batchBarDiv.style.width = Math.max(0, Math.min(100, p)) + "%"; }
      };
    })();

    window.addEventListener("BILI_DOWN_STATUS", e => { if (e.detail) window.dispatchEvent(new CustomEvent("BILI_BRIDGE_STATUS_UPDATE", { detail: e.detail })); });

    const controller = new AbortController();
    const signal = controller.signal;

    // ============================================================
    // 2. Utilities
    // ============================================================
    const fetchWithTimeout = async (url, opts = {}) => {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), opts.timeout || 8000);
      try { const r = await fetch(url, { ...opts, signal: ctrl.signal }); clearTimeout(id); return r; }
      catch (e) { clearTimeout(id); throw e; }
    };

    const fmtBytes = n => {
      if (!n && n !== 0) return "";
      const u = ["B","KB","MB","GB"]; let i = 0, v = n;
      while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
      return v.toFixed(1) + " " + u[i];
    };

    // ============================================================
    // 3. Multi-Part Selector
    // ============================================================
    const getMultiPartInfo = () => {
      try {
        const st = window.__INITIAL_STATE__ || {};
        // 普通视频多P：videoData.pages
        let pages = (st.videoData || {}).pages || [];
        // 番剧/电影/电视剧：epList 或 mediaInfo.episodes
        if (!pages.length && st.epList?.length) {
          pages = st.epList.map((ep) => ({ part: ep.title || ep.long_title || '', cid: ep.cid, epId: ep.id }));
        }
        if (!pages.length && st.mediaInfo?.episodes?.length) {
          pages = st.mediaInfo.episodes.map((ep) => ({ part: ep.title || ep.long_title || '', cid: ep.cid, epId: ep.id }));
        }
        // UGC合集（用户创建的合集/系列）：videoData.ugc_season.episodes
        if (!pages.length && st.videoData?.ugc_season?.episodes?.length) {
          pages = st.videoData.ugc_season.episodes.map((ep) => ({ part: ep.title || '', cid: ep.cid }));
        }
        // 系列视频：videoData.series.list
        if (!pages.length && st.videoData?.series?.list?.length) {
          pages = st.videoData.series.list.map((ep) => ({ part: ep.title || '', cid: ep.cid }));
        }
        if (pages.length > 1) {
          const p = parseInt(new URLSearchParams(location.search).get('p') || '1', 10) - 1;
          return { pages, currentIndex: Math.min(p, pages.length - 1) };
        }
      } catch (_) {}
      return null;
    };

    const showPartSelector = (pages, currentIndex) => {
      return new Promise(resolve => {
        const c = document.createElement("div");
        c.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:2147483647;display:flex;align-items:center;justify-content:center;";
        const box = document.createElement("div");
        box.style.cssText = "background:#1f1f1f;color:#fff;padding:24px;border-radius:12px;min-width:320px;max-width:480px;max-height:80vh;overflow:auto;font-family:system-ui,sans-serif;";
        const t = document.createElement("h3");
        t.textContent = T.multiPartDetected;
        t.style.cssText = "margin:0 0 16px 0;color:#FB7299;";
        box.appendChild(t);
        const list = document.createElement("div");
        list.style.cssText = "max-height:400px;overflow-y:auto;";
        pages.forEach((p, i) => {
          const n = p.part || p.title || `P${i+1}`;
          const b = document.createElement("button");
          b.textContent = `${i+1}. ${n}`;
          b.style.cssText = `display:block;width:100%;padding:10px 12px;margin-bottom:8px;background:${i===currentIndex?'#FB7299':'#2d2d2d'};color:#fff;border:none;border-radius:6px;text-align:left;cursor:pointer;font-size:13px;font-weight:${i===currentIndex?'bold':'normal'};`;
          b.onclick = () => { c.remove(); resolve({ index: i, page: p }); };
          list.appendChild(b);
        });
        const cb = document.createElement("button");
        cb.textContent = T.cancel;
        cb.style.cssText = "display:block;width:100%;padding:8px 16px;margin-top:8px;background:transparent;border:1px solid #666;color:#aaa;border-radius:6px;cursor:pointer;";
        cb.onclick = () => { c.remove(); resolve(null); };
        box.appendChild(list); box.appendChild(cb); c.appendChild(box); document.body.appendChild(c);
      });
    };

    // ============================================================
    // 3b. Batch Episode Selector (多选)
    // ============================================================
    const showBatchSelector = (pages, currentIndex) => {
      return new Promise(resolve => {
        const c = document.createElement("div");
        c.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:2147483647;display:flex;align-items:center;justify-content:center;";
        const box = document.createElement("div");
        box.style.cssText = "background:#1f1f1f;color:#fff;padding:24px;border-radius:12px;min-width:340px;max-width:520px;max-height:85vh;overflow:auto;font-family:system-ui,sans-serif;";
        const t = document.createElement("h3");
        t.textContent = T.batchTitle;
        t.style.cssText = "margin:0 0 12px 0;color:#FB7299;";
        box.appendChild(t);

        // 顶部全选/全不选按钮行
        const topRow = document.createElement("div");
        topRow.style.cssText = "display:flex;gap:8px;margin-bottom:12px;";
        const setAll = (v) => { list.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = v); };
        const btnAll = document.createElement("button");
        btnAll.textContent = T.batchSelectAll; btnAll.style.cssText = "flex:1;padding:6px 10px;background:#2d2d2d;color:#fff;border:1px solid #444;border-radius:6px;cursor:pointer;font-size:12px;";
        btnAll.onclick = () => setAll(true);
        const btnNone = document.createElement("button");
        btnNone.textContent = T.batchSelectNone; btnNone.style.cssText = "flex:1;padding:6px 10px;background:#2d2d2d;color:#fff;border:1px solid #444;border-radius:6px;cursor:pointer;font-size:12px;";
        btnNone.onclick = () => setAll(false);
        topRow.appendChild(btnAll); topRow.appendChild(btnNone);
        box.appendChild(topRow);

        const list = document.createElement("div");
        list.style.cssText = "max-height:380px;overflow-y:auto;";
        // 默认全选
        pages.forEach((p, i) => {
          const row = document.createElement("label");
          row.style.cssText = `display:flex;align-items:center;gap:8px;padding:8px 10px;margin-bottom:6px;background:${i===currentIndex?'rgba(251,114,153,0.12)':'#2d2d2d'};border-radius:6px;cursor:pointer;font-size:13px;`;
          const cb = document.createElement("input");
          cb.type = "checkbox"; cb.checked = true; cb.style.cssText = "accent-color:#FB7299;width:16px;height:16px;";
          const n = p.part || p.title || `P${i+1}`;
          const span = document.createElement("span");
          span.textContent = `${i+1}. ${n}`; span.style.cssText = "flex:1;word-break:break-all;";
          row.appendChild(cb); row.appendChild(span); list.appendChild(row);
        });
        box.appendChild(list);

        const startBtn = document.createElement("button");
        startBtn.textContent = T.batchStart;
        startBtn.style.cssText = "display:block;width:100%;padding:10px 16px;margin-top:12px;background:#FB7299;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:14px;";
        const doStart = () => {
          const selected = [];
          list.querySelectorAll('input[type=checkbox]').forEach((cb, i) => { if (cb.checked) selected.push(i); });
          c.remove(); resolve(selected.length ? selected : null);
        };
        startBtn.onclick = doStart;
        const cancelBtn = document.createElement("button");
        cancelBtn.textContent = T.cancel;
        cancelBtn.style.cssText = "display:block;width:100%;padding:8px 16px;margin-top:8px;background:transparent;border:1px solid #666;color:#aaa;border-radius:6px;cursor:pointer;";
        cancelBtn.onclick = () => { c.remove(); resolve(null); };
        box.appendChild(startBtn); box.appendChild(cancelBtn);
        c.appendChild(box); document.body.appendChild(c);
      });
    };

    // ============================================================
    // 3c. 获取合集分集列表(用于批量下载)
    // 对于 UGC 合集,页面 __INITIAL_STATE__ 可能只有入口 BV 的信息,
    // 需要调 view 接口拿完整 ugc_season.sections[].episodes 列表。
    // 返回统一结构: [{ cid, bvid?, epId?, title, isCheese? }]
    // ============================================================
    const getCollectionEpisodes = async () => {
      // 优先用页面上已有的多P信息(普通多P/番剧 epList 等已在 getMultiPartInfo 里解析)
      const mpi = getMultiPartInfo();
      if (mpi?.pages?.length > 1) {
        return mpi.pages.map((p, i) => ({
          cid: String(p.cid || ''), bvid: undefined, epId: p.epId, title: p.part || p.title || `P${i+1}`
        }));
      }
      // UGC 合集/series:页面 __INITIAL_STATE__ 可能没展开完整列表,
      // 调 view 接口拿 ugc_season.sections[].episodes 或 series
      try {
        const m = location.pathname.match(/\/video\/(BV[\w]+)/i);
        if (m) {
          const bvid = m[1];
          const r = await fetchWithTimeout(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, { credentials: "include" });
          const j = await r.json();
          const d = j?.data || {};
          const eps = [];
          // ugc_season:合集(每个分集是独立 BV)
          if (d.ugc_season?.sections?.length) {
            for (const s of d.ugc_season.sections) {
              for (const ep of (s.episodes || [])) {
                // UGC 合集每集是独立 BV,bvid 必须用 ep.bvid(不能合集入口 BV)
                eps.push({ cid: String(ep.cid||''), bvid: ep.bvid || undefined, epId: ep.id, title: ep.title || '' });
              }
            }
            if (eps.length > 1) {
              console.log('[Batch] UGC season episodes:', eps.length, 'first ep bvid:', eps[0].bvid, 'cid:', eps[0].cid);
              return eps;
            }
          }
          // series:视频集合
          if (!eps.length && d.series?.list?.length) {
            for (const it of d.series.list) {
              eps.push({ cid: String(it.cid||''), bvid: it.bvid || undefined, epId: undefined, title: it.title || '' });
            }
            if (eps.length > 1) return eps;
          }
          // 普通多P(view 接口的 pages,兜底,如果页面 __INITIAL_STATE__ 没解析到)
          if (!eps.length && d.pages?.length > 1) {
            d.pages.forEach((p, i) => eps.push({ cid: String(p.cid||''), bvid: bvid, epId: undefined, title: p.part || `P${i+1}` }));
          }
          if (eps.length > 1) return eps;
        }
      } catch (_) {}
      // 番剧 ss 季
      try {
        const ss = location.pathname.match(/\/bangumi\/play\/ss(\d+)/i);
        const epMatch = location.pathname.match(/\/bangumi\/play\/ep(\d+)/i);
        if (ss || epMatch) {
          let r;
          if (ss) {
            r = await fetchWithTimeout(`https://api.bilibili.com/pgc/view/web/season?season_id=${ss[1]}`);
          } else {
            // ep 入口:先拿 season_id
            const er = await fetchWithTimeout(`https://api.bilibili.com/pgc/view/web/season?ep_id=${epMatch[1]}`);
            const ej = await er.json();
            const sid = ej?.result?.season_id;
            if (!sid) return null;
            r = await fetchWithTimeout(`https://api.bilibili.com/pgc/view/web/season?season_id=${sid}`);
          }
          const j = await r.json();
          const eps = [];
          for (const ep of ((j?.result || {}).episodes || [])) {
            eps.push({ cid: String(ep.cid||''), bvid: ep.bvid, epId: ep.id, title: ep.title || ep.long_title || '', isBangumi: true });
          }
          // 分段(正片/番外)
          if (!eps.length && j?.result?.sections) {
            for (const s of j.result.sections) for (const ep of (s.episodes||[])) eps.push({ cid: String(ep.cid||''), bvid: ep.bvid, epId: ep.id, title: ep.title || ep.long_title || '', isBangumi: true });
          }
          if (eps.length > 1) return eps;
        }
      } catch (_) {}
      // cheese 课程
      try {
        const cheese = location.pathname.match(/\/cheese\/play\/ep(\d+)/i);
        if (cheese) {
          // cheese 没有简单的"列全部 ep"接口,从 __INITIAL_STATE__ 取
          const st = window.__INITIAL_STATE__ || {};
          const eps = (st.epList || []).map(ep => ({ cid: String(ep.cid||''), bvid: ep.bvid, epId: ep.id, title: ep.title || ep.long_title || '', isCheese: true }));
          if (eps.length > 1) return eps;
        }
      } catch (_) {}
      return null;
    };

    // ============================================================
    // 3d. 取单集标题(用于批量命名,尽量取视频标题而非网页标题)
    // ============================================================
    const getEpTitle = async (ep) => {
      if (ep.title) return ep.title;
      try {
        if (ep.bvid) {
          const r = await fetchWithTimeout(`https://api.bilibili.com/x/web-interface/view?bvid=${ep.bvid}`, { credentials: "include" });
          const j = await r.json();
          if (j?.data?.title) return j.data.title;
        }
      } catch (_) {}
      return `ep${ep.epId || ep.cid || 'unknown'}`;
    };

    // ============================================================
    // 3e. 取单集 dash(批量专用)
    // 关键:UGC 合集每集是独立 BV,必须用该集自己的 bvid+cid 请求 playurl,
    // 不能用 resolveBilibili(它回退到 getBvid() 拿的是当前页面 BV)。
    // ============================================================
    const resolveEpisodeDash = async (ep) => {
      const cid = ep.cid ? String(ep.cid) : undefined;
      const epId = ep.epId ? String(ep.epId) : undefined;
      const bvid = ep.bvid; // UGC 合集:每集独立 BV;普通多P:undefined → 用页面 BV

      if (!cid && !epId) return null;

      // 番剧/影视:用 pgc playurl(epId + cid)
      if (epId && (location.pathname.includes('/bangumi/play/') || ep.isBangumi)) {
        try {
          let u = `https://api.bilibili.com/pgc/player/web/playurl?qn=120&fnval=4048&fourk=1`;
          if (epId) u += `&ep_id=${epId}`;
          if (cid) u += `&cid=${cid}`;
          const pr = await fetchWithTimeout(u, { credentials: "include" });
          const pj = await pr.json();
          if (pj?.result?.dash || pj?.data?.dash) return pj.result.dash || pj.data.dash;
        } catch (_) {}
      }

      // cheese 课程
      if (ep.isCheese && cid) {
        const cbvid = bvid || (location.pathname.match(/\/video\/(BV[\w]+)/i) || [])[1];
        if (cbvid) {
          try {
            const u = `https://api.bilibili.com/p/player/playurl?cid=${cid}&bvid=${cbvid}&qn=120&fnval=4048&fourk=1`;
            const pr = await fetchWithTimeout(u, { credentials: "include" });
            const pj = await pr.json();
            if (pj?.data?.dash) return pj.data.dash;
          } catch (_) {}
        }
      }

      // 普通视频 / UGC 合集:用该集自己的 bvid(如果有),否则用页面 bvid
      if (cid) {
        const useBvid = bvid || (location.pathname.match(/\/video\/(BV[\w]+)/i) || [])[1];
        if (useBvid) {
          try {
            const pr = await fetchWithTimeout(`https://api.bilibili.com/x/player/playurl?cid=${cid}&bvid=${useBvid}&qn=120&fnval=4048&fourk=1`, { credentials: "include" });
            const pj = await pr.json();
            if (pj?.data?.dash) return pj.data.dash;
          } catch (_) {}
        }
      }

      // 最后兜底:复用 resolveBilibili(可能 bvid 不对,但总比没有强)
      return await resolveBilibili(cid, epId);
    };

    // ============================================================
    // 4. Bilibili API
    // ============================================================
    
    // 获取当前视频的 cid，优先使用最新的播放器数据
    const getCurrentVideoCid = () => {
      // 方法1: 从 __playinfo_state__ 获取（播放器切换时的实时数据）
      try {
        const pis = window.__playinfo_state__ || window.playinfo_state;
        if (pis?.cid) return { cid: String(pis.cid), source: 'playinfo_state' };
        if (pis?.videoData?.cid) return { cid: String(pis.videoData.cid), source: 'playinfo_state.videoData' };
      } catch (_) {}
      
      // 方法2: 从 __playinfo__ 获取（页面嵌入的数据）
      try {
        const pi = window.__playinfo__ || window.playinfo;
        if (pi?.cid) return { cid: String(pi.cid), source: 'playinfo' };
        if (pi?.data?.cid) return { cid: String(pi.data.cid), source: 'playinfo.data' };
      } catch (_) {}
      
      // 方法3: 从 DOM 中提取 window.__playinfo__
      try {
        const m = document.body.innerHTML.match(/window\.__playinfo__\s*=\s*({.*?})(?:;|\n)/);
        if (m) { const d = JSON.parse(m[1]); if (d.cid) return { cid: String(d.cid), source: 'dom_playinfo' }; if (d.data?.cid) return { cid: String(d.data.cid), source: 'dom_playinfo.data' }; }
      } catch (_) {}
      
      // 方法4: 从 player 元素获取 cid
      try {
        const player = document.querySelector('#player_module, .bpx-player-container, #bilibili-player');
        if (player) {
          const cid = player.getAttribute('data-cid') || player.dataset?.cid;
          if (cid) return { cid: String(cid), source: 'player_element' };
        }
      } catch (_) {}
      
      // 方法5: 从 __INITIAL_STATE__ 获取（兜底）
      try {
        const st = window.__INITIAL_STATE__ || {};
        if (st.cid) return { cid: String(st.cid), source: 'initial_state' };
        if (st.videoData?.cid) return { cid: String(st.videoData.cid), source: 'initial_state.videoData' };
      } catch (_) {}
      
      return null;
    };

    const getBvid = async () => {
      const m = location.pathname.match(/\/video\/(BV[\w]+)/i);
      if (m) {
        const pi = parseInt(new URLSearchParams(location.search).get('p') || '1', 10) - 1;
        let pc = null, pt = null;
        try {
          const pg = (window.__INITIAL_STATE__?.videoData || {}).pages || [];
          if (pg[pi]) { pc = pg[pi].cid; pt = pg[pi].part || pg[pi].title; }
        } catch (_) {}
        return { bvid: m[1], cid: pc, pageIndex: pi, pageTitle: pt };
      }

      const ep = location.pathname.match(/\/bangumi\/play\/ep(\d+)/i);
      if (ep) {
        const eid = ep[1];
        try {
          if (window.__INITIAL_STATE__) {
            const s = window.__INITIAL_STATE__;
            if (s.epInfo?.id == eid && s.epInfo.bvid) return { bvid: s.epInfo.bvid, cid: s.epInfo.cid, epId: eid };
            const f = (s.epList || []).find(e => e.id == eid);
            if (f?.bvid) return { bvid: f.bvid, cid: f.cid, epId: eid };
          }
        } catch (_) {}
        try {
          const r = await fetchWithTimeout(`https://api.bilibili.com/pgc/view/web/season?ep_id=${eid}`);
          const j = await r.json();
          const eps = (j?.result || {}).episodes || [];
          let t = eps.find(e => e.id == eid);
          if (!t && j?.result?.sections) for (const s of j.result.sections) { t = s.episodes?.find(e => e.id == eid); if (t) break; }
          if (t?.bvid) return { bvid: t.bvid, cid: t.cid, epId: eid };
        } catch (_) {}
      }

      // 付费课程/cheese
      const cheese = location.pathname.match(/\/cheese\/play\/ep(\d+)/i);
      if (cheese) {
        const eid = cheese[1];
        try {
          const st = window.__INITIAL_STATE__ || {};
          if (st.epInfo?.bvid) return { bvid: st.epInfo.bvid, cid: st.epInfo.cid, epId: eid, isCheese: true };
          if (st.videoData?.bvid) return { bvid: st.videoData.bvid, cid: st.videoData.cid, epId: eid, isCheese: true };
        } catch (_) {}
        try {
          const r = await fetchWithTimeout(`https://api.bilibili.com/p/web/view/view?ep_id=${eid}`, { credentials: "include" });
          const j = await r.json();
          if (j?.data?.bvid) return { bvid: j.data.bvid, cid: j.data.cid, epId: eid, isCheese: true };
        } catch (_) {}
      }

      const ss = location.pathname.match(/\/bangumi\/play\/ss(\d+)/i);
      if (ss) {
        const sid = ss[1];
        try {
          if (window.__INITIAL_STATE__) {
            const s = window.__INITIAL_STATE__;
            if (s.epInfo?.bvid) return { bvid: s.epInfo.bvid, cid: s.epInfo.cid, epId: s.epInfo.id };
            if (s.epList?.length > 0) return { bvid: s.epList[0].bvid, cid: s.epList[0].cid, epId: s.epList[0].id };
          }
        } catch (_) {}
        try {
          const r = await fetchWithTimeout(`https://api.bilibili.com/pgc/view/web/season?season_id=${sid}`);
          const j = await r.json();
          const eps = (j?.result || {}).episodes || [];
          if (eps[0]) return { bvid: eps[0].bvid, cid: eps[0].cid, epId: eps[0].id };
        } catch (_) {}
      }

      try {
        const s = window.__INITIAL_STATE__ || {};
        if (s.bvid) return { bvid: s.bvid, cid: s.cid };
        if (s.epInfo?.bvid) return { bvid: s.epInfo.bvid, cid: s.epInfo.cid, epId: s.epInfo.id };
        if (s.videoData?.bvid) return { bvid: s.videoData.bvid, cid: s.videoData.cid };
      } catch (_) {}
      return null;
    };

    async function resolveBilibili(specificCid, specificEpId) {
      // 如果用户明确指定了 cid（分P选择器），优先使用，跳过自动检测
      const currentCid = specificCid ? null : getCurrentVideoCid();
      if (currentCid) {
        console.log('[BiliDown] Found current cid from:', currentCid.source, currentCid.cid);
        // 如果播放器有实时 cid，优先使用它来获取 dash
        const m = location.pathname.match(/\/video\/(BV[\w]+)/i);
        if (m) {
          const bvid = m[1];
          try {
            const pr = await fetchWithTimeout(`https://api.bilibili.com/x/player/playurl?cid=${currentCid.cid}&bvid=${bvid}&qn=120&fnval=4048&fourk=1`, { credentials: "include" });
            const pj = await pr.json();
            if (pj?.data?.dash) {
              console.log('[BiliDown] Using real-time cid:', currentCid.cid);
              return pj.data.dash;
            }
          } catch (_) {}
        }
        
        // 番剧使用 ep_id 方式（优先使用选择器指定的 epId，否则用当前 URL 的）
        const ep = location.pathname.match(/\/bangumi\/play\/ep(\d+)/i);
        const epId = specificEpId || (ep ? ep[1] : null);
        if (currentCid && epId) {
          try {
            const u = `https://api.bilibili.com/pgc/player/web/playurl?qn=120&fnval=4048&fourk=1&cid=${currentCid.cid}&ep_id=${epId}`;
            const pr = await fetchWithTimeout(u, { credentials: "include" });
            const pj = await pr.json();
            if (pj?.result?.dash || pj?.data?.dash) {
              console.log('[BiliDown] Using real-time cid for bangumi:', currentCid.cid, 'epId:', epId);
              return pj.result.dash || pj.data.dash;
            }
          } catch (_) {}
        }
      }

      // 回退：尝试从页面嵌入的 __playinfo__ 获取 dash（最可靠）
      // 注意：分P选择器指定了 specificCid 时，__playinfo__ 可能是初始页面的数据，不能直接用
      if (!specificCid) {
        const p = window.__playinfo__ || window.playinfo;
        if (p?.dash) return p.dash;

        try {
          const m = document.body.innerHTML.match(/window\.__playinfo__\s*=\s*({.*?})(?:;|\n)/);
          if (m) { const d = JSON.parse(m[1]); if (d.dash || d.data?.dash) return d.dash || d.data.dash; }
        } catch (_) {}
      }

      // 最后回退：使用 getBvid 获取 bvid/cid 然后请求 API
      const info = await getBvid();
      if (!info) return null;
      const bvid = info.bvid;
      // 选择器指定的 epId 优先级高于页面初始数据
      const epId = specificEpId || info.epId;
      let cid = specificCid || info.cid;

      if (!cid && bvid) {
        const vr = await fetchWithTimeout(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, { credentials: "include" });
        const vj = await vr.json();
        const vd = vj?.data || {};
        if (!specificCid && vd.pages?.length > 0) {
          const pi = parseInt(new URLSearchParams(location.search).get('p') || '1', 10) - 1;
          cid = vd.pages[pi]?.cid || vd.cid || vd.pages[0]?.cid || 0;
        } else cid = vd.cid || vd.pages?.[0]?.cid || 0;
      }
      if (!cid && !epId) return null;

      let dash = null;
      if (bvid && cid) {
        try {
          const pr = await fetchWithTimeout(`https://api.bilibili.com/x/player/playurl?cid=${cid}&bvid=${bvid}&qn=120&fnval=4048&fourk=1`, { credentials: "include" });
          const pj = await pr.json();
          if (pj?.data?.dash) dash = pj.data.dash;
        } catch (_) {}
      }
      if (!dash && (epId || (bvid && cid))) {
        let u = `https://api.bilibili.com/pgc/player/web/playurl?qn=120&fnval=4048&fourk=1`;
        if (epId) u += `&ep_id=${epId}`; else u += `&cid=${cid}&bvid=${bvid}`;
        try { const pr = await fetchWithTimeout(u, { credentials: "include" }); const pj = await pr.json(); if (pj?.result?.dash || pj?.data?.dash) dash = pj.result.dash || pj.data.dash; } catch (_) {}
      }
      // cheese 课程专用 API
      if (!dash && info?.isCheese && bvid && cid) {
        try {
          const u = `https://api.bilibili.com/p/player/playurl?cid=${cid}&bvid=${bvid}&qn=120&fnval=4048&fourk=1`;
          const pr = await fetchWithTimeout(u, { credentials: "include" });
          const pj = await pr.json();
          if (pj?.data?.dash) dash = pj.data.dash;
        } catch (_) {}
      }
      return dash;
    }

    // ============================================================
    // 5. Track Selection
    // ============================================================
    const getAllUrls = t => {
      if (!t) return [];
      const o = [];
      const p = u => { if (u && !o.includes(u)) o.push(u); };
      p(t.baseUrl || t.base_url || t.url);
      if (Array.isArray(t.backupUrl || t.backup_url)) for (const u of t.backupUrl || t.backup_url) p(u);
      return o;
    };

    const isHdr = x => {
      if (!x) return false;
      const id = Number(x.id || x.codecid || x.codecId || 0);
      if (id === 125 || id === 126 || id === 127) return true;
      const cs = String(x.color_space || x.colorSpace || "");
      if (/2020|bt2020/i.test(cs)) return true;
      if (/709|bt709/i.test(cs)) return false;
      const tc = x.transfer_characteristics ?? x.transferCharacteristics ?? x.trc ?? x.transfer ?? x.hdr_type ?? x.hdrType ?? 0;
      if (Number(tc) === 16 || Number(tc) === 18) return true;
      const sig = JSON.stringify({
        codecs: x.codecs, mimeType: x.mimeType, frameRate: x.frame_rate || x.frameRate,
        hdr: x.hdr || x.hdr_type || x.hdrType,
        dovi: x.dovi || x.dolby_vision || x.dolbyVision,
        color: cs || x.color_primaries || x.colorPrimaries || x.matrix_coefficients || x.matrixCoefficients
      });
      return /dolby|vision|dovi|dvhe|dvh1|hdr|hlg|pq|smpte2084|arib-std-b67|bt2020/i.test(sig);
    };

    const pickBestVideo = (arr, wantHdr) => {
      if (!arr?.length) return null;
      const nonDrm = arr.filter(x => { const v = x && (x.drm_tech_type ?? x.drmTechType ?? x.is_drm ?? x.isDrm); return !(Number(v) > 0 || v === true); });
      const pool = nonDrm.length ? nonDrm : arr;
      const sdr = pool.filter(x => !isHdr(x)), hdr = pool.filter(x => isHdr(x));
      // Use HDR/SDR pools if isHdr can distinguish; otherwise fall back to SDR pool then full pool
      let target = (hdr.length > 0 && sdr.length > 0) ? (wantHdr ? hdr : sdr) : (sdr.length ? sdr : pool);
      console.log('[pickVideo] wantHdr:', wantHdr, '| SDR:', sdr.length, '| HDR:', hdr.length, '| target:', target.length);
      const isHevc = x => x.codecid === 12 || /hev1|hvc1/i.test(String(x.codecs || ""));
      const isAvc = x => x.codecid === 7 || /avc1/i.test(String(x.codecs || ""));
      const isAv1 = x => x.codecid === 13 || /av01/i.test(String(x.codecs || ""));
      for (const arr of [target.filter(isHevc), target.filter(isAvc), target.filter(isAv1)]) {
        if (arr.length) {
          arr.sort((a,b) => (b.bandwidth||0)-(a.bandwidth||0));
          const chosen = arr[0];
          console.log('[pickVideo] Selected:', chosen.codecs, 'bw=', chosen.bandwidth);
          return chosen.baseUrl || chosen.base_url || chosen.url;
        }
      }
      target.sort((a,b) => (b.bandwidth||0)-(a.bandwidth||0));
      return target[0]?.baseUrl || target[0]?.base_url || target[0]?.url;
    };

    const pickBestAudio = arr => {
      if (!arr?.length) return { url: null, track: null, urls: [] };
      let best = null, urls = [];
      for (const t of arr) {
        const id = Number(t?.id)||0, bw = Number(t?.bandwidth)||0;
        const u0 = t && (t.baseUrl || t.base_url || t.url);
        if (!best || id > best.id || (id === best.id && bw > best.bw)) best = { id, bw, track: t, url: u0 };
        for (const u of getAllUrls(t)) if (u && !urls.includes(u)) urls.push(u);
      }
      return { url: best?.url, track: best?.track, urls };
    };

    const safeName = n => {
      if (!n) return "bilibili_video";
      let s = String(n);
      try { s = s.normalize('NFKC'); } catch (_) {}
      s = s.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "").replace(/[\u0000-\u001F\u007F]/g, "").replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim().replace(/[. ]+$/, "");
      return s || "bilibili_video";
    };

    // ============================================================
    // 6. Streaming Download (single file handle, progress tracking)
    // ============================================================
    const streamDownload = async ({ url, filename, onProgress }) => {
      if (!window.showSaveFilePicker) throw new Error(T.noStreamSave);
      const handle = await window.showSaveFilePicker({ suggestedName: filename });
      let writable;
      try { writable = await handle.createWritable({ keepExistingData: false }); }
      catch (_) { writable = await handle.createWritable(); }

      let res;
      try {
        res = await fetch(url, { credentials: "include", referrer: location.href, referrerPolicy: "strict-origin-when-cross-origin", signal });
        if (res?.status === 403) res = await fetch(url, { credentials: "omit", referrer: "https://www.bilibili.com/", referrerPolicy: "strict-origin-when-cross-origin", signal });
        if (!res?.ok || !res?.body) throw new Error("fetch_failed");
      } catch {
        res = await fetch(url, { credentials: "omit", referrer: "https://www.bilibili.com/", referrerPolicy: "strict-origin-when-cross-origin", signal });
      }

      const total = Number(res.headers.get("content-length")) || 0;
      const reader = res.body.getReader();
      let loaded = 0, lastUpdate = 0;
      const start = performance.now();

      while (true) {
        if (signal.aborted) { try { await writable.abort(); } catch (_) {} throw new Error("Aborted"); }
        const { done, value } = await reader.read();
        if (done) break;
        await writable.write(value);
        loaded += value.length;
        const now = performance.now();
        if (now - lastUpdate > 200) {
          lastUpdate = now;
          const elapsed = (now - start) / 1000;
          const speed = loaded / Math.max(0.1, elapsed);
          const pct = total ? (loaded / total) * 100 : 0;
          if (onProgress) onProgress({ loaded, total, speed, pct });
        }
      }
      await writable.close();
      return { loaded, total };
    };

    // ============================================================
    // 7. Streaming Merge (FFmpeg-free, sequential streams)
    // ============================================================
    const streamMerge = async ({ vUrl, aUrl, filename, vAllUrls, aAllUrls }) => {
      if (!window.showSaveFilePicker) {
        // Fallback: blob URL download for both (no file handle available)
        overlay.setStep(T.browserDl); overlay.setProgress(90);
        doSplitDownload(null, null, vAllUrls, aAllUrls, `${T.video}-${filename}.mp4`, `${T.audio}-${filename}.m4a`, null);
        return;
      }

      // IMPORTANT: Request file handle EARLY while user gesture is still active
      // showSaveFilePicker must be called in response to a user gesture
      let fileHandle;
      try {
        fileHandle = await window.showSaveFilePicker({
          suggestedName: `${T.video}-${filename}.mp4`,
          types: [{ description: 'MP4', accept: {'video/mp4': ['.mp4']} }]
        });
      } catch (e) {
        if (e.name === 'AbortError') { overlay.remove(); return; }
        throw e;
      }

      overlay.setStep(T.coreLoad);
      overlay.setDetail("正在评估文件大小...");

      // ============================================================
      // Quick HEAD probe to estimate file sizes BEFORE downloading
      // This ensures fast decision: merge or split, with NO wasted download time
      // ============================================================
      const probeSize = async (url) => {
        // Try HEAD first (fastest)
        try {
          const r = await fetch(url, { method: 'HEAD', credentials: 'include',
            referrer: location.href, referrerPolicy: 'strict-origin-when-cross-origin', signal });
          if (r.ok) { const cl = Number(r.headers.get('content-length')); if (cl) return cl; }
        } catch (e) { /* fall through */ }
        // Fallback: GET with Range: bytes=0-0 to get Content-Range header
        try {
          const r = await fetch(url, { headers: { 'Range': 'bytes=0-0' }, credentials: 'include',
            referrer: location.href, referrerPolicy: 'strict-origin-when-cross-origin', signal });
          if (r.ok || r.status === 206) {
            const cr = r.headers.get('content-range');
            if (cr) { const m = cr.match(/\/(\d+)/); if (m) return Number(m[1]); }
            const cl = Number(r.headers.get('content-length')); if (cl) return cl;
          }
        } catch (e) { /* fall through */ }
        // Fallback 2: try without credentials
        try {
          const r = await fetch(url, { method: 'HEAD', credentials: 'omit',
            referrer: 'https://www.bilibili.com/', referrerPolicy: 'strict-origin-when-cross-origin', signal });
          if (r.ok) { const cl = Number(r.headers.get('content-length')); if (cl) return cl; }
        } catch (e) { /* fall through */ }
        return 0; // Unknown size
      };

      // Dynamic merge threshold: conservative formula to ensure "yes = success"
      // Chrome WASM heap is ~4GB max; FFmpeg needs ~2.5x file size
      // 4GB RAM → 500MB, 8GB → 800MB, 16GB → 1.2GB, 32GB+ → 1.8GB
      const getMergeThreshold = () => {
        const memGB = navigator.deviceMemory;
        if (!memGB) { console.log("[SizeCheck] deviceMemory N/A, default 600MB"); return 600 * 1024 * 1024; }
        let mb;
        if (memGB >= 32) mb = 1800;
        else if (memGB >= 16) mb = 1200;
        else if (memGB >= 8) mb = 800;
        else mb = 500;
        console.log("[SizeCheck] deviceMemory:", memGB, "GB → threshold:", mb, "MB");
        return mb * 1024 * 1024;
      };
      const MAX_SIZE_FOR_MERGE = getMergeThreshold();

      // Probe video + audio sizes (fast HEAD requests, ~0.5s total)
      const [estVideoSize, estAudioSize] = await Promise.all([
        probeSize(vUrl).catch(() => 0),
        probeSize(aUrl).catch(() => 0)
      ]);
      const estTotalSize = estVideoSize + estAudioSize;
      console.log("[SizeCheck] Estimated: video", Math.round(estVideoSize/1024/1024), "MB | audio", Math.round(estAudioSize/1024/1024), "MB | total", Math.round(estTotalSize/1024/1024), "MB | threshold", Math.round(MAX_SIZE_FOR_MERGE/1024/1024), "MB");

      // Pre-download decision: if we can estimate and it's too large, split NOW (no wasted download)
      if (estTotalSize > 0 && estTotalSize > MAX_SIZE_FOR_MERGE) {
        console.log("[SizeCheck] Estimated total exceeds threshold → offering split download immediately");
        overlay.setStep(T.bigFile);
        overlay.setDetail(T.bigFileDetail);
        if (confirm(T.bigFileConfirm)) {
          (async () => {
            const afh = await acquireAudioHandle(`${T.audio}-${filename}.m4a`);
            doSplitDownload(null, null, vAllUrls, aAllUrls, `${T.video}-${filename}.mp4`, `${T.audio}-${filename}.m4a`, fileHandle, afh);
          })();
        } else {
          overlay.remove();
        }
        return;
      }

      // Request FFmpeg files from service worker via bridge (MAIN world cannot call chrome.runtime directly)
      const requestFFmpegFromSW = () => new Promise((resolve, reject) => {
        console.log("[FFmpeg] Requesting FFmpeg from service worker via bridge...");
        const requestId = 'ffmpeg_' + Date.now();
        const timeout = setTimeout(() => {
          window.removeEventListener('BILI_FFMPEG_RESPONSE', handler);
          reject(new Error("FFmpeg request timeout"));
        }, 25000);
        const handler = (e) => {
          if (e.detail?.requestId !== requestId) return;
          clearTimeout(timeout);
          window.removeEventListener('BILI_FFMPEG_RESPONSE', handler);
          if (e.detail?.success) {
            console.log("[FFmpeg] SW returned", e.detail.files.length, "files:", e.detail.files.map(f => f.path + "(" + f.size + "B)").join(", "));
            resolve({ files: e.detail.files, extId: e.detail.extId });
          } else {
            reject(new Error("SW error: " + (e.detail?.error || "unknown")));
          }
        };
        window.addEventListener('BILI_FFMPEG_RESPONSE', handler);
        window.dispatchEvent(new CustomEvent("BILI_TRIGGER_FFMPEG", { detail: { requestId } }));
      });

      // Load FFmpeg - request from service worker (the reliable path)
      const loadFFmpeg = async () => {
        console.log("[FFmpeg] Starting loadFFmpeg via service worker...");
        console.log("[FFmpeg] SharedArrayBuffer:", !!window.SharedArrayBuffer);

        // Load ffmpeg.min.js first via script tag with timeout
        const ffmpegUrl = window.__FFMPEG_URL__;
        if (ffmpegUrl && !window.FFmpeg) {
          console.log("[FFmpeg] Loading ffmpeg.min.js via script tag:", ffmpegUrl);
          await Promise.race([
            new Promise((res, rej) => {
              const s = document.createElement("script");
              s.src = ffmpegUrl;
              s.onload = () => { console.log("[FFmpeg] ffmpeg.min.js loaded OK"); res(); };
              s.onerror = (e) => { console.error("[FFmpeg] ffmpeg.min.js load error:", e); rej(new Error("ffmpeg.min.js failed")); };
              (document.head || document.documentElement).appendChild(s);
            }),
            new Promise((_, rej) => setTimeout(() => rej(new Error("ffmpeg.min.js load timeout")), 15000))
          ]);
        }
        if (!window.FFmpeg?.createFFmpeg) throw new Error("FFmpeg library not loaded");

        // Request core files from service worker to get extension ID
        const { files, extId } = await Promise.race([
          requestFFmpegFromSW(),
          new Promise((_, rej) => setTimeout(() => rej(new Error("SW request timeout")), 20000))
        ]);
        if (!files?.length || !extId) throw new Error("No FFmpeg files or extension ID from SW");

        // Determine MT vs ST
        const useMT = !!window.SharedArrayBuffer;
        const corePath = useMT ? 'ffmpeg/ffmpeg-core.js' : (files.find(f => f.path === 'ffmpeg/ffmpeg-core-st.js') ? 'ffmpeg/ffmpeg-core-st.js' : 'ffmpeg/ffmpeg-core.js');
        const wasmPath = useMT ? 'ffmpeg/ffmpeg-core.wasm' : (files.find(f => f.path === 'ffmpeg/ffmpeg-core-st.wasm') ? 'ffmpeg/ffmpeg-core-st.wasm' : 'ffmpeg/ffmpeg-core.wasm');

        console.log("[FFmpeg] Using", useMT ? "MT" : "ST", "core:", corePath, "wasm:", wasmPath, "extId:", extId);

        // Build extension URLs for direct loading (files are web_accessible_resources)
        const coreJsUrl = `chrome-extension://${extId}/${corePath}`;
        const wasmUrl = `chrome-extension://${extId}/${wasmPath}`;
        console.log("[FFmpeg] Core JS URL:", coreJsUrl);
        console.log("[FFmpeg] WASM URL:", wasmUrl);

        // Let ffmpeg.wasm handle loading — it will fetch core JS + WASM from our URLs
        // Do NOT pre-load ffmpeg-core.js as a script tag (was causing WASM to load from unpkg default)
        const createFFmpeg = window.FFmpeg.createFFmpeg;

        // Create FFmpeg with corePath/wasmPath pointing to extension URLs
        const ffmpeg = createFFmpeg({ corePath: coreJsUrl, wasmPath: wasmUrl, log: true });
        console.log("[FFmpeg] Calling ffmpeg.load()...");
        try {
          await Promise.race([
            ffmpeg.load(),
            new Promise((_, rej) => setTimeout(() => rej(new Error("ffmpeg.load() timeout")), 30000))
          ]);
          console.log("[FFmpeg] FFmpeg loaded successfully!");
          return ffmpeg;
        } catch (e) {
          console.error("[FFmpeg] ffmpeg.load() failed:", e);
          throw e;
        }
      };

      // Fetch into memory with backup URL support
      const fetchBin = async (urls, label) => {
        if (!Array.isArray(urls)) urls = [urls];
        overlay.setStep(`${T.dlStep}${label}...`);
        console.log(`[FetchBin] ${label} URLs to try:`, urls);
        
        let lastError = null;
        for (let i = 0; i < urls.length; i++) {
          const url = urls[i];
          try {
            console.log(`[FetchBin] Trying ${label} URL ${i + 1}/${urls.length}`);
            let res;
            try {
              // First try with credentials (same as streamDownload)
              res = await fetch(url, { credentials: "include", referrer: location.href, referrerPolicy: "strict-origin-when-cross-origin", signal });
              if (res?.status === 403 || !res?.ok) {
                // If 403 or failed, try without credentials
                console.log(`[FetchBin] First attempt failed, trying without credentials`);
                res = await fetch(url, { credentials: "omit", referrer: "https://www.bilibili.com/", referrerPolicy: "strict-origin-when-cross-origin", signal });
              }
            } catch (e) {
              console.warn(`[FetchBin] First fetch attempt failed:`, e);
              // Fallback to without credentials
              res = await fetch(url, { credentials: "omit", referrer: "https://www.bilibili.com/", referrerPolicy: "strict-origin-when-cross-origin", signal });
            }
            
            if (!res?.ok || !res?.body) throw new Error(`${label} fetch failed, status: ${res?.status}`);

            const total = Number(res.headers.get("content-length")) || 0;
            console.warn(`[FetchBin] ${label} Content-Length:`, Math.round(total/1024/1024), "MB | Threshold:", Math.round(MAX_SIZE_FOR_MERGE/1024/1024), "MB");
            // Early abort: if a single track already exceeds merge threshold, don't waste time downloading
            if (total > 0 && total > MAX_SIZE_FOR_MERGE) {
              console.warn(`[FetchBin] ${label} alone (${Math.round(total/1024/1024)}MB) exceeds threshold → aborting download`);
              throw new Error(`FILE_TOO_LARGE:${label}:${total}`);
            }
            const reader = res.body.getReader();
            const chunks = []; let loaded = 0;
            const start = performance.now(); let lastUpd = 0;
            while (true) {
              if (signal.aborted) throw new Error("Aborted");
              const { done, value } = await reader.read();
              if (done) break;
              chunks.push(value); loaded += value.length;
              const now = performance.now();
              if (now - lastUpd > 200) {
                lastUpd = now;
                const elapsed = (now - start) / 1000;
                const pct = total ? (loaded / total) * 100 : 0;
                overlay.setDetail(`${label}: ${fmtBytes(loaded)} / ${fmtBytes(total)} (${fmtBytes(loaded/Math.max(0.1,elapsed))}/s) ${pct.toFixed(0)}%`);
              }
            }
            const buf = new Uint8Array(loaded);
            let off = 0; for (const c of chunks) { buf.set(c, off); off += c.length; }
            console.log(`[FetchBin] ${label} download OK, size: ${buf.byteLength} bytes`);
            return buf;
          } catch (e) {
            lastError = e;
            console.error(`[FetchBin] ${label} URL ${i + 1} failed:`, e);
            if (signal.aborted) throw e;
          }
        }
        console.error(`[FetchBin] All ${label} URLs failed`);
        throw lastError || new Error(`${label} fetch failed`);
      };

      // First try to merge in memory
      let vBin, aBin;
      try {
        overlay.setStep(`${T.dlStep}${T.video}...`);
        overlay.setProgress(5);
        vBin = await fetchBin(vAllUrls, T.video);

        overlay.setProgress(45);
        overlay.setStep(`${T.dlStep}${T.audio}...`);
        aBin = await fetchBin(aAllUrls, T.audio);
      } catch(e) {
        if (e?.message === "Aborted") throw e;
        // FILE_TOO_LARGE: Content-Length header already exceeds threshold → split immediately
        if (String(e?.message || '').startsWith('FILE_TOO_LARGE:')) {
          console.warn("[SizeCheck] fetchBin aborted early:", e.message);
          overlay.setStep(T.bigFile); overlay.setDetail(T.bigFileDetail);
          if (confirm(T.bigFileConfirm)) {
            (async () => {
              const afh = await acquireAudioHandle(`${T.audio}-${filename}.m4a`);
              doSplitDownload(null, null, vAllUrls, aAllUrls, `${T.video}-${filename}.mp4`, `${T.audio}-${filename}.m4a`, fileHandle, afh);
            })();
          } else {
            overlay.remove();
          }
          return;
        }
        console.error("[BiliDown] Fetch failed, falling back to separate download:", e);
        overlay.setStep(T.errTitle);
        overlay.setDetail("下载失败，是否尝试分别下载？");
        if (confirm(T.mergeFailConfirm.replace("{msg}", e?.message || "下载失败"))) {
          (async () => {
            const afh = await acquireAudioHandle(`${T.audio}-${filename}.m4a`);
            doSplitDownload(null, null, vAllUrls, aAllUrls, `${T.video}-${filename}.mp4`, `${T.audio}-${filename}.m4a`, fileHandle, afh);
          })();
        } else {
          overlay.remove();
        }
        return;
      }

      // Safety net: always check actual downloaded size against threshold
      // HEAD probe may fail or return inaccurate values on some CDNs
      const actualTotalSize = vBin.byteLength + aBin.byteLength;
      if (actualTotalSize > MAX_SIZE_FOR_MERGE) {
        console.log("[SizeCheck] Actual size", Math.round(actualTotalSize/1024/1024), "MB exceeds threshold", Math.round(MAX_SIZE_FOR_MERGE/1024/1024), "MB → split");
        overlay.setStep(T.bigFile); overlay.setDetail(T.bigFileDetail);
        if (confirm(T.bigFileConfirm)) {
          (async () => {
            const afh = await acquireAudioHandle(`${T.audio}-${filename}.m4a`);
            doSplitDownload(vBin, aBin, null, null, `${T.video}-${filename}.mp4`, `${T.audio}-${filename}.m4a`, fileHandle, afh);
          })();
        } else {
          overlay.remove();
        }
        return;
      }

      overlay.setStep(T.merge);
      overlay.setProgress(85);

      try {
        const ffmpeg = await loadFFmpeg();
        ffmpeg.FS("writeFile", "v.m4s", vBin);
        ffmpeg.FS("writeFile", "a.m4s", aBin);
        await ffmpeg.run("-i", "v.m4s", "-i", "a.m4s", "-c", "copy", "out.mp4");
        const out = ffmpeg.FS("readFile", "out.mp4");
        ffmpeg.FS("unlink", "out.mp4"); ffmpeg.FS("unlink", "v.m4s"); ffmpeg.FS("unlink", "a.m4s");
        vBin = null; aBin = null;

        // Save via File System Access API (handle obtained early)
        overlay.setStep(T.saveFile);
        try {
          const w = await fileHandle.createWritable();
          await w.write(out);
          await w.close();
        } catch (e) {
          console.warn("[FFmpeg] File handle write failed, falling back to blob:", e);
          const mergedBin = out;
          overlay.setStep(T.browserDl); overlay.setProgress(90);
          overlay.setDetail("文件保存失败，尝试浏览器下载...");
          saveBlob(mergedBin, `${T.video}-${filename}.mp4`);
          overlay.setStep(T.dlDone); overlay.setProgress(100); overlay.done();
          setTimeout(() => overlay.remove(), 5000);
          return;
        }

        overlay.setStep(T.dlDone);
        overlay.setProgress(100);
        overlay.done();
        setTimeout(() => overlay.remove(), 5000);
        return;
      } catch(e) {
        console.warn("[FFmpeg] Merge failed:", e);
        if (e?.name === 'AbortError' || e?.message === 'Aborted' || signal?.aborted) {
          overlay.setStep(T.canceled); setTimeout(() => overlay.remove(), 2000); return;
        }
        var ffmpegError = e;
      }

      // If merge failed, offer separate download via blob URL (data already in memory)
      overlay.setStep(T.errTitle);
      const isOOM = /Array buffer allocation|out of memory|Cannot allocate/i.test(String(ffmpegError?.message || ''));
      overlay.setDetail(isOOM ? "内存不足，无法合并。请分别下载视频和音频。" : "合并失败，是否分别下载视频和音频？");
      if (confirm(T.mergeFailConfirm.replace("{msg}", isOOM ? "内存不足" : "合并过程出错"))) {
        (async () => {
          const afh = await acquireAudioHandle(`${T.audio}-${filename}.m4a`);
          doSplitDownload(vBin, aBin, null, null, `${T.video}-${filename}.mp4`, `${T.audio}-${filename}.m4a`, fileHandle, afh);
        })();
      } else {
        overlay.remove();
      }
    };

    // Download via blob URL — works for small files (<500MB), no user gesture needed
    const saveBlob = (data, suggestedName, callback) => {
      console.log('[SaveBlob] Creating:', suggestedName, Math.round(data.byteLength/1024/1024), 'MB');
      const blob = new Blob([data], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none'; a.href = url; a.download = suggestedName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch (_) {} }, 120000);
      console.log('[SaveBlob] Triggered:', suggestedName);
      if (callback) callback();
    };

    // Fetch URL(s) into blob with progress
    const fetchToBlob = async (urls, name) => {
      if (!Array.isArray(urls)) urls = [urls];
      for (const url of urls) {
        try {
          overlay.setDetail(`${name}: 下载中...`);
          const res = await fetch(url, { credentials: 'include', referrer: location.href, referrerPolicy: 'strict-origin-when-cross-origin', signal });
          if (!res.ok) continue;
          const total = Number(res.headers.get('content-length')) || 0;
          const reader = res.body.getReader();
          const chunks = []; let loaded = 0; const start = performance.now();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value); loaded += value.length;
            const elapsed = (performance.now() - start) / 1000;
            const pct = total ? `${Math.round(loaded/total*100)}%` : '';
            overlay.setDetail(`${name}: ${fmtBytes(loaded)}/${fmtBytes(total)} ${pct}`);
          }
          const buf = new Uint8Array(loaded);
          let off = 0; for (const c of chunks) { buf.set(c, off); off += c.length; }
          overlay.setDetail(`${name}: 保存中...`);
          saveBlob(buf, name);
          return;
        } catch (e) { console.warn('[FetchBlob] URL failed:', e); }
      }
    };

    // Shared progress state — video + audio combined into one overlay line
    const _prog = { v: '', a: '' };
    const _updateDetail = () => {
      let line = '';
      if (_prog.v) line += _prog.v;
      if (_prog.a) line += (line ? ' | ' : '') + _prog.a;
      overlay.setDetail(line || '下载中...');
    };

    // Stream with progress — pipes fetch body to file handle with overlay progress updates
    let _lastProgressUpdate = 0;
    const streamWithProgress = async (res, writable, label, totalSize) => {
      const reader = res.body.getReader();
      const start = performance.now();
      let loaded = 0;
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        loaded += value.length;
        chunks.push(value);
        if (chunks.reduce((s, c) => s + c.length, 0) > 64 * 1024 * 1024) {
          const merged = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0));
          let off = 0; for (const c of chunks) { merged.set(c, off); off += c.length; }
          chunks.length = 0;
          await writable.write(merged);
        }
        const now = performance.now();
        if (now - _lastProgressUpdate > 200) {
          _lastProgressUpdate = now;
          const elapsed = Math.max(0.1, (now - start) / 1000);
          const pct = totalSize ? Math.round(loaded / totalSize * 100) : 0;
          _prog.v = `${label}: ${fmtBytes(loaded)}/${fmtBytes(totalSize)} (${fmtBytes(loaded/elapsed)}/s) ${pct}%`;
          _updateDetail();
        }
      }
      if (chunks.length > 0) {
        const merged = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0));
        let off = 0; for (const c of chunks) { merged.set(c, off); off += c.length; }
        await writable.write(merged);
      }
      await writable.close();
      _prog.v = `${label}: ✓ ${fmtBytes(loaded)}`;
      _updateDetail();
    };

    // Acquire an audio save handle in the same user gesture as the split confirm,
    // so audio lands beside the video (user-chosen folder) instead of the default dir.
    // Returns null if unsupported / user cancels — caller falls back to blob.
    const acquireAudioHandle = async (aName) => {
      if (!window.showSaveFilePicker) return null;
      try {
        return await window.showSaveFilePicker({
          suggestedName: aName,
          types: [{ description: 'M4A', accept: {'audio/mp4': ['.m4a', '.m4s']} }]
        });
      } catch (e) {
        if (e?.name === 'AbortError') return null; // user cancelled audio dialog
        throw e;
      }
    };

    // Unified split download — handles all scenarios
    // afh = optional audio file handle; when provided, audio is written there
    // (follows the video's chosen location) instead of the browser default dir.
    const doSplitDownload = (vData, aData, vUrls, aUrls, vName, aName, fh, afh = null) => {
      overlay.setStep(T.browserDl); overlay.setProgress(90);
      _prog.v = ''; _prog.a = '';
      let _done = 0;
      const _checkDone = () => { _done++; if (_done >= 2) { overlay.setProgress(100); overlay.done(); } };
      if (!fh) {
        console.warn('[Split] No fileHandle, using blob fallback');
        // Download video and audio via blob URLs (no file handle available)
        if (vData) { saveBlob(vData, vName || 'fallback.mp4'); _checkDone(); }
        else if (vUrls) fetchToBlob(vUrls, vName || 'fallback.mp4').then(_checkDone);
        if (aData) { saveBlob(aData, aName || 'fallback.m4a'); _checkDone(); }
        else if (aUrls) setTimeout(() => fetchToBlob(aUrls, aName || 'fallback.m4a').then(_checkDone), 500);
        return;
      }
      // Video — prefer fileHandle, stream to disk
      if (vData) {
        (async () => {
          try {
            _prog.v = `${T.video}: 写入中... ${fmtBytes(vData.byteLength)}`;
            _updateDetail();
            const w = await fh.createWritable();
            await w.write(vData);
            await w.close();
            _prog.v = `${T.video}: ✓`;
            _updateDetail(); _checkDone();
          } catch (e) { console.error('[Split] Video handle write FAILED:', e); saveBlob(vData, vName); _checkDone(); }
        })();
      } else {
        (async () => {
          const urls = Array.isArray(vUrls) ? vUrls : [vUrls];
          for (const url of urls) {
            try {
              if (signal.aborted) throw new Error("Aborted");
              let res;
              try {
                res = await fetch(url, { credentials: 'include', referrer: location.href, referrerPolicy: 'strict-origin-when-cross-origin', signal });
                if (res?.status === 403 || !res?.ok) {
                  res = await fetch(url, { credentials: 'omit', referrer: 'https://www.bilibili.com/', referrerPolicy: 'strict-origin-when-cross-origin', signal });
                }
              } catch (e) {
                res = await fetch(url, { credentials: 'omit', referrer: 'https://www.bilibili.com/', referrerPolicy: 'strict-origin-when-cross-origin', signal });
              }
              const total = Number(res.headers.get('content-length')) || 0;
              if (!res.ok || !res.body) continue;
              const w = await fh.createWritable();
              _prog.v = `${T.video}: 0/${fmtBytes(total)}`;
              _updateDetail();
              await streamWithProgress(res, w, T.video, total);
              _checkDone();
              return;
            } catch (e) {
              if (e?.message === 'Aborted' || signal.aborted) { overlay.remove(); return; }
              console.error('[Split] Video URL FAILED:', e.message || e);
            }
          }
          _prog.v = `${T.video}: 所有 URL 失败`;
          _updateDetail(); _checkDone();
        })();
      }
      // Audio — written to afh (chosen folder) when available, else blob default dir
      setTimeout(() => {
        const audioDone = () => { _prog.a = `${T.audio}: ✓`; _updateDetail(); _checkDone(); };
        const audioBlobFallback = () => {
          if (aData) { _prog.a = `${T.audio}: 保存中...`; _updateDetail(); saveBlob(aData, aName, audioDone); }
          else {
            if (!Array.isArray(aUrls)) aUrls = [aUrls];
            _prog.a = `${T.audio}: 下载中...`;
            _updateDetail();
            (async () => {
              for (const url of aUrls) {
                try {
                  const res = await fetch(url, { credentials: 'include', referrer: location.href, referrerPolicy: 'strict-origin-when-cross-origin', signal });
                  if (!res.ok) continue;
                  const total = Number(res.headers.get('content-length')) || 0;
                  const reader = res.body.getReader();
                  const chunks = []; let loaded = 0; const start = performance.now();
                  while (true) {
                    if (signal.aborted) throw new Error("Aborted");
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value); loaded += value.length;
                    const elapsed = (performance.now() - start) / 1000;
                    const pct = total ? ` ${Math.round(loaded/total*100)}%` : '';
                    _prog.a = `${T.audio}: ${fmtBytes(loaded)}/${fmtBytes(total)}${pct}`;
                    _updateDetail();
                  }
                  const buf = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0));
                  let off = 0; for (const c of chunks) { buf.set(c, off); off += c.length; }
                  _prog.a = `${T.audio}: 触发下载...`;
                  _updateDetail();
                  saveBlob(buf, aName, audioDone);
                  return;
                } catch (e) {
                  if (e?.message === 'Aborted' || signal.aborted) { overlay.remove(); return; }
                  console.warn('[Audio] URL failed:', e);
                }
              }
              audioDone();
            })();
          }
        };
        // If we have an audio handle, write to it; else fall back to blob.
        if (afh) {
          if (aData) {
            _prog.a = `${T.audio}: 写入中... ${fmtBytes(aData.byteLength)}`; _updateDetail();
            (async () => {
              try {
                const w = await afh.createWritable();
                await w.write(aData);
                await w.close();
                audioDone();
              } catch (e) { console.error('[Split] Audio handle write FAILED:', e); audioBlobFallback(); }
            })();
          } else {
            if (!Array.isArray(aUrls)) aUrls = [aUrls];
            _prog.a = `${T.audio}: 下载中...`; _updateDetail();
            (async () => {
              for (const url of aUrls) {
                try {
                  if (signal.aborted) throw new Error("Aborted");
                  const res = await fetch(url, { credentials: 'include', referrer: location.href, referrerPolicy: 'strict-origin-when-cross-origin', signal });
                  if (!res.ok) continue;
                  const total = Number(res.headers.get('content-length')) || 0;
                  const w = await afh.createWritable();
                  const reader = res.body.getReader();
                  let loaded = 0; const start = performance.now();
                  while (true) {
                    if (signal.aborted) { try { await w.abort(); } catch (_) {} throw new Error("Aborted"); }
                    const { done, value } = await reader.read();
                    if (done) break;
                    await w.write(value); loaded += value.length;
                    const elapsed = (performance.now() - start) / 1000;
                    const pct = total ? ` ${Math.round(loaded/total*100)}%` : '';
                    _prog.a = `${T.audio}: ${fmtBytes(loaded)}/${fmtBytes(total)}${pct}`;
                    _updateDetail();
                  }
                  await w.close();
                  audioDone();
                  return;
                } catch (e) {
                  if (e?.message === 'Aborted' || signal.aborted) { overlay.remove(); return; }
                  console.warn('[Audio] URL failed:', e);
                  audioBlobFallback();
                  return;
                }
              }
              audioDone();
            })();
          }
        } else {
          audioBlobFallback();
        }
      }, 500);
    };

    window.addEventListener("BILI_DOWNLOAD_ERROR", e => {
      overlay.setStep(T.dlFailTitle);
      overlay.setDetail(e?.detail?.message || T.dlFail);
      overlay.done();
    });

    // ============================================================
    // 7b. Batch Download Flow (合集批量下载)
    // 方案 A(目录式) + C(blob 兜底):一次 showDirectoryPicker 拿目录,
    // 串行下载每集写入该目录;无目录句柄则退回浏览器默认下载目录逐个 blob。
    // 不复用 streamMerge(它含 confirm 弹窗与 fire-and-forget 分流,不适合批量循环),
    // 而是自包含实现:fetchBinBatch + FFmpeg 合并 + 写目录 / 流式分轨。
    // ============================================================
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    const getMergeThresholdBatch = () => {
      const memGB = navigator.deviceMemory;
      if (!memGB) return 600 * 1024 * 1024;
      let mb;
      if (memGB >= 32) mb = 1800; else if (memGB >= 16) mb = 1200;
      else if (memGB >= 8) mb = 800; else mb = 500;
      return mb * 1024 * 1024;
    };
    const BATCH_MERGE_THRESHOLD = getMergeThresholdBatch();

    // FFmpeg 单例(批量循环复用,避免每集重新加载 24MB WASM)
    let _batchFFmpeg = null;
    const loadBatchFFmpeg = async () => {
      if (_batchFFmpeg) return _batchFFmpeg;
      const ffmpegUrl = window.__FFMPEG_URL__;
      if (ffmpegUrl && !window.FFmpeg) {
        await Promise.race([
          new Promise((res, rej) => {
            const s = document.createElement("script");
            s.src = ffmpegUrl;
            s.onload = () => { console.log("[Batch FFmpeg] ffmpeg.min.js loaded"); res(); };
            s.onerror = () => rej(new Error("ffmpeg.min.js failed"));
            (document.head || document.documentElement).appendChild(s);
          }),
          new Promise((_, rej) => setTimeout(() => rej(new Error("ffmpeg.min.js load timeout")), 15000))
        ]);
      }
      if (!window.FFmpeg?.createFFmpeg) throw new Error("FFmpeg library not loaded");

      const requestFFmpegFromSW = () => new Promise((resolve, reject) => {
        const requestId = 'ffmpeg_batch_' + Date.now();
        const timeout = setTimeout(() => { window.removeEventListener('BILI_FFMPEG_RESPONSE', handler); reject(new Error("FFmpeg request timeout")); }, 25000);
        const handler = (e) => {
          if (e.detail?.requestId !== requestId) return;
          clearTimeout(timeout);
          window.removeEventListener('BILI_FFMPEG_RESPONSE', handler);
          if (e.detail?.success) resolve({ files: e.detail.files, extId: e.detail.extId });
          else reject(new Error("SW error: " + (e.detail?.error || "unknown")));
        };
        window.addEventListener('BILI_FFMPEG_RESPONSE', handler);
        window.dispatchEvent(new CustomEvent("BILI_TRIGGER_FFMPEG", { detail: { requestId } }));
      });
      const { files, extId } = await Promise.race([
        requestFFmpegFromSW(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("SW request timeout")), 20000))
      ]);
      if (!files?.length || !extId) throw new Error("No FFmpeg files or extension ID from SW");
      const useMT = !!window.SharedArrayBuffer;
      const corePath = useMT ? 'ffmpeg/ffmpeg-core.js' : (files.find(f => f.path === 'ffmpeg/ffmpeg-core-st.js') ? 'ffmpeg/ffmpeg-core-st.js' : 'ffmpeg/ffmpeg-core.js');
      const wasmPath = useMT ? 'ffmpeg/ffmpeg-core.wasm' : (files.find(f => f.path === 'ffmpeg/ffmpeg-core-st.wasm') ? 'ffmpeg/ffmpeg-core-st.wasm' : 'ffmpeg/ffmpeg-core.wasm');
      console.log("[Batch FFmpeg] Using", useMT ? "MT" : "ST", "core");
      const ffmpeg = window.FFmpeg.createFFmpeg({
        corePath: `chrome-extension://${extId}/${corePath}`,
        wasmPath: `chrome-extension://${extId}/${wasmPath}`,
        log: true
      });
      await Promise.race([ffmpeg.load(), new Promise((_, rej) => setTimeout(() => rej(new Error("ffmpeg.load() timeout")), 30000))]);
      console.log("[Batch FFmpeg] loaded OK");
      _batchFFmpeg = ffmpeg;
      return _batchFFmpeg;
    };

    // 下载到内存(带进度),逻辑同 streamMerge.fetchBin
    const fetchBinBatch = async (urls, label) => {
      if (!Array.isArray(urls)) urls = [urls];
      let lastError = null;
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        try {
          let res;
          try {
            res = await fetch(url, { credentials: "include", referrer: location.href, referrerPolicy: "strict-origin-when-cross-origin", signal });
            if (res?.status === 403 || !res?.ok) res = await fetch(url, { credentials: "omit", referrer: "https://www.bilibili.com/", referrerPolicy: "strict-origin-when-cross-origin", signal });
          } catch (e) {
            res = await fetch(url, { credentials: "omit", referrer: "https://www.bilibili.com/", referrerPolicy: "strict-origin-when-cross-origin", signal });
          }
          if (!res?.ok || !res?.body) throw new Error(`${label} fetch failed, status: ${res?.status}`);
          const total = Number(res.headers.get("content-length")) || 0;
          if (total > 0 && total > BATCH_MERGE_THRESHOLD) throw new Error(`FILE_TOO_LARGE:${label}:${total}`);
          const reader = res.body.getReader();
          const chunks = []; let loaded = 0; const start = performance.now(); let lastUpd = 0;
          while (true) {
            if (signal.aborted) throw new Error("Aborted");
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value); loaded += value.length;
            const now = performance.now();
            if (now - lastUpd > 200) {
              lastUpd = now;
              const elapsed = (now - start) / 1000;
              const pct = total ? (loaded / total) * 100 : 0;
              overlay.setDetail(`${label}: ${fmtBytes(loaded)}/${fmtBytes(total)} (${fmtBytes(loaded/Math.max(0.1,elapsed))}/s) ${pct.toFixed(0)}%`);
            }
          }
          const buf = new Uint8Array(loaded);
          let off = 0; for (const c of chunks) { buf.set(c, off); off += c.length; }
          return buf;
        } catch (e) {
          lastError = e;
          if (signal.aborted) throw e;
        }
      }
      throw lastError || new Error(`${label} fetch failed`);
    };

    // 写入目录(或 blob 兜底)
    const writeToDir = async (dirHandle, name, data) => {
      if (dirHandle) {
        try {
          const fh = await dirHandle.getFileHandle(name, { create: true });
          const w = await fh.createWritable();
          await w.write(data);
          await w.close();
          return true;
        } catch (e) { console.warn('[Batch] dir write failed, blob fallback:', name, e); }
      }
      saveBlob(data, name);
      return false;
    };

    // 流式写入目录(大文件边下边写,避免 OOM);无目录则读入内存 blob 兜底
    const streamToDir = async (urls, dirHandle, name, label) => {
      if (!Array.isArray(urls)) urls = [urls];
      for (const url of urls) {
        try {
          if (signal.aborted) throw new Error("Aborted");
          let res;
          try {
            res = await fetch(url, { credentials: "include", referrer: location.href, referrerPolicy: "strict-origin-when-cross-origin", signal });
            if (res?.status === 403 || !res?.ok) res = await fetch(url, { credentials: "omit", referrer: "https://www.bilibili.com/", referrerPolicy: "strict-origin-when-cross-origin", signal });
          } catch (e) {
            res = await fetch(url, { credentials: "omit", referrer: "https://www.bilibili.com/", referrerPolicy: "strict-origin-when-cross-origin", signal });
          }
          const total = Number(res.headers.get("content-length")) || 0;
          if (!res.ok || !res.body) continue;
          let writable = null;
          if (dirHandle) {
            const fh = await dirHandle.getFileHandle(name, { create: true });
            writable = await fh.createWritable();
          }
          const reader = res.body.getReader();
          const chunks = []; let loaded = 0; const start = performance.now(); let lastUpd = 0;
          while (true) {
            if (signal.aborted) { try { await writable?.abort(); } catch (_) {} throw new Error("Aborted"); }
            const { done, value } = await reader.read();
            if (done) break;
            if (writable) await writable.write(value);
            else chunks.push(value);
            loaded += value.length;
            const now = performance.now();
            if (now - lastUpd > 200) {
              lastUpd = now;
              const elapsed = (now - start) / 1000;
              const pct = total ? (loaded / total) * 100 : 0;
              _prog.v = `${label}: ${fmtBytes(loaded)}/${fmtBytes(total)} ${pct.toFixed(0)}%`;
              _updateDetail();
            }
          }
          if (writable) { await writable.close(); }
          else {
            const buf = new Uint8Array(loaded);
            let off = 0; for (const c of chunks) { buf.set(c, off); off += c.length; }
            saveBlob(buf, name);
          }
          _prog.v = `${label}: ✓`; _updateDetail();
          return true;
        } catch (e) {
          if (e?.message === 'Aborted' || signal.aborted) throw e;
          console.warn(`[Batch] stream ${label} URL failed:`, e);
        }
      }
      return false;
    };

    // HEAD/Range 探测单轨道大小
    const probeSizeBatch = async (url) => {
      try {
        const r = await fetch(url, { method: 'HEAD', credentials: 'include', referrer: location.href, referrerPolicy: 'strict-origin-when-cross-origin', signal });
        if (r.ok) { const cl = Number(r.headers.get('content-length')); if (cl) return cl; }
      } catch (_) {}
      try {
        const r = await fetch(url, { headers: { 'Range': 'bytes=0-0' }, credentials: 'include', referrer: location.href, referrerPolicy: 'strict-origin-when-cross-origin', signal });
        if (r.ok || r.status === 206) { const cr = r.headers.get('content-range'); if (cr) { const m = cr.match(/\/(\d+)/); if (m) return Number(m[1]); } }
      } catch (_) {}
      return 0;
    };

    // 下载单集到目录(或 blob 兜底)。返回 true=成功 false=失败
    const batchDownloadEpisode = async (ep, epIdx, total, dirHandle, collectionTitle) => {
      overlay.setBatchInfo(`${T.batchDl}: ${epIdx+1}/${total} - ${ep.title || ''}`);
      overlay.setBatchProgress(Math.round(epIdx / total * 100));
      overlay.setProgress(0);

      // 1. 解析 dash
      overlay.setStep(T.parse);
      let dash;
      try {
        dash = await Promise.race([resolveEpisodeDash(ep), new Promise((_, r) => setTimeout(() => r(new Error("超时")), 15000))]);
      } catch (e) { console.warn('[Batch] resolve failed:', ep.title, e); return false; }
      if (!dash?.video?.length || !dash?.audio?.length) { console.warn('[Batch] no dash:', ep.title); return false; }

      // 2. 选轨
      const vUrl = pickBestVideo(dash.video, preferHDR);
      const aPick = pickBestAudio(dash.audio);
      const aUrl = aPick.url;
      const vTrack = (dash.video || []).find(x => (x.baseUrl||x.base_url||x.url) === vUrl) || dash.video[0];
      let vAllUrls = getAllUrls(vTrack);
      const vPool = (dash.video || []).filter(x => preferHDR ? isHdr(x) : !isHdr(x));
      for (const t of vPool) for (const u of getAllUrls(t)) if (!vAllUrls.includes(u)) vAllUrls.push(u);
      let aAllUrls = aPick.urls?.length ? aPick.urls : getAllUrls(aPick.track || dash.audio[0]);
      for (const t of dash.audio || []) for (const u of getAllUrls(t)) if (!aAllUrls.includes(u)) aAllUrls.push(u);
      if (!vUrl || !aUrl) return false;

      // 3. 文件名
      const epTitle = await getEpTitle(ep);
      const base = safeName(collectionTitle || 'bilibili');
      const fname = `${base}_P${epIdx+1}_${safeName(epTitle)}`;

      // 4. 探测大小
      const [vSize, aSize] = await Promise.all([probeSizeBatch(vUrl).catch(()=>0), probeSizeBatch(aUrl).catch(()=>0)]);
      const estTotal = vSize + aSize;

      // 4b. blob 兜底模式(无目录句柄)下,大文件没法流式写盘(a.download 需要完整 Blob),
      //    硬读内存会 OOM。改为跳过 + 提示用户选目录。
      if (!dirHandle && estTotal > 0 && estTotal > BATCH_MERGE_THRESHOLD) {
        overlay.setStep(T.batchTooLarge);
        overlay.setDetail(T.batchBlobTooLarge);
        console.warn('[Batch] ep too large for blob fallback, skipping:', ep.title, fmtBytes(estTotal));
        return false;
      }

      // 5a. 大文件 → 分轨流式写入目录(仅 dirHandle 模式;blob 模式已在 4b 拦截)
      if (estTotal > 0 && estTotal > BATCH_MERGE_THRESHOLD) {
        overlay.setStep(T.batchTooLarge);
        _prog.v = ''; _prog.a = '';
        const vOk = await streamToDir(vAllUrls, dirHandle, `${T.video}-${fname}.mp4`, T.video);
        if (signal.aborted) throw new Error("Aborted");
        const aOk = await streamToDir(aAllUrls, dirHandle, `${T.audio}-${fname}.m4a`, T.audio);
        return vOk && aOk;
      }

      // 5b. 小文件 → 内存合并
      overlay.setStep(`${T.dlStep}${T.video}...`);
      let vBin, aBin;
      try {
        vBin = await fetchBinBatch(vAllUrls, T.video);
        overlay.setStep(`${T.dlStep}${T.audio}...`);
        aBin = await fetchBinBatch(aAllUrls, T.audio);
      } catch (e) {
        if (e?.message === 'Aborted' || signal.aborted) throw e;
        console.warn('[Batch] fetchBin failed, splitting:', e);
        // 无目录句柄时不能流式分轨(会 OOM),跳过该集
        if (!dirHandle) {
          overlay.setStep(T.batchTooLarge);
          overlay.setDetail(T.batchBlobTooLarge);
          return false;
        }
        const vOk = await streamToDir(vAllUrls, dirHandle, `${T.video}-${fname}.mp4`, T.video);
        if (signal.aborted) throw new Error("Aborted");
        const aOk = await streamToDir(aAllUrls, dirHandle, `${T.audio}-${fname}.m4a`, T.audio);
        return vOk && aOk;
      }

      // 实际大小超阈值 → 分轨写(此时数据已在内存,writeToDir 不再累积)
      if (vBin.byteLength + aBin.byteLength > BATCH_MERGE_THRESHOLD) {
        overlay.setStep(T.batchTooLarge);
        const vOk = await writeToDir(dirHandle, `${T.video}-${fname}.mp4`, vBin);
        const aOk = await writeToDir(dirHandle, `${T.audio}-${fname}.m4a`, aBin);
        vBin = null; aBin = null;
        return vOk && aOk;
      }

      // FFmpeg 合并
      overlay.setStep(T.merge); overlay.setProgress(85);
      try {
        const ffmpeg = await loadBatchFFmpeg();
        ffmpeg.FS("writeFile", "v.m4s", vBin);
        ffmpeg.FS("writeFile", "a.m4s", aBin);
        await ffmpeg.run("-i", "v.m4s", "-i", "a.m4s", "-c", "copy", "out.mp4");
        const out = ffmpeg.FS("readFile", "out.mp4");
        ffmpeg.FS("unlink", "out.mp4"); ffmpeg.FS("unlink", "v.m4s"); ffmpeg.FS("unlink", "a.m4s");
        vBin = null; aBin = null;
        await writeToDir(dirHandle, `${fname}.mp4`, out);
        return true;
      } catch (e) {
        if (e?.message === 'Aborted' || signal.aborted) throw e;
        console.warn('[Batch] merge failed, splitting:', e);
        // 清理 FFmpeg FS 残留文件,避免下集复用单例时脏数据
        try { _batchFFmpeg?.FS("unlink", "out.mp4"); } catch (_) {}
        try { _batchFFmpeg?.FS("unlink", "v.m4s"); } catch (_) {}
        try { _batchFFmpeg?.FS("unlink", "a.m4s"); } catch (_) {}
        if (vBin && aBin) {
          await writeToDir(dirHandle, `${T.video}-${fname}.mp4`, vBin);
          await writeToDir(dirHandle, `${T.audio}-${fname}.m4a`, aBin);
          vBin = null; aBin = null;
          return true;
        }
        return false;
      }
    };

    // 批量下载主流程
    const runBatch = async () => {
      overlay.setBatchMode(true);
      overlay.setStep(T.parse);

      // 1. 获取分集列表
      const episodes = await getCollectionEpisodes();
      if (!episodes || episodes.length < 2) {
        overlay.setStep(T.errTitle);
        overlay.setDetail(T.batchNoCollection);
        overlay.done();
        setTimeout(() => overlay.remove(), 4000);
        return;
      }

      // 2. 多选分集
      const mpi = getMultiPartInfo();
      const selected = await showBatchSelector(
        episodes.map((ep) => ({ part: ep.title, cid: ep.cid, epId: ep.epId })),
        mpi?.currentIndex || 0
      );
      if (!selected || !selected.length) { overlay.setStep(T.canceled); setTimeout(() => overlay.remove(), 2000); return; }

      // 3. 选择目录(必须在用户手势链内 —— 此处仍在 popup 点击注入的激活窗口中)
      // 选不了/取消 → 不直接失败,改走 blob 兜底(文件进浏览器默认下载目录)
      let dirHandle = null;
      if (window.showDirectoryPicker) {
        try {
          dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
          console.log('[Batch] dirHandle:', dirHandle.name);
        } catch (e) {
          if (e?.name === 'AbortError') {
            // 用户取消目录选择 → 询问是否改用默认下载目录
            const goBlob = confirm(T.batchDirAbortFallback);
            if (!goBlob) { overlay.setStep(T.canceled); setTimeout(() => overlay.remove(), 2000); return; }
            // 继续走 blob 兜底(dirHandle 保持 null)
          } else {
            // 系统目录等拒绝 → 询问是否改用默认下载目录
            console.warn('[Batch] dir picker rejected:', e);
            const goBlob = confirm(T.batchDirRejectedFallback);
            if (!goBlob) { overlay.setStep(T.canceled); setTimeout(() => overlay.remove(), 2000); return; }
          }
        }
      } else {
        // 浏览器不支持 showDirectoryPicker,直接 blob 兜底
        const goBlob = confirm(T.batchNoDirPickerFallback);
        if (!goBlob) { overlay.setStep(T.canceled); setTimeout(() => overlay.remove(), 2000); return; }
      }
      overlay.setDetail(dirHandle ? `${T.batchPickDir}: ${dirHandle.name}` : T.batchNoDirHint);

      // 4. 合集标题(用于命名)
      let collectionTitle = null;
      try { collectionTitle = window.__INITIAL_STATE__?.videoData?.title || window.__INITIAL_STATE__?.h1Title; } catch (_) {}
      if (!collectionTitle) collectionTitle = document.title?.replace('_bilibili', '') || 'bilibili';

      // 5. 串行下载(集间间隔 1.5s 防风控)
      let ok = 0, fail = 0;
      for (let i = 0; i < selected.length; i++) {
        if (signal.aborted) break;
        const epIdx = selected[i];
        const ep = episodes[epIdx];
        try {
          const success = await batchDownloadEpisode(ep, i, selected.length, dirHandle, collectionTitle);
          if (success) ok++; else fail++;
        } catch (e) {
          if (e?.message === 'Aborted' || signal.aborted) break;
          console.warn('[Batch] episode failed:', ep?.title, e);
          fail++;
        }
        if (i < selected.length - 1 && !signal.aborted) await sleep(1500);
      }

      // 6. 完成
      overlay.setBatchProgress(100);
      overlay.setProgress(100);
      overlay.setStep(T.batchDone);
      overlay.setDetail(fail === 0 ? `${ok}/${selected.length}` : `${ok}/${selected.length} (${fail} ${T.batchEpFail})`);
      overlay.done();
    };

    // ============================================================
    // 8. Main Flow
    // ============================================================
    overlay.setStep(T.parse);

    // 批量模式:走合集批量流程,跳过单次下载
    if (window.__BILI_BATCH__) {
      await runBatch();
      return;
    }

    const mpi = getMultiPartInfo();
    let selIdx = 0, selPage = null;
    if (mpi?.pages?.length > 1) {
      const sel = await showPartSelector(mpi.pages, mpi.currentIndex);
      if (!sel) { overlay.setStep(T.canceled); setTimeout(() => overlay.remove(), 2000); return; }
      selIdx = sel.index; selPage = sel.page;
    }

    let dash;
    try {
      dash = await Promise.race([resolveBilibili(selPage?.cid, selPage?.epId), new Promise((_, r) => setTimeout(() => r(new Error("超时")), 10000))]);
    } catch(e) {
      overlay.setStep(T.parseErr); overlay.setDetail(e.message); overlay.done(); return;
    }
    if (!dash) { overlay.setStep(T.noInfo); overlay.setDetail(T.noInfoDetail); overlay.done(); setTimeout(() => overlay.remove(), 6000); return; }

    const vArr = dash.video, aArr = dash.audio;
    console.log('[BiliDown] preferHDR:', preferHDR, '| Total video tracks:', vArr?.length);
    if (vArr) {
      vArr.forEach((t, i) => {
        const cs = String(t.codecs || '');
        const bw = t.bandwidth || 0;
        const hdr = isHdr(t);
        console.log(`  Track ${i}: ${cs} ${hdr ? 'HDR' : 'SDR'} bw=${bw}`);
      });
    }
    const vUrl = pickBestVideo(vArr, preferHDR);
    const aPick = pickBestAudio(aArr);
    const aUrl = aPick.url;
    const vTrack = (vArr || []).find(x => (x.baseUrl || x.base_url || x.url) === vUrl) || vArr?.[0];
    const aTrack = aPick.track || aArr?.[0];

    // Collect backup URLs ONLY from the target pool (SDR or HDR) to avoid quality mismatch
    const vPool = (vArr || []).filter(x => preferHDR ? isHdr(x) : !isHdr(x));
    let vAllUrls = getAllUrls(vTrack);
    for (const t of vPool) {
      for (const u of getAllUrls(t)) {
        if (!vAllUrls.includes(u)) vAllUrls.push(u);
      }
    }
    let aAllUrls = aPick.urls?.length ? aPick.urls : getAllUrls(aTrack);
    for (const t of aArr || []) {
      for (const u of getAllUrls(t)) {
        if (!aAllUrls.includes(u)) aAllUrls.push(u);
      }
    }
    
    console.log("[BiliDown] vAllUrls:", vAllUrls.length, "aAllUrls:", aAllUrls.length);

    const rawTitle = document.title?.replace("_bilibili", "") || "bilibili_video";
    let vTitle = null;
    try { vTitle = window.__INITIAL_STATE__?.videoData?.title || window.__INITIAL_STATE__?.h1Title; } catch (_) {}
    if (!vTitle) { const mt = document.querySelector('meta[property="og:title"]'); if (mt?.content) vTitle = mt.content; }
    if (!vTitle) { const h1 = document.querySelector("h1"); const t = h1 && (h1.getAttribute("title") || h1.textContent); if (t) vTitle = t; }
    if (!vTitle) {
      try { const info = await getBvid(); if (info?.bvid) {
        const vr = await fetchWithTimeout(`https://api.bilibili.com/x/web-interface/view?bvid=${info.bvid}`, { credentials: "include" });
        const vj = await vr.json(); if (vj?.data?.title) vTitle = vj.data.title;
      }} catch (_) {}
    }
    if (vTitle) vTitle = String(vTitle).trim();

    let fname = safeName(vTitle || rawTitle);
    if (selPage) { const pn = selPage.part || selPage.title || `P${selIdx+1}`; fname = `${fname}_P${selIdx+1}_${safeName(pn)}`; }

    if (!vUrl || !aUrl) { overlay.setStep(T.noTrack); overlay.setDetail(T.noTrackDetail); overlay.done(); return; }

    console.log("[BiliDown] vUrl:", !!vUrl, "aUrl:", !!aUrl, "fname:", fname);

    // Use streaming merge approach
    try {
      await streamMerge({ vUrl, aUrl, filename: fname, vAllUrls, aAllUrls });
    } catch(e) {
      console.error("[BiliDown] streamMerge error:", e);
      if (e?.name === 'AbortError' || e?.message === 'Aborted') {
        overlay.setStep(T.canceled); setTimeout(() => overlay.remove(), 2000); return;
      }
      overlay.setStep(T.browserDl); overlay.setProgress(90);
      overlay.setDetail("分流下载中...");
      fetchToBlob(vAllUrls, `${T.video}-${fname}.mp4`);
      setTimeout(() => fetchToBlob(aAllUrls, `${T.audio}-${fname}.m4a`), 500);
    }

  } catch(err) {
    console.error("[BilibiliDownloader] Fatal:", err);
    const el = document.getElementById("bili-download-overlay");
    if (el) {
      const d = el.querySelector("div:nth-child(4)");
      if (d) d.textContent = err?.message || String(err);
    } else {
      alert("脚本错误: " + (err?.message || String(err)));
    }
  }
})();
