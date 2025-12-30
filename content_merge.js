(async () => {
  try {
    console.log("[BilibiliDownloader] Script started");

    // 1. Overlay UI Component
    const overlay = (() => {
      try {
        const el = document.createElement("div");
        el.id = "bili-download-overlay";
        el.style.position = "fixed";
        el.style.right = "16px";
        el.style.bottom = "16px";
        el.style.zIndex = "2147483647"; // Max Z-Index
        el.style.background = "rgba(0,0,0,0.85)";
        el.style.color = "#fff";
        el.style.font = "14px/1.6 system-ui, -apple-system, Segoe UI, sans-serif";
        el.style.padding = "16px";
        el.style.borderRadius = "8px";
        el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.5)";
        el.style.minWidth = "260px";
        el.style.maxWidth = "360px";
        el.style.userSelect = "none";
        
        // Draggable
        el.style.cursor = "move";
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;
        
        el.addEventListener("mousedown", (e) => {
          if (e.target.tagName === "BUTTON" || e.target.style.cursor === "pointer") return;
          isDragging = true;
          startX = e.clientX;
          startY = e.clientY;
          const rect = el.getBoundingClientRect();
          initialLeft = rect.left;
          initialTop = rect.top;
          el.style.right = "auto";
          el.style.bottom = "auto";
          el.style.left = initialLeft + "px";
          el.style.top = initialTop + "px";
          e.preventDefault();
        });

        window.addEventListener("mousemove", (e) => {
          if (!isDragging) return;
          el.style.left = (initialLeft + (e.clientX - startX)) + "px";
          el.style.top = (initialTop + (e.clientY - startY)) + "px";
        });

        window.addEventListener("mouseup", () => isDragging = false);

        // UI Elements
        const titleDiv = document.createElement("div");
        titleDiv.style.fontWeight = "bold";
        titleDiv.style.marginBottom = "8px";
        titleDiv.style.borderBottom = "1px solid rgba(255,255,255,0.2)";
        titleDiv.style.paddingBottom = "4px";
        titleDiv.textContent = "B站离线舱";
        el.appendChild(titleDiv);

        const stepDiv = document.createElement("div");
        stepDiv.textContent = "初始化中...";
        el.appendChild(stepDiv);

        const barContainer = document.createElement("div");
        barContainer.style.marginTop = "8px";
        barContainer.style.height = "6px";
        barContainer.style.background = "rgba(255,255,255,0.2)";
        barContainer.style.borderRadius = "3px";
        barContainer.style.overflow = "hidden";
        
        const barDiv = document.createElement("div");
        barDiv.style.height = "100%";
        barDiv.style.width = "0%";
        barDiv.style.background = "#00aeec";
        barDiv.style.transition = "width 0.2s";
        barContainer.appendChild(barDiv);
        el.appendChild(barContainer);

        const detailDiv = document.createElement("div");
        detailDiv.style.marginTop = "8px";
        detailDiv.style.fontSize = "12px";
        detailDiv.style.opacity = "0.8";
        detailDiv.style.wordBreak = "break-all";
        el.appendChild(detailDiv);
        
        // Buttons Area
        const btnArea = document.createElement("div");
        btnArea.style.marginTop = "12px";
        btnArea.style.display = "flex";
        btnArea.style.justifyContent = "flex-end";
        btnArea.style.gap = "10px";
        el.appendChild(btnArea);

        // Helper to create button
        const createBtn = (text, color, onClick) => {
            const btn = document.createElement("button");
            btn.textContent = text;
            btn.style.background = "transparent";
            btn.style.border = "none";
            btn.style.color = color;
            btn.style.cursor = "pointer";
            btn.style.fontSize = "12px";
            btn.style.padding = "0";
            btn.style.textDecoration = "underline";
            btn.onclick = onClick;
            return btn;
        };

        const cancelBtn = createBtn("取消", "#ff6b6b", () => {
            if (confirm("确定要取消下载吗？")) {
                controller.abort();
                el.remove();
            }
        });
        btnArea.appendChild(cancelBtn);

        document.body.appendChild(el);
        
        const updateStatus = (data) => {
            try { window.dispatchEvent(new CustomEvent("BILI_DOWN_STATUS", { detail: data })); } catch(_) {}
        };

        return {
          setStep: (t) => { 
              stepDiv.textContent = t; 
              updateStatus({ step: t }); 
          },
          setProgress: (p) => { 
              barDiv.style.width = Math.max(0, Math.min(100, p)) + "%";
              updateStatus({ progress: Math.round(p) }); 
          },
          setDetail: (t) => { 
              detailDiv.textContent = t; 
              updateStatus({ detail: t });
          },
          addBtn: (text, onClick) => {
             const btn = createBtn(text, "#4cc9f0", onClick);
             btn.style.marginRight = "8px";
             btn.style.textDecoration = "none";
             btn.style.background = "rgba(255,255,255,0.1)";
             btn.style.padding = "2px 8px";
             btn.style.borderRadius = "4px";
             btnArea.insertBefore(btn, cancelBtn);
             return btn;
          },
          done: () => {
             cancelBtn.textContent = "关闭";
             cancelBtn.style.color = "#fff";
             cancelBtn.style.textDecoration = "none";
             cancelBtn.onclick = () => el.remove();
             updateStatus({ done: true });
          },
          remove: () => {
              el.remove();
              updateStatus({ done: true });
          }
        };
      } catch (e) {
        alert("UI初始化失败: " + e.message);
        throw e;
      }
    })();

    // Global abort controller
    const controller = new AbortController();
    const signal = controller.signal;

    // Utils
    const fetchWithTimeout = async (resource, options = {}) => {
      const { timeout = 8000 } = options;
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(resource, {
          ...options,
          signal: controller.signal
        });
        clearTimeout(id);
        return response;
      } catch (error) {
        clearTimeout(id);
        throw error;
      }
    };

    const fmtBytes = (n) => {
      if (!n && n !== 0) return "";
      const u = ["B","KB","MB","GB"]; let i = 0; let v = n;
      while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
      return v.toFixed(1) + " " + u[i];
    };
    const fmtTime = (s) => {
      s = Math.max(0, Math.floor(s));
      const m = Math.floor(s / 60); const ss = s % 60;
      return (m > 0 ? m + "分" : "") + ss + "秒";
    };

    // 2. Bilibili Resolver
    const getBvid = async () => {
      // 1. Try URL (video)
      const m = location.pathname.match(/\/video\/(BV[\w]+)/i);
      if (m) return { bvid: m[1], cid: null };
      
      // 2. Try URL (bangumi ep)
      const epMatch = location.pathname.match(/\/bangumi\/play\/ep(\d+)/i);
      if (epMatch) {
        const epId = epMatch[1];
        try {
          const res = await fetchWithTimeout(`https://api.bilibili.com/pgc/view/web/season?ep_id=${epId}`);
          const json = await res.json();
          // Debug log
          console.log("Bangumi EP Info:", json);
          const episodes = json?.result?.episodes || [];
          const targetEp = episodes.find(e => e.id == epId);
          if (targetEp && targetEp.bvid) return { bvid: targetEp.bvid, cid: targetEp.cid, epId: epId };
          // If not found in episodes list (sometimes sections?), fallback to result.bvid if available?
          // But result usually has main section bvid.
        } catch (_) {}
      }

      // 3. Try URL (bangumi ss)
      const ssMatch = location.pathname.match(/\/bangumi\/play\/ss(\d+)/i);
      if (ssMatch) {
        const seasonId = ssMatch[1];
        try {
          const res = await fetchWithTimeout(`https://api.bilibili.com/pgc/view/web/season?season_id=${seasonId}`);
          const json = await res.json();
          console.log("Bangumi SS Info:", json);
          if (json?.result?.episodes?.length > 0) {
             // Find the first episode or currently active? 
             // Without ep_id in URL, it usually defaults to first or history.
             // We just take the first one for now as a fallback.
             const ep = json.result.episodes[0];
             return { bvid: ep.bvid, cid: ep.cid, epId: ep.id };
          }
        } catch (_) {}
      }

      // 4. Try Global State
      try {
        if (window.__INITIAL_STATE__) {
           const s = window.__INITIAL_STATE__;
           if (s.bvid) return { bvid: s.bvid, cid: s.cid };
           if (s.epInfo && s.epInfo.bvid) return { bvid: s.epInfo.bvid, cid: s.epInfo.cid, epId: s.epInfo.id };
           if (s.videoData && s.videoData.bvid) return { bvid: s.videoData.bvid, cid: s.videoData.cid };
        }
      } catch (_) {}
      
      return null;
    };

    async function resolveBilibili() {
      // Priority 1: Window Objects
      const p = window.__playinfo__ || window.playinfo;
      if (p && p.dash) return p.dash;
      
      // Priority 2: HTML Scraping (if window object missing)
      try {
          const html = document.body.innerHTML;
          const m = html.match(/window\.__playinfo__=({.*?})/);
          if (m) {
              const data = JSON.parse(m[1]);
              if (data && data.data && data.data.dash) return data.data.dash;
          }
      } catch(_) {}

      // Priority 3: API Fetch
      const info = await getBvid();
      if (!info || !info.bvid) return null;
      
      const { bvid, epId } = info;
      let { cid } = info;

      try {
        if (!cid) {
            const viewRes = await fetchWithTimeout(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, { credentials: "include" });
            const viewJson = await viewRes.json();
            const vd = viewJson?.data || {};
            cid = vd.cid || (vd.pages && vd.pages[0] && vd.pages[0].cid) || 0;
        }
        
        if (!cid) return null;

        // Try UGC API
        let playRes = await fetchWithTimeout(`https://api.bilibili.com/x/player/playurl?cid=${cid}&bvid=${bvid}&qn=120&fnval=4048&fourk=1`, { credentials: "include" });
        let playJson = await playRes.json();
        let data = playJson?.data || {};
        
        // Try PGC API
        if (!data.dash) {
             let pgcUrl = `https://api.bilibili.com/pgc/player/web/playurl?cid=${cid}&bvid=${bvid}&qn=120&fnval=4048&fourk=1`;
             if (epId) pgcUrl += `&ep_id=${epId}`;
             
             playRes = await fetchWithTimeout(pgcUrl, { credentials: "include" });
             playJson = await playRes.json();
             data = playJson?.result || {};
        }

        if (data.dash) return data.dash;
        return null;
      } catch (e) {
        console.warn("Resolve Bilibili Error", e);
        return null;
      }
    }

    const pickBest = (arr) => {
      if (!arr || arr.length === 0) return null;
      // Sort by ID (quality) descending
      arr.sort((a, b) => (b.id || 0) - (a.id || 0));
      // Pick highest quality group
      const maxId = arr[0].id;
      const candidates = arr.filter(x => x.id === maxId);
      // Sort by bandwidth descending
      candidates.sort((a, b) => (b.bandwidth || 0) - (a.bandwidth || 0));
      const best = candidates[0];
      return best.baseUrl || best.base_url || best.url || (best.backupUrl && best.backupUrl[0]);
    };

    const isHdrOrDolbyVideo = (x) => {
      if (!x) return false;
      const id = Number(x.id);
      if (id === 125 || id === 126) return true;
      const cs = String(x.color_space || x.colorSpace || "");
      if (/2020|bt2020/i.test(cs)) return true;
      if (/709|bt709/i.test(cs)) return false;
      const tc = x.transfer_characteristics ?? x.transferCharacteristics ?? x.trc ?? x.transfer;
      if (tc === 16 || tc === 18) return true;
      const sig = JSON.stringify({
        codecs: x.codecs,
        mimeType: x.mimeType,
        frameRate: x.frame_rate || x.frameRate,
        hdr: x.hdr || x.hdr_type || x.hdrType,
        dovi: x.dovi || x.dolby_vision || x.dolbyVision,
        color: x.color_space || x.colorSpace || x.color_primaries || x.colorPrimaries || x.transfer_characteristics || x.transferCharacteristics || x.matrix_coefficients || x.matrixCoefficients
      });
      return /dolby|vision|dovi|dvhe|dvh1|hdr|hlg|pq|smpte2084|arib-std-b67|bt2020/i.test(sig);
    };

    const pickBestVideoUrl = (arr) => {
      if (!arr || arr.length === 0) return null;
      const nonDrm = arr.filter((x) => {
        const v = x && (x.drm_tech_type ?? x.drmTechType ?? x.is_drm ?? x.isDrm);
        return !(Number(v) > 0 || v === true);
      });
      const pool = nonDrm.length ? nonDrm : arr;
      const sdrPool = pool.filter((x) => !isHdrOrDolbyVideo(x));
      const finalPool = sdrPool.length ? sdrPool : [];
      if (!finalPool.length) return null;

      const isHevc = (x) => {
        const c = String(x.codecs || "");
        return x.codecid === 12 || /hev1|hvc1/i.test(c);
      };
      const isAvc = (x) => {
        const c = String(x.codecs || "");
        return x.codecid === 7 || /avc1/i.test(c);
      };

      const hevc = finalPool.filter(isHevc);
      if (hevc.length) return pickBest(hevc);

      const avc = finalPool.filter(isAvc);
      if (avc.length) return pickBest(avc);

      return pickBest(finalPool);
    };

    const getAllUrls = (track) => {
      if (!track) return [];
      const out = [];
      const push = (u) => { if (u && !out.includes(u)) out.push(u); };
      push(track.baseUrl || track.base_url || track.url);
      const b = track.backupUrl || track.backup_url;
      if (Array.isArray(b)) for (const u of b) push(u);
      return out;
    };

    const getVideoUrlCandidates = (arr) => {
      if (!arr || arr.length === 0) return [];
      const byId = new Map();
      for (const t of arr) {
        const id = t && t.id != null ? Number(t.id) : 0;
        if (!byId.has(id)) byId.set(id, []);
        byId.get(id).push(t);
      }

      const ids = Array.from(byId.keys()).sort((a, b) => b - a);
      const out = [];
      for (const id of ids) {
        const tracksAll = byId.get(id) || [];
        const tracksNonDrm = tracksAll.filter((t) => {
          const v = t && (t.drm_tech_type ?? t.drmTechType ?? t.is_drm ?? t.isDrm);
          return !(Number(v) > 0 || v === true);
        });
        const tracksNoHdr = (tracksNonDrm.length ? tracksNonDrm : tracksAll).filter((t) => !isHdrOrDolbyVideo(t));
        const tracks = tracksNoHdr;
        if (!tracks.length) continue;
        tracks.sort((a, b) => {
          const aCodecs = String((a && a.codecs) || "");
          const bCodecs = String((b && b.codecs) || "");
          const aHevc = (a && (a.codecid === 12 || /hev1|hvc1/i.test(aCodecs))) ? 1 : 0;
          const bHevc = (b && (b.codecid === 12 || /hev1|hvc1/i.test(bCodecs))) ? 1 : 0;
          if (bHevc !== aHevc) return bHevc - aHevc;
          const aAvc = (a && (a.codecid === 7 || /avc1/i.test(aCodecs))) ? 1 : 0;
          const bAvc = (b && (b.codecid === 7 || /avc1/i.test(bCodecs))) ? 1 : 0;
          if (bAvc !== aAvc) return bAvc - aAvc;
          return (Number(b.bandwidth) || 0) - (Number(a.bandwidth) || 0);
        });
        for (const t of tracks) {
          for (const u of getAllUrls(t)) {
            if (!out.includes(u)) out.push(u);
          }
        }
      }
      return out;
    };

    // Helper to format filename properly
    const getSafeFilename = (name) => {
        // Remove invalid characters for Windows/Linux/Mac
        if (!name) return "bilibili_video";
        return name.replace(/[\\/:*?\"<>|]/g, "_").trim();
    };

    // 3. Logic Start
    overlay.setStep("正在解析视频信息...");
    
    // Add a race with timeout for the whole resolution process
    const resolvePromise = resolveBilibili();
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("解析超时，请刷新重试")), 10000)
    );
    
    let dash = null;
    try {
        dash = await Promise.race([resolvePromise, timeoutPromise]);
    } catch (e) {
        overlay.setStep("解析出错");
        overlay.setDetail(e.message);
        overlay.done(); // Allow close
        return;
    }

    if (!dash) {
      overlay.setStep("未找到视频流信息");
      overlay.setDetail("无法获取 DASH 格式地址，请确认视频是否有效或需要登录。");
      overlay.done();
      setTimeout(() => overlay.remove(), 6000);
      return;
    }

    const vTrackArr = dash.video;
    const aTrackArr = dash.audio;
    const vUrl = pickBestVideoUrl(vTrackArr);
    const aUrl = pickBest(aTrackArr);
    const vTrack =
      (vTrackArr || []).find((x) => (x.baseUrl || x.base_url || x.url) === vUrl) ||
      (vTrackArr && vTrackArr[0]) ||
      null;
    const aTrack =
      (aTrackArr || []).find((x) => (x.baseUrl || x.base_url || x.url) === aUrl) ||
      (aTrackArr && aTrackArr[0]) ||
      null;
    // Use getSafeFilename here to ensure consistency
    const rawTitle = document.title ? document.title.replace("_bilibili", "") : "bilibili_video";
    let videoTitle = null;
    try {
      videoTitle = window.__INITIAL_STATE__?.videoData?.title || window.__INITIAL_STATE__?.h1Title || null;
    } catch (_) {}
    if (!videoTitle) {
      const metaTitle = document.querySelector('meta[property="og:title"]');
      if (metaTitle?.content) videoTitle = metaTitle.content;
    }
    if (!videoTitle) {
      const h1 = document.querySelector("h1");
      const t = h1 && (h1.getAttribute("title") || h1.textContent);
      if (t) videoTitle = t;
    }
    if (!videoTitle) {
      try {
        const info = await getBvid();
        if (info?.bvid) {
          const viewRes = await fetchWithTimeout(
            `https://api.bilibili.com/x/web-interface/view?bvid=${info.bvid}`,
            { credentials: "include" }
          );
          const viewJson = await viewRes.json();
          const t = viewJson?.data?.title;
          if (t) videoTitle = t;
        }
      } catch (_) {}
    }
    if (videoTitle) videoTitle = String(videoTitle).trim();
    const filename = getSafeFilename(videoTitle || rawTitle);

    if (!vUrl || !aUrl) {
      overlay.setStep("解析失败");
      if (!vUrl && vTrackArr && vTrackArr.length) {
        overlay.setDetail("未找到可下载的 SDR(709) 视频轨道（已排除 HDR/杜比/受控轨道）");
      } else {
        overlay.setDetail("未找到有效的视频或音频轨道。");
      }
      overlay.done();
      return;
    }

    // 4. Download Helpers
    const triggerBgDownload = (payload) => {
        // Update overlay to show we are handing off to browser
        overlay.setStep("已调用浏览器下载");
        overlay.setProgress(100);
        overlay.setDetail("请查看浏览器右上角下载列表");
        overlay.done();
        
        // Dispatch event to content_bridge.js (ISOLATED world)
        // which has access to chrome.runtime
        window.dispatchEvent(new CustomEvent("BILI_TRIGGER_DOWNLOAD", { 
            detail: payload
        }));
    };

    const streamToFile = async ({ urls, suggestedName, label, progressBase, progressScale }) => {
      if (!window.showSaveFilePicker) throw new Error("当前浏览器不支持流式保存");
      const handle = await window.showSaveFilePicker({ suggestedName });
      const writable = await handle.createWritable();
      try {
        for (const url of urls || []) {
          try {
            const res = await fetch(url, { credentials: "include", signal });
            if (!res.ok || !res.body) continue;
            const total = Number(res.headers.get("content-length")) || 0;
            const reader = res.body.getReader();
            let loaded = 0;
            const start = performance.now();
            overlay.setStep(`正在保存${label}...`);
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              await writable.write(value);
              loaded += value.length;
              if (total) {
                const p = (loaded / total) * 100;
                overlay.setProgress(progressBase + p * progressScale);
                const elapsed = (performance.now() - start) / 1000;
                const speed = loaded / Math.max(0.1, elapsed);
                overlay.setDetail(`${label}: ${fmtBytes(loaded)} / ${fmtBytes(total)} (${fmtBytes(speed)}/s)`);
              } else {
                overlay.setDetail(`${label}: ${fmtBytes(loaded)}`);
              }
            }
            await writable.close();
            return true;
          } catch (_) {}
        }
        await writable.abort();
        throw new Error(`${label}下载失败`);
      } catch (e) {
        try { await writable.abort(); } catch (_) {}
        throw e;
      }
    };

    const startSplitStreamingSave = async () => {
      const baseTitle = (videoTitle || rawTitle || "bilibili_video").trim();
      const safeName = getSafeFilename(baseTitle.slice(0, 5));
      overlay.setProgress(0);
      await streamToFile({
        urls: getVideoUrlCandidates(vTrackArr),
        suggestedName: "视频-" + safeName + ".mp4",
        label: "视频",
        progressBase: 0,
        progressScale: 0.5
      });
      await streamToFile({
        urls: getAllUrls(aTrack),
        suggestedName: "音频-" + safeName + ".mp3",
        label: "音频",
        progressBase: 50,
        progressScale: 0.5
      });
      overlay.setStep("下载完成");
      overlay.setProgress(100);
      overlay.done();
      setTimeout(() => overlay.remove(), 5000);
    };

    window.addEventListener("BILI_DOWNLOAD_ERROR", (e) => {
      const msg = e?.detail?.message || "下载失败";
      overlay.setStep("下载失败");
      overlay.setDetail(msg);
      if (String(msg).includes("SERVER_FORBIDDEN") && window.showSaveFilePicker) {
        overlay.addBtn("流式保存", async () => {
          try {
            await startSplitStreamingSave();
          } catch (err) {
            overlay.setStep("下载失败");
            overlay.setDetail(err && err.message ? err.message : "下载失败");
            overlay.done();
          }
        });
      }
      overlay.done();
    });

    // MOVED UP: getSafeFilename was here, now moved before usage in logic flow

    const loadFFmpeg = async () => {
       overlay.setStep("正在加载核心组件...");
       
       const loadScript = (url) => new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = url;
          s.onload = res;
          s.onerror = rej;
          document.head.appendChild(s);
       });

       // Try injected URLs first
       if (window.__FFMPEG_URL__) {
           try {
               await loadScript(window.__FFMPEG_URL__);
           } catch(e) { console.warn("Local FFmpeg load failed", e); }
       }
       
       if (!window.FFmpeg) {
           // Fallback CDN
           await loadScript("https://unpkg.com/@ffmpeg/ffmpeg@0.11.2/dist/ffmpeg.min.js");
       }
       
       const createFFmpeg = window.FFmpeg.createFFmpeg;
       
       // Helper to load FFmpeg
       const tryLoad = async (corePath, mainName) => {
           const f = createFFmpeg({
               corePath: corePath,
               log: false,
               mainName: mainName
           });
           await f.load();
           return f;
       };

       let ffmpeg;
       
       // Strategy 1: Local Multi-Threaded (Default)
       // Requires SharedArrayBuffer (COOP/COEP headers)
       try {
           if (window.SharedArrayBuffer && window.__FFMPEG_CORE_URL__) {
               ffmpeg = await tryLoad(window.__FFMPEG_CORE_URL__);
           } else {
               throw new Error("SharedArrayBuffer missing or local core not found");
           }
       } catch (e1) {
           console.warn("MT FFmpeg failed, trying Local ST...", e1);
           
           // Strategy 2: Local Single-Threaded
           try {
               if (window.__FFMPEG_CORE_ST_URL__) {
                   ffmpeg = await tryLoad(window.__FFMPEG_CORE_ST_URL__, 'main');
               } else {
                   throw new Error("Local ST core not found");
               }
           } catch (e2) {
               console.warn("Local ST FFmpeg failed, trying CDN ST...", e2);
               
               // Strategy 3: CDN Single-Threaded (Last Resort)
               ffmpeg = await tryLoad("https://unpkg.com/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js", 'main');
           }
       }
       
       return ffmpeg;
    };

    const fetchToFFmpeg = async (u, label) => {
      const r = await fetch(u, { credentials: "omit", referrerPolicy: "strict-origin-when-cross-origin", signal });
      if (!r.ok) throw new Error(`${label}下载失败: ${r.status}`);
      
      const total = Number(r.headers.get("content-length")) || 0;
      const MAX_SIZE = 1.8 * 1024 * 1024 * 1024; // 1.8GB
      
      if (total > MAX_SIZE) {
          const e = new Error("File too large");
          e.name = "BigFileError";
          e.total = total;
          throw e;
      }

      const reader = r.body.getReader();
      const chunks = [];
      let loaded = 0;
      const start = performance.now();
      
      overlay.setStep(`正在下载${label}...`);
      
      while(true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          loaded += value.length;
          
          if (total) {
              const p = (loaded / total) * 100;
              // Only update UI every 1% or so to save performance? No, let's just do it.
              overlay.setProgress(p * 0.5); // 50% for download phase? 
              // Wait, this function is called twice. 
              // We should handle progress better. But let's keep it simple.
              
              const elapsed = (performance.now() - start) / 1000;
              const speed = loaded / elapsed;
              // const eta = (total - loaded) / speed; // Unused
              
              // Only update Detail, NOT progress bar (let main loop handle overall progress?)
              // No, let's update progress bar relative to download phase (0-90%)
              // But we have 2 files. Let's make it simpler:
              // Video is usually 80-90% of size. Audio is small.
              // Just show text detail in overlay.
              
              overlay.setDetail(`${label}: ${fmtBytes(loaded)} / ${fmtBytes(total)} (${fmtBytes(speed)}/s)`);
          } else {
              overlay.setDetail(`${label}: ${fmtBytes(loaded)}`);
          }
      }
      
      // Merge chunks to Uint8Array
      try {
          const out = new Uint8Array(loaded);
          let offset = 0;
          for (const c of chunks) { out.set(c, offset); offset += c.length; }
          return out;
      } catch (e) {
          const err = new Error("Memory allocation failed");
          err.name = "OOMError";
          err.chunks = chunks;
          throw err;
      }
    };

    // 5. Execution Flow
    try {
        let vBin = null, aBin = null;
        
        // Video
        try {
            vBin = await fetchToFFmpeg(vUrl, "视频");
        } catch (e) {
            if (e.name === "BigFileError" || e.name === "OOMError") {
                throw e; // Bubble up to main catch
            }
            throw e;
        }

        // Audio
        try {
            aBin = await fetchToFFmpeg(aUrl, "音频");
        } catch (e) {
             if (e.name === "BigFileError" || e.name === "OOMError") {
                // If video was already downloaded in memory, we might crash here.
                // But we can try to save video at least.
                e.vBin = vBin;
                throw e;
            }
            throw e;
        }

        // Merge
        overlay.setStep("正在合并...");
        overlay.setProgress(90);
        
        const ffmpeg = await loadFFmpeg();
        ffmpeg.FS("writeFile", "v.m4s", vBin);
        const vLen = vBin.length; // Keep length for stats if needed
        vBin = null; // GC
        ffmpeg.FS("writeFile", "a.m4s", aBin);
        const aLen = aBin.length;
        aBin = null; // GC
        
        await ffmpeg.run("-i", "v.m4s", "-i", "a.m4s", "-c", "copy", "out.mp4");
        
        const out = ffmpeg.FS("readFile", "out.mp4");
        ffmpeg.FS("unlink", "out.mp4");
        ffmpeg.FS("unlink", "v.m4s");
        ffmpeg.FS("unlink", "a.m4s");

        // Save
        overlay.setStep("保存文件中...");
        try {
            // @ts-ignore
            if (window.showSaveFilePicker) {
                const handle = await window.showSaveFilePicker({
                    suggestedName: filename + ".mp4",
                    types: [{ description: 'MP4 Video', accept: {'video/mp4': ['.mp4']} }],
                });
                const w = await handle.createWritable();
                await w.write(out);
                await w.close();
            } else {
                throw new Error("Use fallback");
            }
        } catch (_) {
            const blob = new Blob([out.buffer], { type: "video/mp4" });
            const u = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = u;
            a.download = filename + ".mp4";
            document.body.appendChild(a);
            a.click();
            a.remove();
        }
        
        overlay.setStep("下载完成");
        overlay.setProgress(100);
        overlay.done();
        setTimeout(() => overlay.remove(), 5000);

    } catch (e) {
        console.error("Download Error", e);
        
        // Handle Big File / OOM
        if (e.name === "BigFileError" || e.name === "OOMError" || e.message.includes("File too large")) {
            overlay.setStep("文件过大");
            overlay.setDetail("无法在浏览器内存中合并 >1.8GB 文件");
            
            // Allow UI update
            await new Promise(r => setTimeout(r, 100));
            
            if (confirm(`检测到文件过大(或内存不足)，无法合并。\n\n是否分别下载视频和音频轨道？`)) {
                const baseTitle = (videoTitle || rawTitle || "bilibili_video").trim();
                const safeName = getSafeFilename(baseTitle.slice(0, 5));
                triggerBgDownload({ urls: getVideoUrlCandidates(vTrackArr), url: vUrl, filename: "视频-" + safeName + ".mp4" });
                setTimeout(() => triggerBgDownload({ urls: getAllUrls(aTrack), url: aUrl, filename: "音频-" + safeName + ".mp3" }), 1000);
                if (window.showSaveFilePicker) {
                  overlay.addBtn("流式保存", async () => {
                    try {
                      await startSplitStreamingSave();
                    } catch (err) {
                      overlay.setStep("下载失败");
                      overlay.setDetail(err && err.message ? err.message : "下载失败");
                      overlay.done();
                    }
                  });
                }
            }
            
            overlay.done();
            return;
        }

        if (e.name === "AbortError") {
            overlay.setStep("已取消");
            setTimeout(() => overlay.remove(), 2000);
            return;
        }

        // Critical Fallback: Save separate files if download succeeded but merge failed
        // Note: vBin/aBin are local to the try block above, but we can't easily access them here
        // unless we lift them up. However, due to scope, we need to redefine them outside.
        // Wait, I cannot redefine 'vBin' here because it's inside the 'try' block in the original code.
        // I need to change the structure in the 'SearchReplace'.
        
        overlay.setStep("出错啦");
        overlay.setDetail(e.message);
        
        // Check if it is a fetch error during merge (e.g. ffmpeg load)
        if (confirm("合并失败: " + e.message + "\n\n是否尝试分别下载已获取的视频/音频轨道？\n(如果不保存，已下载的数据将丢失)")) {
             const baseTitle = (videoTitle || rawTitle || "bilibili_video").trim();
             const safeName = getSafeFilename(baseTitle.slice(0, 5));
             if (vUrl) triggerBgDownload({ urls: getVideoUrlCandidates(vTrackArr), url: vUrl, filename: "视频-" + safeName + ".mp4" });
             if (aUrl) setTimeout(() => triggerBgDownload({ urls: getAllUrls(aTrack), url: aUrl, filename: "音频-" + safeName + ".mp3" }), 1000);
        }
    }

  } catch (err) {
    // Show error in overlay
    const overlay = document.getElementById("bili-download-overlay");
    if (overlay) {
        // Simple manual update if overlay object is lost in scope (it shouldn't be)
        // But we are in the main IIFE catch, overlay variable is not accessible here if defined inside.
        // Wait, 'overlay' is defined inside the IIFE, so it is accessible in this catch block?
        // NO. 'overlay' is defined inside the 'try' block of the IIFE.
        // So we cannot access 'overlay' variable here.
        // We must rely on DOM.
        const step = overlay.querySelector("div:nth-child(2)"); // Step div
        const detail = overlay.querySelector("div:nth-child(4)"); // Detail div
        if (step) step.textContent = "出错啦";
        if (detail) detail.textContent = err.message;
        
        // Add a close button if not present or stuck
        // ...
    } else {
        alert("脚本启动失败: " + err.message);
    }
    console.error(err);
  }
})();
