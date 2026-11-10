# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bilibili Video Downloader (BiliDown) — a Chrome/Edge browser extension (Manifest V3) for downloading Bilibili videos, anime, courses (cheese), and movies. Uses FFmpeg.wasm for local audio/video merging. Pure vanilla JS, no build system, no package manager, no tests.

## Development

This is an **unpacked extension** — no build step needed. Load the root directory (containing `manifest.json`) via `chrome://extensions/` → "Load unpacked" with Developer Mode enabled. Reload the extension after changes.

**Critical**: Do NOT create directories starting with `_` in the project root (except `_locales`). Chrome rejects extensions with such directories (`__pycache__` etc). Note: `_metadata/` appears at root after loading — that's Chrome's own generated file, gitignored, leave it alone.

There is no linter, formatter, or test suite configured, and none is tracked in the repo. The only automated check available is `node --check <file>` (syntax validation) — run it on every touched JS file before handing changes to the user; content_merge.js is large enough that a stray brace is easy to introduce.

Ad-hoc harnesses get written during debugging (jsdom-based DOM tests for `page_button.js`, extracted-function tests for `streamToDir` / the batch retry wrapper) but are intentionally **not committed**: they need `jsdom` from npm and the project has zero dependencies. Rebuild them under `/tmp` when needed rather than adding a `package.json`.

## Release / Versioning

Version lives in `manifest.json` (`version`). Each release bumps it and adds a changelog entry to the top of the "更新日志" sections in **both** `README.md` and `README_EN.md` (keep them in sync). The release zip is built into `dist/` (gitignored) — no script automates this (see Packaging below).

**Release pushes go ONLY to `main` (GitHub + Gitee), never `master`.** Development now also happens directly on `main` — `master` is stale (last touched at v1.2.15) and is kept only as a historical branch. Keep `dist/` containing only the newest version's zip when packaging. When committing a version bump, use message format `v<version>: <summary>` (e.g. `v1.2.16: fix batch download collection title leaking into filenames`).

### Remotes & auth (configured 2026-10-29)

Both remotes are **SSH** and both work without a proxy:

- `origin` → `git@github.com:luokexiaoguo/Bilibili-video-download.git`
- `gitee` → `git@gitee.com:luokexiaoguo/Bilibili-video-download.git`

Both use the dedicated key `~/.ssh/id_ed25519_git` (do not use `id_ed25519_opc_server` — that belongs to another service). `~/.ssh/config` routes `github.com` through **`ssh.github.com:443`** because this network's router DNS resolves `github.com` to `127.0.0.1`; plain HTTPS git to github.com is therefore dead, but SSH-over-443 works. Do not "fix" the origin URL back to HTTPS.

`gh` CLI is authenticated as `luokexiaoguo` (scopes `gist, read:org, repo, workflow`, stored in the keyring). `api.github.com` resolves fine and needs no proxy; if it ever stops, prefix commands with `HTTPS_PROXY=http://127.0.0.1:7897` (a Clash Verge instance listens there).

**Sponsor links must never be dropped.** The afdian sponsor entry is intentional and permanent:
- `.github/FUNDING.yml` — `custom: https://afdian.com/a/luokexiaoguo` (drives the "Sponsor this project" button on the GitHub repo sidebar)
- README.md / README_EN.md — sponsor badge in the top badge row + "❤️ 赞助"/"❤️ Sponsor" section at the footer

When updating READMEs (changelog, features, etc.), preserve these sponsor elements as-is. If a README rewrite or refactor removes them, restore them in the same commit. The FUNDING.yml file must always be present on `main`. Also preserve the "💡 快速安装 / Quick Install" blockquote near the top of both READMEs (points users to the Edge/Chrome web stores — search "B站离线舱") — it is intentional store-funnel content.

**No paywall / no activation codes — ever.** Sponsorship is voluntary and buys nothing. Do NOT reintroduce gating of any feature (HDR, 8K, batch, etc.) behind payment, activation codes, device binding, or a license server. A sponsorship-activation system (Cloudflare Worker + Vercel proxy + in-popup code claim) was built on the `activation-system` branch in July 2026 and was deliberately **deleted** on 2026-10-29 — the user does not want a paid tier. Reasons it was killed, in case anyone is tempted to rebuild it: the `*.workers.dev` / `*.vercel.app` endpoints are unreachable from mainland China without a proxy, the Vercel proxy returned no CORS headers and ~5% 500s, and `checkActivation()` would have blocked the download click for up to 16s on every unactivated device. If a sponsorship acknowledgement is ever wanted, put it in the README, not in the extension code.

### Packaging (manual, no script)

The release zip is built with PowerShell `Compress-Archive` into `dist/BiliDown-v<version>.zip` (~17.4 MB). Exclude these from the zip (they are NOT part of the extension): `_metadata`, `dist`, `.git`, `.claude`, `content_merge.js.bak_v1.2.5`, `childrens_day_poster.py`, `poster_compose.py`, `design-philosophy.md`. Copy the remaining root entries to a temp dir, compress, delete temp. Verify the zip listing afterwards — `.claude/settings.local.json` once leaked into a package. Delete the previous version's zip first (keep only newest).

## Architecture

Three-layer script architecture with Chrome's ISOLATED/MAIN world separation.
Two entry points converge on the same injection sequence:

```
page_button.js (ISOLATED, content script) ─┐
                                           ├→ service_worker.js
popup.html / popup.js (extension page) ────┘        │  injects
                                                    ▼
                        content_bridge.js (ISOLATED)  ↔  content_merge.js (MAIN)
                                          ↕ CustomEvents
```

### Key Constraint: MAIN World Cannot Access Chrome APIs

`content_merge.js` runs in the page's MAIN world where `chrome.runtime` is `undefined`. ALL communication with the extension (FFmpeg loading, downloads) MUST go through CustomEvents to `content_bridge.js`, which runs in the ISOLATED world.

**The reverse also holds, and is easier to get wrong:** ISOLATED and MAIN `window` objects are NOT shared. A content script cannot read `window.__BILI_DRIVER_BUSY__` / `__BILI_DRIVER_ACTIVE__` / `__BILI_BATCH__` set by MAIN, and page globals like `__INITIAL_STATE__` are invisible from ISOLATED. When `page_button.js` needs one of those, it sends a message to `service_worker.js`, which reads it via `chrome.scripting.executeScript({ world: 'MAIN', func })` and relays the result back — see `PAGE_IS_BUSY` and `PAGE_PROBE_COLLECTION`. A `window.X` check in an ISOLATED content script silently evaluates to `undefined` (no error), so this class of bug passes every static test.

### Key Constraint: File Pickers Need Transient User Activation

`showSaveFilePicker` / `showDirectoryPicker` require transient user activation (a real DOM event, valid ~5s). Two hard rules learned the hard way:

1. **Never call a picker right after `window.confirm()`** — the OK click on a NATIVE confirm dialog does NOT grant the page user activation (it's browser chrome, not a page event). Long videos hit this every time: the user reads the size warning, clicks OK after >5s, and the picker throws `SecurityError`. Always confirm via `overlay.ask()` (an in-page DOM button — its click IS an activation event) before opening a picker. Batch mode's `confirm()` calls are fine only because no picker follows them.
2. **`FileSystemFileHandle` has NO `getParent()`** — that method belongs to the old FileSystemEntry API. There is no way to derive a file's folder from its handle; a second picker (with live activation) is the only way to get a sibling file handle. Don't re-attempt a getParent()-based "same folder" shortcut.

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
2. **Early abort in fetchBin**: When downloading response body, reads `Content-Length` header at stream start. Single track already > threshold → throws `FILE_TOO_LARGE` → split dialog. Chunked responses (no Content-Length) also abort once `loaded` crosses the threshold — without this they OOM the tab because layers 1 and 3 are both blind to them.
3. **Post-download safety net**: Always checks actual downloaded size against threshold. Catches cases where HEAD probe failed or returned inaccurate values.

### Split Download Streaming

Large files (>threshold) are split into separate video/audio downloads instead of merging in memory:

- **Video**: Downloaded via `fetch()` with `credentials: 'include'` → on 403 falls back to `credentials: 'omit'`. Streamed to file handle in chunks (no `arrayBuffer()`, no OOM). Progress shown in overlay every 200ms via shared `_prog` state.
- **Audio**: On split confirm (via `overlay.ask()`, see the activation constraint above), `acquireAudioHandle()` opens a second `showSaveFilePicker` → audio is written to the user-chosen file handle, **same folder as the video**. Falls back to blob URL only if the audio picker fails/cancelled (the overlay then explicitly notes the audio went to the browser default download dir).
- **No longer uses `chrome.downloads.download` or `service_worker.js` for downloads** — all download requests go through `fetch()` which respects DNR rules for proper Referer/Origin headers.
- Combined progress in overlay: `"视频: 1.2GB/8.4GB 15% | 音频: ✓"`
- All split fetches pass `signal`; on abort the overlay is removed (no stuck download).
- **Writable cleanup**: `createWritable()` puts the file entry on disk immediately. Any failure mid-stream MUST `w.abort()` (discards partial content) and continue to the next mirror URL before falling back to blob — otherwise the user's chosen folder keeps a 0-byte corpse while a complete copy lands in the default dir.
  - The lock matters as much as the corpse: `createWritable()` holds an exclusive write lock on that filename until `close()` or `abort()`. Skipping `abort()` before retrying makes the *next* `createWritable()` throw `NoModificationAllowedError`, so the track fails permanently. In batch mode this was the root cause of "episodes from #3 onward have audio only" (v1.2.18). `abort()` also leaves a 0-byte entry behind, so `streamToDir` additionally calls `removeEntry()`.
  - A stream that ends with fewer bytes than `Content-Length` is a failure (`INCOMPLETE`), not a success — a truncated mux is unplayable.
- **Stall watchdog**: every `reader.read()` goes through `raceRead()` (60s idle timeout → cancels the body → caller's URL-retry loop moves to the next mirror). A hung CDN connection otherwise freezes the download forever with no error.

### Memory-Safety & Cleanup

- **Injection guard + teardown**: `content_merge.js` re-injects on every click of the download button. A `window.__BILI_DRIVER_ACTIVE__` flag at the top prevents stacking duplicate overlays / window listeners on repeated downloads. The flag MUST be reset when a run ends — it used to stay `true` forever, so the second click on the same page silently did nothing (the script returned immediately) and users had to reload. Every terminal path now funnels through `teardown()`, exposed as `window.__BILI_DRIVER_TEARDOWN__` so a caller can dismantle the previous run before injecting again. `overlay.remove()` IS `teardown()`. `window.__BILI_DRIVER_BUSY__` marks a download in flight so the page button can refuse to start a second one (starting again would abort the running one).
- **Progress throttling**: `fetchBin` updates `overlay.setDetail` at most every 200ms (matching `streamWithProgress`) to avoid high-frequency DOM writes on small chunks.
- `saveBlob` revokes its object URL after 120s; FFmpeg FS files are `unlink`ed after merge.

### Cross-run Global State

Page globals set for one run (`__BILI_BATCH__`, `__BILI_DOWN_PREF__`, `__FFMPEG_URL__`) persist across runs on the same tab. `__BILI_BATCH__` in particular is read at the top of the main flow: if a batch run leaves it `true` and the next trigger is a single download, the single-download path is skipped entirely and the batch flow starts instead. Every injection entry point must therefore assign ALL of these explicitly rather than only setting the ones it needs — `popup.js` (single) sets `__BILI_BATCH__ = false` for exactly this reason.

### Page Download Button (`page_button.js`)

A content script (ISOLATED world, `content_scripts` in the manifest) that puts a text "下载 / Download" button into the player control bar, so users who never open the toolbar popup can still find the feature.

- **Injection split**: `page_button.js` must NOT call download code or `chrome.scripting`. It only renders UI and sends `PAGE_START_DOWNLOAD` / `PAGE_PROBE_COLLECTION` to the service worker, which runs the exact same injection sequence the popup does. `chrome.runtime` does not exist in MAIN world, and the inverse (calling `scripting` from a page world) is rejected.
- **Why the panel**: `showSaveFilePicker` needs transient user activation. Clicking the page button, then resolving video info, can burn the ~5s window. So the button opens a small panel (quality + single/batch) and the panel's own button is what starts the download — that click is a fresh activation.
- **Mounting is best-effort**: Bilibili rebuilds the player DOM on quality switch / fullscreen / theatre mode and swaps videos without a reload. `page_button.js` probes several known control-bar selectors, watches `MutationObserver` + `location.href` (SPA), and falls back to a floating button when no known selector matches. Buttons must never stack: always check for an existing `#bilidown-page-btn` first.
- **Batch option is probed, not assumed**: `PAGE_PROBE_COLLECTION` reads `__INITIAL_STATE__` in MAIN world and returns `{available, count}`; the panel disables the batch button with a "not a collection" label when the page has no collection/multi-P.
- **Busy guard**: `window.__BILI_DRIVER_BUSY__` is set by `content_merge.js` while a download runs and cleared in `teardown()` / `done()`. The page button checks it before starting, otherwise a second click would tear down and silently abort the running download.
- **Language**: `page_button.js` owns its own `STRINGS` table (mirroring the popup's `I18N`) and resolves the language as `chrome.storage.local.bili_lang` → `navigator.language`. It MUST be `chrome.storage`, not `localStorage`: the popup's `localStorage` belongs to the extension page and is invisible to a content script running on bilibili.com, so a user who switched the popup to English would still see Chinese in the player. `popup.js` therefore writes `bili_lang` to `chrome.storage.local` on every toggle, and both sides listen to `chrome.storage.onChanged` so a switch applies live without a reload. Keep the two string tables in sync when adding UI text.

### Batch Download (合集下载)

A second popup button (`#batch`) sets `window.__BILI_BATCH__ = true` before injecting `content_merge.js`, which branches into `runBatch()` instead of the single-download flow. Batch download grabs all episodes of a collection/multi-part and downloads them serially into one user-chosen directory.

- **Episode discovery** (`getCollectionEpisodes`): unifies UGC合集 (`ugc_season.sections[].episodes`, each ep is an **independent BV**), series, regular multi-P (`pages`), bangumi (`ss`/`ep` season endpoints), and cheese (`epList`). Returns `[{cid, bvid, epId, title, isBangumi?, isCheese?}]`.
  - The fast path reads `getMultiPartInfo()` from `__INITIAL_STATE__`. `getMultiPartInfo` MUST carry `bvid` for UGC合集 and series pages — they are independent BVs. It used to drop it, so the fast path returned `bvid: undefined` for every episode and `resolveEpisodeDash` fell back to the collection's entry BV → bvid/cid mismatch → 412 on every episode. Do not add a `pages` shape without `bvid` for these two sources.
- **Collection title** (`_batchCollectionTitle`): a module-level variable written by `getCollectionEpisodes` and read by `runBatch`. MUST be the collection/season name (e.g. `ugc_season.title` for UGC, `result.title` for bangumi), NOT `document.title` and NOT `videoData.title` read from `__INITIAL_STATE__` at runtime — both reflect the currently-playing episode, not the collection, causing the currently-playing episode's title to leak into every downloaded filename. Fallback: BV id or `ss<id>`.
- **Per-episode dash** (`resolveEpisodeDash`): MUST use each episode's own `bvid` (UGC合集) — calling `resolveBilibili` directly falls back to `getBvid()` which returns the collection's entry BV, causing bvid/cid mismatch → 412. Routes to `pgc/player/web/playurl` for bangumi, `p/player/playurl` for cheese, `x/player/playurl` otherwise.
- **Save mode**: `showDirectoryPicker({mode:'readwrite'})` once in the user-gesture window → all episodes write into that directory. If the picker is cancelled/rejected (system dir)/unsupported → confirm dialog → fall back to `saveBlob` per file into the browser default download dir. **Large episodes (>threshold) are skipped in blob mode** (would OOM); only the directory mode can stream-split large episodes. Audio + video always share the same `dirHandle`; audio never falls back to default dir when a dirHandle is present.
- **Per-episode logic** (`batchDownloadEpisode`): probe size → small files merge in memory via a reused FFmpeg singleton (`_batchFFmpeg`, loaded once across the batch); large files stream-split to video.mp4 + audio.m4a in the same dir. **The two tracks are coupled on the split path**: if the video track fails, the audio is not downloaded at all and the partial video is removed — otherwise the user gets an audio-only episode that looks like a success. (`writeToDir`'s `false` return only means "fell back to `saveBlob`", so it is NOT a failure signal.) FFmpeg FS files are `unlink`ed after each episode (including on failure) to prevent stale-data bleed across the singleton. `fetchBinBatch` failure with no dirHandle skips the episode (can't stream without a handle).
- **Throttling & retry**: serial loop with `await sleep(2000)` between episodes to avoid playurl 412 风控. Each episode is wrapped by `batchDownloadEpisode`, which calls `batchDownloadEpisodeOnce` up to `BATCH_MAX_ATTEMPTS` (2) times with a 3s backoff. The retry **re-runs `resolveEpisodeDash`**, i.e. it fetches a freshly signed CDN URL — rotating mirrors within an old playurl response does not help, because Bilibili's URLs are time-limited and rate-limited per IP; a batch of 10+ episodes reliably gets 403s from every mirror. `batchDownloadEpisodeOnce` returns `true` / `false` (retryable) / `'skip'` (unrecoverable — e.g. oversized episode in blob mode); only `false` is retried. All fetches share one `AbortController`/`signal` from the overlay.
- **Overlay**: `setBatchMode(true)` reveals a second progress line (`setBatchInfo` "第 N/M 集") + a total-progress bar (`setBatchProgress`), independent of the per-episode detail/progress line.

### URL Pattern Support

The extension supports three URL patterns on bilibili.com:
- `/video/BVxxxxxx` — regular videos (with multi-part `?p=N` support)
- `/bangumi/play/epNNNNNN` / `/bangumi/play/ssNNNNNN` — anime/movies
- `/cheese/play/epNNNNNN` — paid courses (uses `mplayer.getPlayurl()` for direct mp4 URL)

### Resolve Failure Diagnostics (`extractDash` + `_lastResolveFailReason`)

All playurl responses go through `extractDash(pj)`. When it returns null it sets `_lastResolveFailReason` so the generic "未找到视频流信息" can be replaced with a real diagnosis: `risk` (playurl code 412 — B站风控, tell the user to retry in 1-2 min) or `durl:<json>` (non-DASH direct-link video — downloaded as a plain mp4 via `fetchToBlob`, no merge needed). Batch mode does not surface these; it just skips the episode.

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
- `content_merge.js` — Largest file (~2200 lines): all download/merge/stream logic, overlay UI (incl. `ask()` in-page confirm — required before any picker), Bilibili API parsing, progress display, single-download flow + batch-download flow. Starts with a `__BILI_DRIVER_ACTIVE__` re-injection guard. Batch branch is gated by `window.__BILI_BATCH__`.
- `page_button.js` — ISOLATED-world content script (declared in `content_scripts`) that mounts the "下载 / Download" button in the player control bar and owns its panel UI. Renders only; every action goes through `service_worker.js`. See its own section above.
- `content_bridge.js` — ISOLATED↔MAIN world bridge for Chrome API access (FFmpeg file requests only)
- `service_worker.js` — Background service worker. Owns injection orchestration: `PAGE_START_DOWNLOAD` runs the same tear-down → bridge → globals → ffmpeg.min.js → content_merge.js sequence the popup uses, and `PAGE_IS_BUSY` / `PAGE_PROBE_COLLECTION` read MAIN-world state on behalf of the ISOLATED page button. Also serves FFmpeg file HEAD-verification + extension ID to the bridge, plus `GET_STORAGE` / `SET_STORAGE` / `DOWNLOAD` / `FETCH_STREAMS`. The dynamic DNR rule (ID 20001) is not used in the current version.
- `inject_config.js` — 🔴 Legacy — no longer injected. popup.js sets config globals (`window.__FFMPEG_URL__` etc.) directly via `chrome.scripting.executeScript` with a `func`. The batch button sets `window.__BILI_BATCH__ = true` the same way.
- `.github/SPONSOR_GUIDE.md` — untracked local doc describing the afdian sponsor setup for AI agents; not committed per user decision. Do not include in commits.
- Root `childrens_day_poster.py`, `poster_compose.py`, `design-philosophy.md` — unrelated poster-generation tooling, not part of the extension; ignore.

## Store Distribution

The extension is published on both Edge Add-ons (as "Bilibili Offline Pod - Anime & Movie Downloader", ~11k users) and Chrome Web Store (as "B站离线舱-番剧电影下载器", ~1k users). Both stores get the same `dist/` zip. Store updates are submitted manually by the user via the partner dashboards. Chrome listing description is Chinese; English copy has been drafted for a future localized listing but not yet submitted. Edge review is slow (weeks); Chrome is faster.
