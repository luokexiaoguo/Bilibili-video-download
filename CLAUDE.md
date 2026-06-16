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
| `BILI_TRIGGER_DOWNLOAD` | MAIN→ISOLATED | Request browser download via service worker |
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
5. Downloads video + audio into memory, merges via FFmpeg.wasm (<1.8GB)
6. Writes merged MP4 to the file handle obtained in step 4
7. Falls back to browser download (via service worker) for large files or merge failures

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

## Important Files

- `rules.json` — `declarativeNetRequest` rules: CORS bypass for CDN domains, CSP removal, COOP/COEP injection for SharedArrayBuffer
- `ffmpeg/` — FFmpeg.wasm core files (MT + ST builds). If WASM fails with "memory import" errors, re-download matching versions from `@ffmpeg/core@0.11.0`
- `content_merge.js` — Largest file (~900 lines): all download/merge logic, overlay UI, Bilibili API parsing
- `content_bridge.js` — ISOLATED↔MAIN world bridge for Chrome API access
