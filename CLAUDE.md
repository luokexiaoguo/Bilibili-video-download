# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bilibili Video Downloader (BiliDown) — a Chrome/Edge browser extension (Manifest V3) for downloading Bilibili videos, anime, courses (cheese), and movies. Uses FFmpeg.wasm for local audio/video merging. Pure vanilla JS, no build system, no package manager, no tests.

## Development

This is an **unpacked extension** — no build step needed. Load the root directory (containing `manifest.json`) via `chrome://extensions/` → "Load unpacked" with Developer Mode enabled. Reload the extension after changes.

**Critical**: Do NOT create directories starting with `_` in the project root (except `_locales`). Chrome rejects extensions with such directories (`__pycache__` etc). Note: `_metadata/` appears at root after loading — that's Chrome's own generated file, gitignored, leave it alone.

There is no linter, formatter, or test suite configured.

## Release / Versioning

Version lives in `manifest.json` (`version`). Each release bumps it and adds a changelog entry to the top of the "更新日志" sections in **both** `README.md` and `README_EN.md` (keep them in sync). The release zip is built into `dist/` (gitignored) — no script automates this.

**Release pushes go ONLY to `main` (GitHub + Gitee), never `master`** — despite active development happening on `master`, release commits/tags are pushed to `main`. Keep `dist/` containing only the newest version's zip when packaging.

**Sponsor links must never be dropped.** The afdian sponsor entry is intentional and permanent:
- `.github/FUNDING.yml` — `custom: https://afdian.com/a/luokexiaoguo` (drives the "Sponsor this project" button on the GitHub repo sidebar)
- README.md / README_EN.md — sponsor badge in the top badge row + "❤️ 赞助"/"❤️ Sponsor" section at the footer

When updating READMEs (changelog, features, etc.), preserve these sponsor elements as-is. If a README rewrite or refactor removes them, restore them in the same commit. The FUNDING.yml file must always be present on `main`.

## Architecture

Three-layer script architecture with Chrome's ISOLATED/MAIN world separation:

```
popup.html/popup.js  →  content_bridge.js (ISOLATED world)  ↔  service_worker.js
                              ↕ CustomEvents
                        content_merge.js (MAIN world)
```

### Key Constraint: MAIN World Cannot Access Chrome APIs

`content_merge.js` runs in the page's MAIN world where `chrome.runtime` is `undefined`. ALL communication with the extension (FFmpeg loading, downloads) MUST go through CustomEvents to `content_bridge.js`, which runs in the ISOLATED world.

### Content Script Communication (CustomEvents on window)

| Event | Direction | Purpose |
|-------|-----------|---------|
| `BILI_TRIGGER_DOWNLOAD` | MAIN→ISOLATED | 🔴 Legacy — no longer used. All downloads use `fetch()` directly. |
| `BILI_TRIGGER_FFMPEG` | MAIN→ISOLATED | Request FFmpeg files from service worker |
| `BILI_FFMPEG_RESPONSE` | ISOLATED→MAIN | Return FFmpeg file paths + extension ID |
| `BILI_DOWN_STATUS` / `BILI_BRIDGE_STATUS_UPDATE` | MAIN→ISOLATED | Status updates |
| `BILI_DOWNLOAD_ERROR` | ISOLATED→MAIN | Download failure notification |

### FFmpeg Loading Strategy

FFmpeg files cannot be loaded via data URLs (24MB WASM = 32MB base64, too large). Instead:
1. Bridge verifies files exist via service worker (HEAD requests)
2. Bridge returns extension ID to MAIN world
3. content_merge.js loads `ffmpeg.min.js` from `chrome-extension://<id>/ffmpeg/...` (declared as `web_accessible_resources`)
4. `ffmpeg.load()` is called with `corePath` and `wasmPath` pointing to extension URLs — ffmpeg.wasm handles fetching core JS + WASM from the extension directly
5. **Do NOT pre-load ffmpeg-core.js as a script tag** — was causing WASM to load from unpkg.com default path instead of extension URL

`useMT = !!window.SharedArrayBuffer` (content_merge.js) selects the MT core (`ffmpeg-core.js`) when cross-origin isolation is present, else the ST core (`ffmpeg-core-st.js`). The ST build must be a genuine single-threaded build — a byte-identical "fake ST" (same as MT) still imports SharedArrayBuffer and breaks on pages lacking COOP/COEP. Symptom: first download's merge fails; after browser restart, downloads fail entirely. Verify with `grep -c SharedArrayBuffer ffmpeg/ffmpeg-core-st.js` (expect 0).

### SharedArrayBuffer Requirement

FFmpeg.wasm requires SharedArrayBuffer, which needs cross-origin isolation headers. `rules.json` injects `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless` on bilibili.com video/bangumi/cheese pages via `declarativeNetRequest`.

### Key Data Flow

1. User clicks download → popup injects config globals + bridge + content_merge.js
2. content_merge.js resolves video info via Bilibili APIs
3. Picks best video track (SDR preferred, HDR if requested) and audio track from DASH manifest
4. Calls `showSaveFilePicker` IMMEDIATELY (user gesture required, must not be deferred)
5. **If file < threshold**: downloads video + audio into memory, merges via FFmpeg.wasm, writes merged MP4 to file handle
6. **If file > threshold**: split confirm → `acquireAudioHandle()` gets a second file handle in the same gesture → video streams to its handle, audio to the other (same folder)
7. Falls back to blob URL download for both tracks if file handle unavailable

### Dynamic Merge Threshold

Merge threshold adapts to device memory to avoid WASM OOM:

```
4GB RAM  → 500MB    8GB RAM  → 800MB
16GB RAM → 1.2GB   32GB+ RAM → 1.8GB
```

Formula: `navigator.deviceMemory` based, with conservative clamping.

### Three-Layer Size Protection

1. **HEAD probe**: Quick `Content-Length` / `Content-Range` request BEFORE download starts. If size > threshold, offers split immediately — no wasted download time. CDN may not support HEAD → returns 0, falls through to post-download check.
2. **Early abort in fetchBin**: When downloading response body, reads `Content-Length` header at stream start. Single track already > threshold → throws `FILE_TOO_LARGE` → split dialog.
3. **Post-download safety net**: Always checks actual downloaded size against threshold. Catches cases where HEAD probe failed or returned inaccurate values.

### Split Download Streaming

Large files (>threshold) are split into separate video/audio downloads instead of merging in memory:

- **Video**: Downloaded via `fetch()` with `credentials: 'include'` → on 403 falls back to `credentials: 'omit'`. Streamed to file handle in chunks (no `arrayBuffer()`, no OOM). Progress shown in overlay every 200ms via shared `_prog` state.
- **Audio**: On split confirm, `acquireAudioHandle()` requests a second `showSaveFilePicker` inside the same user gesture → audio is written to the user-chosen file handle, **same folder as the video**. Falls back to blob URL only if the audio picker is cancelled / unsupported.
- **No longer uses `chrome.downloads.download` or `service_worker.js` for downloads** — all download requests go through `fetch()` which respects DNR rules for proper Referer/Origin headers.
- Combined progress in overlay: `"视频: 1.2GB/8.4GB 15% | 音频: ✓"`
- All split fetches pass `signal`; on abort the overlay is removed (no stuck download).

### Memory-Safety & Cleanup

- **Injection guard**: `content_merge.js` re-injects on every click of the download button. A `window.__BILI_DRIVER_ACTIVE__` flag at the top prevents stacking duplicate overlays / window listeners on repeated downloads.
- **Progress throttling**: `fetchBin` updates `overlay.setDetail` at most every 200ms (matching `streamWithProgress`) to avoid high-frequency DOM writes on small chunks.
- `saveBlob` revokes its object URL after 120s; FFmpeg FS files are `unlink`ed after merge.

### Batch Download (合集下载)

A second popup button (`#batch`) sets `window.__BILI_BATCH__ = true` before injecting `content_merge.js`, which branches into `runBatch()` instead of the single-download flow. Batch download grabs all episodes of a collection/multi-part and downloads them serially into one user-chosen directory.

- **Episode discovery** (`getCollectionEpisodes`): unifies UGC合集 (`ugc_season.sections[].episodes`, each ep is an **independent BV**), series, regular multi-P (`pages`), bangumi (`ss`/`ep` season endpoints), and cheese (`epList`). Returns `[{cid, bvid, epId, title, isBangumi?, isCheese?}]`.
- **Per-episode dash** (`resolveEpisodeDash`): MUST use each episode's own `bvid` (UGC合集) — calling `resolveBilibili` directly falls back to `getBvid()` which returns the collection's entry BV, causing bvid/cid mismatch → 412. Routes to `pgc/player/web/playurl` for bangumi, `p/player/playurl` for cheese, `x/player/playurl` otherwise.
- **Save mode**: `showDirectoryPicker({mode:'readwrite'})` once in the user-gesture window → all episodes write into that directory. If the picker is cancelled/rejected (system dir)/unsupported → confirm dialog → fall back to `saveBlob` per file into the browser default download dir. **Large episodes (>threshold) are skipped in blob mode** (would OOM); only the directory mode can stream-split large episodes.
- **Per-episode logic** (`batchDownloadEpisode`): probe size → small files merge in memory via a reused FFmpeg singleton (`_batchFFmpeg`, loaded once across the batch); large files stream-split to video.mp4 + audio.m4a in the same dir. FFmpeg FS files are `unlink`ed after each episode (including on failure) to prevent stale-data bleed across the singleton.
- **Throttling**: serial loop with `await sleep(1500)` between episodes to avoid playurl 412 风控. All fetches share one `AbortController`/`signal` from the overlay.
- **Overlay**: `setBatchMode(true)` reveals a second progress line (`setBatchInfo` "第 N/M 集") + a total-progress bar (`setBatchProgress`), independent of the per-episode detail/progress line.

### URL Pattern Support

The extension supports three URL patterns on bilibili.com:
- `/video/BVxxxxxx` — regular videos (with multi-part `?p=N` support)
- `/bangumi/play/epNNNNNN` / `/bangumi/play/ssNNNNNN` — anime/movies
- `/cheese/play/epNNNNNN` — paid courses (uses `mplayer.getPlayurl()` for direct mp4 URL)

### Multi-Part Video Fix

When user selects a specific part from the multi-part selector, `resolveBilibili(specificCid, specificEpId)` skips `getCurrentVideoCid()` and `__playinfo__` fallback (which return the initial page load's data), going directly to the API with the correct cid/epId.

Supports: regular multi-part videos (`videoData.pages`), bangumi/anime (`epList`/`mediaInfo.episodes`), UGC合集 (`videoData.ugc_season.episodes`), and series (`videoData.series.list`).

### HDR/SDR Track Selection

The `isHdr` function checks: `x.id` for codec IDs 125/126/127, `color_space` for bt2020, `transfer_characteristics` for 16/18, and JSON signature for keywords (dolby, hdr, hlg, pq, arib-std-b67, bt2020). When both pools exist, user preference selects between them. When `isHdr` cannot distinguish (all tracks classified as one type), falls back to SDR pool or full pool.

### Internationalization

- popup.js: inline `I18N` object with `zh`/`en` keys, toggled by button
- content_merge.js: inline `T` object (same pattern)
- `_locales/`: Chrome's `chrome.i18n` messages (manifest.json `__MSG_*__` only)

### DNR Rules (`rules.json`)

| # | Action | Resource Types | Purpose |
|---|--------|---------------|---------|
| 1001 | Set `Referer` + remove `Origin` | `xmlhttprequest`, `other` | Ensures CDN requests have proper Referer. CRITICAL for downloads. |
| 1002 | Set `Access-Control-Allow-Origin` + methods | `xmlhttprequest`, `other` | Ensures CDN responses have CORS headers (some CDN nodes return empty/invalid). Uses `https://www.bilibili.com` to match page origin. |
| 1003 | Remove `Content-Security-Policy` | `main_frame`, `sub_frame` | Enables FFmpeg.wasm without CSP restrictions |
| 1004 | Set `Cross-Origin-Opener-Policy` + `Cross-Origin-Embedder-Policy` | `main_frame` | Enables `SharedArrayBuffer` for FFmpeg MT mode |

**Note**: Rules 1001/1002 are restricted to `initiatorDomains: ["www.bilibili.com"]` to prevent interfering with live streaming on `live.bilibili.com`. Dynamic DNR rule (ID 20001, service worker) is deprecated/unused since all downloads now use `fetch()` which respects static rules.

## Important Files

- `rules.json` — DNR rules: Referer injection, CSP removal, CORS fallback, COOP/COEP for SharedArrayBuffer. 4 active rules.
- `ffmpeg/` — FFmpeg.wasm core files (MT + ST builds); `useMT` picks between them. If WASM fails with "memory import" errors, re-download matching versions from `@ffmpeg/core@0.11.0`. The ST core must be a real ST build — a fake ST (byte-identical to MT) silently breaks first-merge / post-restart downloads.
- `content_merge.js` — Largest file (~1900 lines): all download/merge/stream logic, overlay UI, Bilibili API parsing, progress display, single-download flow + batch-download flow. Starts with a `__BILI_DRIVER_ACTIVE__` re-injection guard. Batch branch is gated by `window.__BILI_BATCH__`.
- `content_bridge.js` — ISOLATED↔MAIN world bridge for Chrome API access (FFmpeg file requests only)
- `service_worker.js` — Background service worker: mostly legacy. Dynamic DNR rule not used in current version. Still serves FFmpeg file HEAD-verification + extension ID to the bridge.
- `inject_config.js` — 🔴 Legacy — no longer injected. popup.js sets config globals (`window.__FFMPEG_URL__` etc.) directly via `chrome.scripting.executeScript` with a `func`. The batch button sets `window.__BILI_BATCH__ = true` the same way.
- `afdian-worker/` / `vercel-api/` — Activation-code verification Worker (Cloudflare + Vercel proxy). Inactive: this checkout holds only Wrangler/Vercel local dev state (`.wrangler/`, `.vercel/`); the actual source (`worker.js`, `wrangler.toml`, `api/activate.js`, `api/claim-api.js`, `api/status.js`, `vercel.json`) lives on the `activation-system` branch.
- Root `childrens_day_poster.py`, `poster_compose.py`, `design-philosophy.md` — unrelated poster-generation tooling, not part of the extension; ignore.
