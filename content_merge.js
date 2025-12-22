(async () => {
  try {
    const setStatus = async (payload) => {
      window.dispatchEvent(new CustomEvent("BILI_DOWN_STATUS", { detail: payload }));
    };
    // Global abort controller for cancellation
    const controller = new AbortController();
    const signal = controller.signal;
    
    const overlay = (() => {
      const el = document.createElement("div");
      el.style.position = "fixed";
      el.style.right = "16px";
      el.style.bottom = "16px";
      el.style.zIndex = "999999";
      el.style.background = "rgba(0,0,0,0.75)";
      el.style.color = "#fff";
      el.style.font = "14px/1.6 system-ui,Segoe UI,Arial";
      el.style.padding = "12px 14px";
      el.style.borderRadius = "10px";
      el.style.boxShadow = "0 6px 20px rgba(0,0,0,0.3)";
      
      el.style.cursor = "move"; // Indicate draggable

      // Drag logic
      let isDragging = false;
      let startX, startY, initialLeft, initialTop;

      el.addEventListener("mousedown", (e) => {
        // Prevent default to avoid text selection etc
        // But allow clicking the cancel button? Cancel button has its own click handler which should fire.
        if (e.target.textContent === "取消下载") return; 
        
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        
        const rect = el.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        
        // Switch to explicit left/top for positioning
        el.style.right = "auto";
        el.style.bottom = "auto";
        el.style.left = initialLeft + "px";
        el.style.top = initialTop + "px";
        
        e.preventDefault(); 
      });

      window.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        el.style.left = (initialLeft + dx) + "px";
        el.style.top = (initialTop + dy) + "px";
      });

      window.addEventListener("mouseup", () => {
        isDragging = false;
      });

      const stepDiv = document.createElement("div");
      stepDiv.id = "vd-step";
      stepDiv.textContent = "准备中...";
      el.appendChild(stepDiv);

      const barContainer = document.createElement("div");
      barContainer.style.marginTop = "6px";
      barContainer.style.width = "280px";
      barContainer.style.background = "#333";
      barContainer.style.borderRadius = "6px";
      barContainer.style.overflow = "hidden";
      
      const barDiv = document.createElement("div");
      barDiv.id = "vd-bar";
      barDiv.style.height = "8px";
      barDiv.style.width = "0";
      barDiv.style.background = "#00aeec";
      barContainer.appendChild(barDiv);
      el.appendChild(barContainer);

      const detailDiv = document.createElement("div");
      detailDiv.id = "vd-detail";
      detailDiv.style.marginTop = "6px";
      detailDiv.style.opacity = ".9";
      el.appendChild(detailDiv);
      
      // Cancel Button
      const cancelBtn = document.createElement("div");
      cancelBtn.textContent = "取消下载";
      cancelBtn.style.marginTop = "8px";
      cancelBtn.style.textAlign = "right";
      cancelBtn.style.fontSize = "12px";
      cancelBtn.style.color = "#ff6b6b";
      cancelBtn.style.cursor = "pointer";
      cancelBtn.style.textDecoration = "underline";
      cancelBtn.onclick = () => {
        controller.abort();
        el.remove();
        window.dispatchEvent(new CustomEvent("BILI_DOWN_STATUS", { detail: { step: "已取消", progress: 0, detail: "用户取消下载", error: true } }));
      };
      el.appendChild(cancelBtn);

      document.body.appendChild(el);
      
      return {
        setStep: (t) => (stepDiv.textContent = t),
        setProgress: (p) => (barDiv.style.width = Math.max(0, Math.min(100, p)) + "%"),
        setDetail: (t) => (detailDiv.textContent = t),
        done: () => {
           el.style.background = "rgba(0,0,0,0.55)";
           cancelBtn.style.display = "none";
        },
        remove: () => el.remove()
      };
    })();

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


    async function resolveYouTube() {
      let playerResponse = window.ytInitialPlayerResponse;
      if (!playerResponse) {
           const html = document.documentElement.innerHTML;
           const match = html.match(/var ytInitialPlayerResponse = ({.*?});/);
           if (match) {
               try { playerResponse = JSON.parse(match[1]); } catch(e){}
           }
      }
      if (!playerResponse || !playerResponse.streamingData) return null;
      
      const formats = playerResponse.streamingData.adaptiveFormats;
      if (!formats) return null;
      
      // Filter video (mp4) and audio (mp4/m4a)
      const videos = formats.filter(f => f.mimeType.includes("video/mp4") && f.url);
      const audios = formats.filter(f => f.mimeType.includes("audio/mp4") && f.url);
      
      if (!videos.length || !audios.length) return null;
      
      // Pick best quality by bitrate
      videos.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
      audios.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
      
      return {
          video: videos[0].url,
          audio: audios[0].url
      };
    }

    // Helper to get BVID from URL or Page State
    const getBvid = async () => {
      // 1. Try URL (video)
      const m = location.pathname.match(/\/video\/(BV[\w]+)/i);
      if (m) return m[1];
      
      // 2. Try URL (bangumi ep)
      const epMatch = location.pathname.match(/\/bangumi\/play\/ep(\d+)/i);
      if (epMatch) {
        const epId = epMatch[1];
        try {
          // Use PGC API to get episode info
          const res = await fetch(`https://api.bilibili.com/pgc/view/web/season?ep_id=${epId}`);
          const json = await res.json();
          const episodes = json?.result?.episodes || [];
          const targetEp = episodes.find(e => e.id == epId);
          if (targetEp && targetEp.bvid) return targetEp.bvid;
        } catch (_) {}
      }

      // 3. Try URL (bangumi ss)
      const ssMatch = location.pathname.match(/\/bangumi\/play\/ss(\d+)/i);
      if (ssMatch) {
        const seasonId = ssMatch[1];
        try {
          const res = await fetch(`https://api.bilibili.com/pgc/view/web/season?season_id=${seasonId}`);
          const json = await res.json();
          // Try to find current episode from user status or default to first
          // Note: Without login, user_status might be empty, so we default to first ep?
          // Or we can rely on window.__INITIAL_STATE__ if available.
          // Let's try to get the first episode's BVID as fallback
          if (json?.result?.episodes?.length > 0) {
             return json.result.episodes[0].bvid;
          }
        } catch (_) {}
      }
      
      // 4. Try Global State (common in bangumi/video pages)
      try {
        if (window.__INITIAL_STATE__) {
           if (window.__INITIAL_STATE__.bvid) return window.__INITIAL_STATE__.bvid;
           if (window.__INITIAL_STATE__.epInfo && window.__INITIAL_STATE__.epInfo.bvid) return window.__INITIAL_STATE__.epInfo.bvid;
           if (window.__INITIAL_STATE__.videoData && window.__INITIAL_STATE__.videoData.bvid) return window.__INITIAL_STATE__.videoData.bvid;
        }
      } catch (_) {}
      return null;
    };

    async function resolveBilibili() {
      const p = window.__playinfo__ || window.playinfo || null;
      if (p && p.dash) return p.dash;
      
      const bvid = await getBvid();
      if (!bvid) return null;
      try {
        const viewRes = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, { credentials: "include" });
        const viewJson = await viewRes.json();
        const vd = viewJson?.data || {};
        const cid = vd.cid || (vd.pages && vd.pages[0] && vd.pages[0].cid) || 0;
        if (!cid) return null;
        const playRes = await fetch(`https://api.bilibili.com/x/player/playurl?cid=${cid}&bvid=${bvid}&qn=120&fnval=4048&fourk=1`, { credentials: "include" });
        const playJson = await playRes.json();
        const data = playJson?.data || {};
        if (data.dash) return data.dash;
        return null;
      } catch (_) {
        return null;
      }
    }

    const pickBestBilibili = (arr) => {
      if (!arr || arr.length === 0) return null;
      let maxId = 0;
      for (const x of arr) { if ((x.id || 0) > maxId) maxId = x.id || 0; }
      const candidates = arr.filter(x => (x.id || 0) === maxId);
      let best = candidates[0];
      for (const x of candidates) {
        if ((x.bandwidth || 0) > (best.bandwidth || 0)) best = x;
      }
      return best.baseUrl || best.base_url || best.backupUrl?.[0];
    };

    let vUrl, aUrl, filename;
    const dash = await resolveBilibili();
    if (!dash) {
      overlay.setStep("未找到 Bilibili 播放信息");
      await setStatus({ step: "未找到播放信息", progress: 0, detail: "可能需要登录或会员权限" });
      return;
    }
    vUrl = pickBestBilibili(dash.video);
    aUrl = pickBestBilibili(dash.audio);
    filename = (document.title || "bilibili").replace(/[\\/:*?\"<>|]/g, "");

    if (!vUrl || !aUrl) {
      overlay.setStep("未获取到音视频地址");
      await setStatus({ step: "未获取到音视频地址", progress: 0, detail: "" });
      return;
    }

    async function fetchWithProgress(u, label) {
      // referrerPolicy: "strict-origin-when-cross-origin" handles generic cases
      // rules.json handles specific header injection for bilibili domains
      const r = await fetch(u, { credentials: "omit", referrerPolicy: "strict-origin-when-cross-origin", signal });
      if (!r.ok) throw new Error(label + "拉取失败: " + r.status);
      const total = Number(r.headers.get("content-length")) || 0;
      const reader = r.body?.getReader?.();
      if (!reader) {
        const b = await r.arrayBuffer();
        return new Uint8Array(b);
      }
      let loaded = 0;
      const start = performance.now();
      const chunks = [];
      overlay.setStep(`正在下载${label}...`);
      overlay.setDetail(total ? `大小 ${fmtBytes(total)}` : "大小未知");
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        loaded += value.length;
        chunks.push(value);
        if (total) {
          const p = (loaded / total) * 50; 
          overlay.setProgress(p);
          const elapsed = (performance.now() - start) / 1000;
          const speed = loaded / elapsed;
          const eta = total ? (total - loaded) / speed : 0;
          overlay.setDetail(`已下载 ${fmtBytes(loaded)} / ${fmtBytes(total)}，速度 ${fmtBytes(speed)}/s，剩余约 ${fmtTime(eta)}`);
          await setStatus({ step: `正在下载${label}`, progress: Math.round(p), detail: `已下载 ${fmtBytes(loaded)} / ${fmtBytes(total)}，速度 ${fmtBytes(speed)}/s，剩余约 ${fmtTime(eta)}` });
        } else {
          overlay.setDetail(`已下载 ${fmtBytes(loaded)}`);
          await setStatus({ step: `正在下载${label}`, progress: 0, detail: `已下载 ${fmtBytes(loaded)}` });
        }
      }
      const out = new Uint8Array(loaded);
      let offset = 0;
      for (const c of chunks) { out.set(c, offset); offset += c.length; }
      return out;
    }

    // 下载视频与音频
    let vBin, aBin;
    try {
      vBin = await fetchWithProgress(vUrl, "视频");
      aBin = await fetchWithProgress(aUrl, "音频");
    } catch (eFetch) {
      overlay.setStep("拉取失败，尝试 1080P 直链");
      await setStatus({ step: "拉取失败，尝试 1080P 直链", progress: 0, detail: eFetch.message });
      const m = location.pathname.match(/\/video\/(BV[\w]+)/i);
      const bvid = m ? m[1] : "";
      const viewRes = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, { credentials: "include" });
      const viewJson = await viewRes.json();
      const vd = viewJson?.data || {};
      const cid = vd.cid || (vd.pages && vd.pages[0] && vd.pages[0].cid) || 0;
      const playRes = await fetch(`https://api.bilibili.com/x/player/playurl?cid=${cid}&bvid=${bvid}&qn=80&fnval=0`, { credentials: "include" });
      const playJson = await playRes.json();
      const durl = playJson?.data?.durl?.[0]?.url;
      if (durl) {
        const a = document.createElement("a");
        a.href = durl;
        a.download = (document.title || "bilibili").replace(/[\\/:*?\"<>|]/g, "") + ".mp4";
        document.body.appendChild(a);
        a.click();
        a.remove();
        overlay.setStep("已保存 1080P 直链");
        overlay.setProgress(100);
        await setStatus({ step: "下载完成（1080P直链）", progress: 100, detail: "由于跨域限制，已保存 1080P MP4" , done: true });
        setTimeout(() => overlay.remove(), 5000);
        return;
      } else {
        throw eFetch;
      }
    }
    overlay.setProgress(50);
    await setStatus({ step: "已下载音视频数据", progress: 50, detail: "" });

    // 加载 FFmpeg
    overlay.setStep("正在加载合并组件...");
    const tLoadStart = performance.now();
    let createFFmpeg, ffmpeg;
    
    // Fallback function for 1080P direct download
    async function fallbackTo1080P(reason) {
      console.warn("Falling back to 1080P due to:", reason);
      overlay.setStep("合并失败，尝试 1080P 直链");
      await setStatus({ step: "合并失败，尝试 1080P 直链", progress: 60, detail: reason });
      
      const bvid = await getBvid();
      if (!bvid) throw new Error("无法获取 BVID");
      
      const viewRes = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, { credentials: "include" });
      const viewJson = await viewRes.json();
      const vd = viewJson?.data || {};
      const cid = vd.cid || (vd.pages && vd.pages[0] && vd.pages[0].cid) || 0;
      
      const playRes = await fetch(`https://api.bilibili.com/x/player/playurl?cid=${cid}&bvid=${bvid}&qn=80&fnval=0`, { credentials: "include" });
      const playJson = await playRes.json();
      const durl = playJson?.data?.durl?.[0]?.url;
      
      if (durl) {
        const a = document.createElement("a");
        a.href = durl;
        a.download = (document.title || "bilibili").replace(/[\\/:*?\"<>|]/g, "") + ".mp4";
        document.body.appendChild(a);
        a.click();
        a.remove();
        overlay.setStep("已保存 1080P 直链");
        overlay.setProgress(100);
        overlay.done();
        await setStatus({ step: "下载完成（1080P直链）", progress: 100, detail: "4K合并失败(" + reason + ")，已保存1080P", done: true });
        setTimeout(() => overlay.remove(), 5000);
      } else {
        throw new Error("无法获取 1080P 直链");
      }
    }

    try {
      // Helper to load script via DOM tag
      const loadScript = (url) => {
        return new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = url;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("Script load failed: " + url));
          document.head.appendChild(s);
        });
      };

      try {
        const coreUrl = window.__FFMPEG_CORE_URL__;
        
        // 1. Check if already loaded
        if (window.FFmpeg && window.FFmpeg.createFFmpeg) {
           createFFmpeg = window.FFmpeg.createFFmpeg;
        } 
        // 2. If not, try to load using the injected URL
        else {
           const ffUrl = window.__FFMPEG_URL__;
           if (ffUrl) {
             try {
               await loadScript(ffUrl);
               createFFmpeg = window.FFmpeg?.createFFmpeg;
             } catch(e) { 
               console.warn("Script tag injection failed, trying dynamic import...", e);
               // 3. Last resort: dynamic import (might fail due to CSP)
               await import(ffUrl);
               createFFmpeg = window.FFmpeg?.createFFmpeg;
             }
           }
        }
        
        if (!createFFmpeg) throw new Error("Could not find createFFmpeg");

        ffmpeg = createFFmpeg({
          corePath: coreUrl,
          log: false
        });
        await ffmpeg.load();
      } catch (e) {
        console.warn("Local FFmpeg failed, trying CDN...", e);
        // Fallback to CDN (Single Threaded Version to avoid SharedArrayBuffer issues)
        await import("https://unpkg.com/@ffmpeg/ffmpeg@0.11.2/dist/ffmpeg.min.js");
        createFFmpeg = window.FFmpeg.createFFmpeg;
        ffmpeg = createFFmpeg({
          corePath: "https://unpkg.com/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js",
          log: false,
          mainName: 'main' 
        });
        await ffmpeg.load();
      }
      const tLoad = (performance.now() - tLoadStart) / 1000;
      await setStatus({ step: "正在加载合并组件", progress: 55, detail: `组件加载用时 ${fmtTime(tLoad)}` });
  
      // 写入与合并
      overlay.setStep("正在合并音视频...");
      overlay.setDetail("已加载组件，用时 " + fmtTime(tLoad));
      const tMergeStart = performance.now();
      await ffmpeg.FS("writeFile", "v.m4s", vBin);
      await ffmpeg.FS("writeFile", "a.m4s", aBin);
      const mergeTimer = setInterval(() => {
        const elapsed = (performance.now() - tMergeStart) / 1000;
        overlay.setDetail("正在合并... 已用时 " + fmtTime(elapsed));
        setStatus({ step: "正在合并音视频", progress: 75, detail: "已用时 " + fmtTime(elapsed) });
      }, 1000);
      await ffmpeg.run("-i", "v.m4s", "-i", "a.m4s", "-c", "copy", "out.mp4");
      clearInterval(mergeTimer);
      const tMerge = (performance.now() - tMergeStart) / 1000;
      overlay.setProgress(95);
      await setStatus({ step: "合并完成，正在保存", progress: 95, detail: `合并耗时 ${fmtTime(tMerge)}` });
  
      // 读取与保存
      overlay.setStep("正在保存文件...");
      const out = await ffmpeg.FS("readFile", "out.mp4");
      const blob = new Blob([out.buffer], { type: "video/mp4" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename + ".mp4";
      document.body.appendChild(a);
      a.click();
      a.remove();
      overlay.setProgress(100);
      overlay.setStep("下载完成");
      overlay.setDetail(`合并耗时 ${fmtTime(tMerge)}，总大小 ${fmtBytes(out.byteLength)}`);
      overlay.done();
      await setStatus({ step: "下载完成", progress: 100, detail: `文件 ${filename}.mp4 已保存到浏览器默认下载目录` , filename: filename + ".mp4", done: true });
      setTimeout(() => overlay.remove(), 5000);
    } catch (eFF) {
      // If FFmpeg fails (SharedArrayBuffer or otherwise), try 1080P fallback
      await fallbackTo1080P(eFF.message);
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      console.log("Download aborted by user");
      return;
    }
    alert("下载失败: " + e.message);
    window.dispatchEvent(new CustomEvent("BILI_DOWN_STATUS", { detail: { step: "下载失败", progress: 0, detail: e.message, error: true, ts: Date.now() } }));
  }
})();
