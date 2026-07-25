# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bilibili Video Downloader (BiliDown) — a Chrome/Edge browser extension (Manifest V3) for downloading Bilibili videos, anime, courses (cheese), and movies. Uses FFmpeg.wasm for local audio/video merging. Pure vanilla JS, no build system, no package manager, no tests.

## Development

This is an **unpacked extension** — no build step needed. Load the root directory (containing `manifest.json`) via `chrome://extensions/` → "Load unpacked" with Developer Mode enabled. Reload the extension after changes.

**Critical**: Do NOT have directories starting with `_` in the project root (except `_locales`). Chrome rejects extensions with such directories (`__pycache__` etc).

There is no linter, formatter, or test suite configured.

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
3. content_merge.js loads files directly from `chrome-extension://<id>/ffmpeg/...` URLs (declared as `web_accessible_resources`)
4. `Module.locateFile` override points WASM loading to the extension URL

### SharedArrayBuffer Requirement

FFmpeg.wasm requires SharedArrayBuffer, which needs cross-origin isolation headers. `rules.json` injects `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless` on bilibili.com video/bangumi/cheese pages via `declarativeNetRequest`.

### Key Data Flow

1. User clicks download → popup injects config globals + bridge + content_merge.js
2. content_merge.js resolves video info via Bilibili APIs
3. Picks best video track (SDR preferred, HDR if requested) and audio track from DASH manifest
4. Calls `showSaveFilePicker` IMMEDIATELY (user gesture required, must not be deferred)
5. **If file < threshold**: downloads video + audio into memory, merges via FFmpeg.wasm, writes merged MP4 to file handle
6. **If file > threshold**: streams video directly to file handle (no OOM), audio via blob URL download
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
- **Audio**: Downloaded via `fetch()` and saved as blob URL (small, <300MB).
- **No longer uses `chrome.downloads.download` or `service_worker.js` for downloads** — all download requests go through `fetch()` which respects DNR rules for proper Referer/Origin headers.
- Combined progress in overlay: `"视频: 1.2GB/8.4GB 15% | 音频: ✓"`

### URL Pattern Support

The extension supports three URL patterns on bilibili.com:
- `/video/BVxxxxxx` — regular videos (with multi-part `?p=N` support)
- `/bangumi/play/epNNNNNN` / `/bangumi/play/ssNNNNNN` — anime/movies
- `/cheese/play/epNNNNNN` — paid courses (uses `mplayer.getPlayurl()` for direct mp4 URL)

### Multi-Part Video Fix

When user selects a specific part from the multi-part selector, `resolveBilibili(specificCid)` skips `getCurrentVideoCid()` and `__playinfo__` fallback (which return the initial page load's data), going directly to the API with the correct cid.

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
- `ffmpeg/` — FFmpeg.wasm core files (MT + ST builds). If WASM fails with "memory import" errors, re-download matching versions from `@ffmpeg/core@0.11.0`
- `content_merge.js` — Largest file (~1100 lines): all download/merge/stream logic, overlay UI, Bilibili API parsing, progress display
- `content_bridge.js` — ISOLATED↔MAIN world bridge for Chrome API access (FFmpeg file requests only)
- `service_worker.js` — Background service worker: mostly legacy. Dynamic DNR rule not used in current version.
- `afdian-worker/` — Activation code verification Worker (Cloudflare + Vercel proxy), separate branch (inactive)
- `vercel-api/` — Vercel API proxy (inactive)
