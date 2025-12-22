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
      
      let out;
      let loaded = 0;
      let chunks = null;
      
      if (total) {
        // Optimization: Pre-allocate memory if size is known
        try {
           out = new Uint8Array(total);
        } catch (eAlloc) {
           throw new Error("内存不足，无法分配 " + fmtBytes(total) + " 空间: " + eAlloc.message);
        }
      } else {
        chunks = [];
      }

      const start = performance.now();
      overlay.setStep(`正在下载${label}...`);
      overlay.setDetail(total ? `大小 ${fmtBytes(total)}` : "大小未知");
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        if (out) {
          // Direct write to pre-allocated buffer
          if (loaded + value.length > out.length) {
             // Should not happen if content-length is correct, but just in case
             // If it happens, we might need to resize (expensive) or just fail
             // For now, let's assume content-length is reliable for Bilibili
             throw new Error("下载数据超出预期大小");
          }
          out.set(value, loaded);
        } else {
          chunks.push(value);
        }
        
        loaded += value.length;

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
      
      if (!out) {
        out = new Uint8Array(loaded);
        let offset = 0;
        for (const c of chunks) { out.set(c, offset); offset += c.length; }
      }
      
      return out;
    }

    // 加载 FFmpeg (提前加载以利用流式写入)
    let createFFmpeg, ffmpeg;
    const loadFFmpeg = async () => {
       overlay.setStep("正在加载核心组件...");
       const tLoadStart = performance.now();
       
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
      await setStatus({ step: "核心组件加载完成", progress: 5, detail: `用时 ${fmtTime(tLoad)}` });
      return ffmpeg;
    };

    // 流式下载并写入 FFmpeg FS
    async function fetchToFFmpeg(u, label, fsFilename) {
      const r = await fetch(u, { credentials: "omit", referrerPolicy: "strict-origin-when-cross-origin", signal });
      if (!r.ok) throw new Error(label + "拉取失败: " + r.status);
      
      const total = Number(r.headers.get("content-length")) || 0;
      const reader = r.body?.getReader?.();
      if (!reader) throw new Error("无法获取流式读取器");

      // Open file in FFmpeg MEMFS
      // FS.open(path, flags, mode) -> flags: 'w' (write) is not direct int. 
      // Usually in Emscripten FS: 'w' needs to be translated or use high level if possible.
      // But ffmpeg.FS only exposes writeFile (all at once).
      // We need to use the underlying FS object if available, OR simple append workaround.
      // FFmpeg.wasm v0.11.x exposes FS via ffmpeg.FS(method, ...args) but it maps to MEMFS.
      // There isn't a stream writer exposed easily in v0.11.x high level API.
      // WORKAROUND: We can use `ffmpeg.FS('writeFile', name, data)` but that overwrites.
      // We need to access the Emscripten FS directly. 
      // Luckily, createFFmpeg usually doesn't expose raw FS easily.
      // BUT, we can use a simpler approach: 
      // If we cannot stream-write to FFmpeg, we are still bound by JS memory if we buffer in JS.
      
      // WAIT! We can try to access the FS via internal property if possible, OR
      // We accept that we might need to rely on the browser's separate download if it's too huge.
      // However, the user specifically asked for a way to MERGE huge files.
      
      // Let's try to simulate stream writing:
      // Since we can't easily stream-write to FFmpeg.wasm v0.11 without hacks,
      // We will stick to the "Fallback to separate download" for super huge files,
      // BUT we can optimize the "Save" part using File System Access API.
      
      // RE-EVALUATION: The user's error "Array buffer allocation failed" happens at `new Uint8Array(total)`.
      // This is because we try to allocate 100% of the file size in one go.
      // If we use an array of chunks (List<Uint8Array>), we avoid one huge contiguous allocation.
      // FFmpeg.wasm `writeFile` accepts `Uint8Array`.
      // If we pass a huge Uint8Array to `writeFile`, it copies it to Wasm memory.
      // This copy operation might also crash if Wasm memory is full.
      
      // Best Effort Approach:
      // 1. Keep chunks in a list (don't merge to one Uint8Array in JS).
      // 2. This avoids the `new Uint8Array(total)` crash.
      // 3. When writing to FFmpeg, we unfortunately need to pass a buffer.
      //    But maybe we can write chunks?
      //    ffmpeg.FS doesn't support append.
      //    However, we can overwrite? No.
      
      // Let's try to access the Emscripten FS.
      // Usually `ffmpeg.FS` IS the Emscripten FS interface in some versions.
      // If `ffmpeg.FS('open', ...)` works, we are golden.
      // Let's try to use the chunk-list approach first to solve the JS allocation error.
      
      // OOM Fix Phase 1: Avoid `new Uint8Array(total)`. Use chunk list.
      // But `ffmpeg.FS('writeFile', ...)` expects data.
      // If we construct a Blob from chunks, and then read arrayBuffer? Still creates huge buffer.
      
      // Let's assume we can only solve the JS side allocation.
      // We will store chunks in an array.
      // Then we use `ffmpeg.FS('writeFile', filename, ...)` 
      // The `data` argument for writeFile can be a Uint8Array.
      // Creating that Uint8Array is what crashes.
      
      // Is there a way to write partial?
      // No standard API in v0.11.
      
      // OK, Plan B:
      // We will download chunks.
      // We will try to merge them into a Uint8Array ONLY when passing to FFmpeg.
      // This delays the crash but doesn't solve it.
      
      // Let's implement the Chunk List approach to replace the pre-allocation approach.
      // It is safer than `new Uint8Array(2GB)`.
      
      let loaded = 0;
      const chunks = [];
      const start = performance.now();
      overlay.setStep(`正在下载${label}...`);
      overlay.setDetail(total ? `大小 ${fmtBytes(total)}` : "大小未知");
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;

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
      
      // Create the huge buffer ONLY at the very end
      // 如果合并切片失败，说明无法创建大的 Uint8Array
      // 此时我们无法通过 FFmpeg 合并（因为 FFmpeg.FS 必须接受 Buffer），
      // 但我们仍然可以尝试“分片写入”到本地文件，或者直接抛出特殊错误让上层降级
      try {
          // 尝试检测是否能分配
          // 如果不行，直接 throw
          const out = new Uint8Array(loaded);
          let offset = 0;
          for (const c of chunks) { out.set(c, offset); offset += c.length; }
          return out;
      } catch(e) {
          // 特殊标记错误对象，携带数据以便救援
          const err = new Error("内存不足(合并切片失败): " + e.message);
          err.chunks = chunks; // 把数据挂在 error 上，万一我们能救？
          err.label = label; // 记录是视频还是音频
          // 其实这里如果 new Uint8Array 失败，说明内存真的不够了。
          // 我们无法给 FFmpeg 喂数据。
          // 唯一能做的是：直接把 chunks 存成文件（不合并）。
          // 或者，我们可以尝试流式写入 FFmpeg？
          // 不，FFmpeg.FS 在 v0.11 里是基于 MEMFS，也是内存。
          // 所以如果 JS 侧都爆了，Wasm 侧肯定也爆。
          throw err;
      }
    }

    // 尝试使用 File System Access API 保存
    async function saveFile(filename, buffer) {
       try {
         // @ts-ignore
         if (window.showSaveFilePicker) {
            const handle = await window.showSaveFilePicker({
              suggestedName: filename,
              types: [{
                description: 'MP4 Video',
                accept: {'video/mp4': ['.mp4']},
              }],
            });
            const writable = await handle.createWritable();
            await writable.write(buffer);
            await writable.close();
            return true;
         }
       } catch(e) {
         console.warn("File System API failed, falling back to download", e);
       }
       return false;
    }

    let vBin, aBin;
     try {
       // Parallel download? No, sequential to save memory peak? 
       // Parallel is faster but uses double memory at peak. 
       // Let's do sequential for safety if we are worried about memory.
       // User asked for solution to "Memory Insufficient". Sequential is safer.
       
       // Load FFmpeg first?
       // Actually, let's keep downloading first, but use the chunk list approach (fetchToFFmpeg).
       // If we load FFmpeg first, we hold FFmpeg memory + Download memory. Bad idea.
       // Better: Download -> Load FFmpeg -> Write -> Merge -> Free -> Save.
       
       try {
          vBin = await fetchToFFmpeg(vUrl, "视频");
          aBin = await fetchToFFmpeg(aUrl, "音频");
        } catch (eMem) {
          if (eMem.message.includes("内存不足") && eMem.chunks) {
             const isVideo = eMem.label === "视频";
             const trackName = isVideo ? "_video.m4s" : "_audio.m4s";
             
             let msg = "内存不足，无法在浏览器内完成合并。\n\n是否保存已下载的原始轨道数据？";
             if (!isVideo && vBin) {
                 msg += "\n(检测到视频已下载成功，将一并保存)";
             }
             
             if (confirm(msg)) {
                 // 1. 保存导致报错的那个轨道（chunks）
                 const blob = new Blob(eMem.chunks, { type: "video/mp4" });
                 const a = document.createElement("a");
                 a.href = URL.createObjectURL(blob);
                 
                 // 明确文件名为 [视频] 和 [音频] 前缀，方便小白区分
                 // 例如: [视频]神偷奶爸...m4s
                 const prefix = isVideo ? "[视频]" : "[音频]";
                 a.download = prefix + filename + ".m4s";
                 
                 document.body.appendChild(a);
                 a.click();
                 a.remove();
                 
                 // 2. 如果是音频报错，且视频之前已经下载好了，把视频也存下来
                 if (!isVideo && vBin) {
                     setTimeout(() => {
                         const blobV = new Blob([vBin], { type: "video/mp4" });
                         const aV = document.createElement("a");
                         aV.href = URL.createObjectURL(blobV);
                         aV.download = "[视频]" + filename + ".m4s";
                         document.body.appendChild(aV);
                         aV.click();
                         aV.remove();
                     }, 1000);
                 }
                 
                 // 3. 如果是视频报错，说明音频还没下。
                 // 此时是否尝试下载音频？
                 if (isVideo && aUrl) {
                     // 用户交互优化：明确询问是否需要下载音频
                     if (confirm("视频轨道已由于内存不足自动保存。\n\n是否需要继续下载音频轨道？\n(点击“确定”下载音频，点击“取消”结束)")) {
                         setTimeout(() => {
                             const aAudio = document.createElement("a");
                             aAudio.href = aUrl;
                             aAudio.download = "[音频]" + filename + ".m4s";
                             document.body.appendChild(aAudio);
                             aAudio.click();
                             aAudio.remove();
                         }, 1000);
                     }
                 }

                 window.dispatchEvent(new CustomEvent("BILI_DOWN_STATUS", { detail: { step: "已保存原始轨道", progress: 100, detail: "内存不足以合并，已保存原始数据", done: true } }));
                 return;
             }
          }
          throw eMem;
        }
     } catch (eFetch) {
       // ... error handling ...
       throw eFetch;
    }
 
     // ... FFmpeg loading ...
     if (!ffmpeg) {
         ffmpeg = await loadFFmpeg();
     }
     
     // 写入与合并
     overlay.setStep("正在合并音视频...");
     const tMergeStart = performance.now();
     await ffmpeg.FS("writeFile", "v.m4s", vBin);
     vBin = null; // Free memory immediately
     await ffmpeg.FS("writeFile", "a.m4s", aBin);
     aBin = null; // Free memory immediately

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
     await ffmpeg.FS("unlink", "out.mp4"); // Free MEMFS
     await ffmpeg.FS("unlink", "v.m4s");
     await ffmpeg.FS("unlink", "a.m4s");

     // Try File System Access API first
     const saved = await saveFile(filename + ".mp4", out);
     
     if (!saved) {
        const blob = new Blob([out.buffer], { type: "video/mp4" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename + ".mp4";
        document.body.appendChild(a);
        a.click();
        a.remove();
     }

     overlay.setProgress(100);
     overlay.setStep("下载完成");
     overlay.setDetail(`合并耗时 ${fmtTime(tMerge)}，总大小 ${fmtBytes(out.byteLength)}`);
     overlay.done();
     await setStatus({ step: "下载完成", progress: 100, detail: `文件 ${filename}.mp4 已保存到${saved ? '所选位置' : '浏览器默认下载目录'}` , filename: filename + ".mp4", done: true });
     setTimeout(() => overlay.remove(), 5000);

   } catch (e) {
    if (e.name === 'AbortError') {
      console.log("Download aborted by user");
      return;
      // 3. Last fallback: Separate download
      if (confirm("下载失败: " + e.message + "\n\n是否尝试分别下载视频和音频轨道？\n(需要您手动合并或使用播放器加载)")) {
         if (vUrl) {
           const a1 = document.createElement("a");
           a1.href = vUrl;
           a1.download = filename + "_video.m4s";
           document.body.appendChild(a1);
           a1.click();
           a1.remove();
         }
         if (aUrl) {
           setTimeout(() => {
             const a2 = document.createElement("a");
             a2.href = aUrl;
             a2.download = filename + "_audio.m4s";
             document.body.appendChild(a2);
             a2.click();
             a2.remove();
           }, 1000);
         }
         window.dispatchEvent(new CustomEvent("BILI_DOWN_STATUS", { detail: { step: "已触发分别下载", progress: 100, detail: "请查收 _video.m4s 和 _audio.m4s 文件", done: true } }));
         return;
      }
    }
    alert("下载失败: " + e.message);
    window.dispatchEvent(new CustomEvent("BILI_DOWN_STATUS", { detail: { step: "下载失败", progress: 0, detail: e.message, error: true, ts: Date.now() } }));
  }
})();
