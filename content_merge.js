(async () => {
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
        multiPartDetected: "检测到多P视频，请选择要下载的分P"
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
        multiPartDetected: "Multi-part video detected. Select which part to download."
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
      el.addEventListener("mousedown", e => {
        if (e.target.tagName === "BUTTON") return;
        isDrag = true; sx = e.clientX; sy = e.clientY;
        const r = el.getBoundingClientRect(); il = r.left; it = r.top;
        el.style.right = "auto"; el.style.bottom = "auto";
        el.style.left = il + "px"; el.style.top = it + "px";
        e.preventDefault();
      });
      window.addEventListener("mousemove", e => { if (!isDrag) return; el.style.left = (il + e.clientX - sx) + "px"; el.style.top = (it + e.clientY - sy) + "px"; });
      window.addEventListener("mouseup", () => isDrag = false);

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

      const cancelBtn = mkBtn(T.cancel, "#ff6b6b", () => { if (confirm(T.confirmCancel)) { controller.abort(); el.remove(); } });
      btnArea.appendChild(cancelBtn);
      document.body.appendChild(el);

      return {
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
          cancelBtn.onclick = () => el.remove();
        },
        resetCancel: () => {
          cancelBtn.textContent = T.cancel;
          cancelBtn.style.cssText = "background:transparent;border:none;color:#ff6b6b;cursor:pointer;font-size:12px;padding:0;text-decoration:underline;";
          cancelBtn.onclick = () => { if (confirm(T.confirmCancel)) { controller.abort(); el.remove(); } };
        },
        remove: () => el.remove()
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
        const pages = (st.videoData || {}).pages || (st.metadata || {}).list || [];
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

    async function resolveBilibili(specificCid) {
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
        
        // 番剧使用 ep_id 方式
        const ep = location.pathname.match(/\/bangumi\/play\/ep(\d+)/i);
        if (ep) {
          try {
            const u = `https://api.bilibili.com/pgc/player/web/playurl?qn=120&fnval=4048&fourk=1&cid=${currentCid.cid}&ep_id=${ep[1]}`;
            const pr = await fetchWithTimeout(u, { credentials: "include" });
            const pj = await pr.json();
            if (pj?.result?.dash || pj?.data?.dash) {
              console.log('[BiliDown] Using real-time cid for bangumi:', currentCid.cid);
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
      const { bvid, epId } = info;
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
      console.log('[pickVideo] wantHdr:', wantHdr, '| SDR:', sdr.length, '| HDR:', hdr.length, '| pool:', target.length);
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
        // Fallback: download via service worker (separate files)
        triggerBgDownload({ urls: vAllUrls, url: vUrl, filename: `${T.video}-${filename}.mp4` });
        setTimeout(() => triggerBgDownload({ urls: aAllUrls, url: aUrl, filename: `${T.audio}-${filename}.m4a` }), 1000);
        return;
      }

      // IMPORTANT: Request file handle EARLY while user gesture is still active
      // showSaveFilePicker must be called in response to a user gesture
      let fileHandle;
      try {
        fileHandle = await window.showSaveFilePicker({
          suggestedName: filename + ".mp4",
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
          triggerBgDownload({ urls: vAllUrls, url: vUrl, filename: `${T.video}-${filename}.mp4` });
          setTimeout(() => triggerBgDownload({ urls: aAllUrls, url: aUrl, filename: `${T.audio}-${filename}.m4a` }), 1000);
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

        // Set up Module.locateFile BEFORE loading core JS, so it intercepts WASM loading
        window.Module = window.Module || {};
        window.Module.locateFile = (p) => {
          if (p && p.endsWith('.wasm')) return wasmUrl;
          return p;
        };

        // Load core JS from extension URL directly
        await Promise.race([
          new Promise((res, rej) => {
            const s = document.createElement("script");
            s.src = coreJsUrl;
            s.onload = () => { console.log("[FFmpeg] Core JS loaded OK"); res(); };
            s.onerror = (e) => { console.error("[FFmpeg] Core JS load error:", e); rej(new Error("Core JS script failed")); };
            (document.head || document.documentElement).appendChild(s);
          }),
          new Promise((_, rej) => setTimeout(() => rej(new Error("Core JS load timeout")), 15000))
        ]);

        const createFFmpeg = window.FFmpeg.createFFmpeg;

        // Create FFmpeg with WASM path pointing to extension URL
        const ffmpeg = createFFmpeg({ wasmPath: wasmUrl, log: true });
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
            const reader = res.body.getReader();
            const chunks = []; let loaded = 0;
            const start = performance.now();
            while (true) {
              if (signal.aborted) throw new Error("Aborted");
              const { done, value } = await reader.read();
              if (done) break;
              chunks.push(value); loaded += value.length;
              const elapsed = (performance.now() - start) / 1000;
              const pct = total ? (loaded / total) * 100 : 0;
              overlay.setDetail(`${label}: ${fmtBytes(loaded)} / ${fmtBytes(total)} (${fmtBytes(loaded/Math.max(0.1,elapsed))}/s) ${pct.toFixed(0)}%`);
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
        console.error("[BiliDown] Fetch failed, falling back to separate download:", e);
        // If fetch failed, fall back to separate download via service worker
        overlay.setStep(T.errTitle);
        overlay.setDetail("下载失败，是否尝试分别下载？");
        if (confirm(T.mergeFailConfirm.replace("{msg}", e?.message || "下载失败"))) {
          triggerBgDownload({ urls: vAllUrls, url: vUrl, filename: `${T.video}-${filename}.mp4` });
          setTimeout(() => triggerBgDownload({ urls: aAllUrls, url: aUrl, filename: `${T.audio}-${filename}.m4a` }), 1000);
        } else {
          overlay.remove();
        }
        return;
      }

      // Sizes unknown from HEAD probe (estTotalSize=0), double-check actual downloaded size
      // This is a safety net only — normally the pre-download probe handles this
      if (estTotalSize <= 0 && (vBin.byteLength + aBin.byteLength) > MAX_SIZE_FOR_MERGE) {
        console.log("[SizeCheck] Probe missed size, actual too large → split");
        overlay.setStep(T.bigFile);
        overlay.setDetail(T.bigFileDetail);
        if (confirm(T.bigFileConfirm)) {
          triggerBgDownload({ urls: vAllUrls, url: vUrl, filename: `${T.video}-${filename}.mp4` });
          setTimeout(() => triggerBgDownload({ urls: aAllUrls, url: aUrl, filename: `${T.audio}-${filename}.m4a` }), 1000);
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
        const w = await fileHandle.createWritable();
        await w.write(out);
        await w.close();

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

      // If merge failed, offer separate download via service worker
      overlay.setStep(T.errTitle);
      const isOOM = /Array buffer allocation|out of memory|Cannot allocate/i.test(String(ffmpegError?.message || ''));
      overlay.setDetail(isOOM ? "内存不足，无法合并。请分别下载视频和音频。" : "合并失败，是否分别下载视频和音频？");
      if (confirm(T.mergeFailConfirm.replace("{msg}", isOOM ? "内存不足" : "合并过程出错"))) {
        triggerBgDownload({ urls: vAllUrls, url: vUrl, filename: `${T.video}-${filename}.mp4` });
        setTimeout(() => triggerBgDownload({ urls: aAllUrls, url: aUrl, filename: `${T.audio}-${filename}.m4a` }), 1000);
      } else {
        overlay.remove();
      }
    };

    const triggerBgDownload = payload => {
      overlay.setStep(T.browserDl);
      overlay.setProgress(100);
      overlay.setDetail(T.browserDlDetail);
      overlay.done();
      window.dispatchEvent(new CustomEvent("BILI_TRIGGER_DOWNLOAD", { detail: payload }));
    };

    window.addEventListener("BILI_DOWNLOAD_ERROR", e => {
      overlay.setStep(T.dlFailTitle);
      overlay.setDetail(e?.detail?.message || T.dlFail);
      overlay.done();
    });

    // ============================================================
    // 8. Main Flow
    // ============================================================
    overlay.setStep(T.parse);

    const mpi = getMultiPartInfo();
    let selIdx = 0, selPage = null;
    if (mpi?.pages?.length > 1) {
      const sel = await showPartSelector(mpi.pages, mpi.currentIndex);
      if (!sel) { overlay.setStep(T.canceled); setTimeout(() => overlay.remove(), 2000); return; }
      selIdx = sel.index; selPage = sel.page;
    }

    let dash;
    try {
      dash = await Promise.race([resolveBilibili(selPage?.cid), new Promise((_, r) => setTimeout(() => r(new Error("超时")), 10000))]);
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
      overlay.setStep(T.errTitle);
      overlay.setDetail(e?.message || T.dlFail);
      if (confirm(T.mergeFailConfirm.replace("{msg}", e?.message || ""))) {
        triggerBgDownload({ urls: vAllUrls, url: vUrl, filename: `${T.video}-${fname}.mp4` });
        setTimeout(() => triggerBgDownload({ urls: aAllUrls, url: aUrl, filename: `${T.audio}-${fname}.m4a` }), 1000);
      }
      overlay.done();
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
