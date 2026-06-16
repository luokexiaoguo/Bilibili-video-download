# BiliDown - Bilibili Video Downloader

[![Manifest Version](https://img.shields.io/badge/Manifest-V3-blue)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

**[中文](README.md)** | **[English](README_EN.md)**

**BiliDown** is a browser extension for Microsoft Edge and Google Chrome, focused on providing a high-quality downloading experience for Bilibili videos, anime, and movies. It utilizes the WebAssembly version of FFmpeg to merge audio and video locally, ensuring privacy and security without uploading data to third-party servers.

## ✨ Features

- **HD Download**: Supports downloading Bilibili 4K, 1080P+, and other high-definition videos.
- **SDR Priority**: Automatically excludes HDR / Dolby Vision tracks, downloading only SDR (709) videos.
- **Codec Priority**: Prefers H.265 (HEVC) in SDR tracks, otherwise falls back to H.264 (AVC).
- **Anime Support**: Full support for parsing and downloading Bilibili Anime, Movies, and other Bangumi content.
- **Resumable Downloads**: No worries about network fluctuations; supports pausing and resuming download tasks.
- **Local Merge**: Built-in FFmpeg (Wasm) merges audio and video tracks directly within the browser after download, outputting an MP4 file.
- **Smart Naming**: Saves as `Video-First10CharsOfTitle.mp4` / `Audio-First10CharsOfTitle.m4a` (automatically cleans emoji and other abnormal characters; uses video title, not page title).
- **Download Compatibility**: Automatically completes download request Referers, tries backup addresses upon 403 errors; compatible with bilivideo.com / bilivideo.cn / hdslb.com.
- **Stream Save**: Uses "Stream Save" to write separate tracks directly to disk when encountering persistent 403 errors or other exceptions.
- **Privacy Secure**: All operations are performed locally; no user personal information is collected.
- **Cross-Platform**: Supports major desktop browsers (Edge, Chrome) on Windows, macOS, Linux, etc.

## 🚀 Installation Guide

1.  **Download Code**:
    Clone this repository or download the ZIP package and unzip it.
    ```bash
    git clone https://github.com/luokexiaoguo/Bilibili-video-download.git
    ```

2.  **Open Extensions Management Page**:
    - **Edge**: Enter `edge://extensions/` in the address bar.
    - **Chrome**: Enter `chrome://extensions/` in the address bar.

3.  **Enable Developer Mode**:
    Find the "Developer mode" toggle on the left (Edge) or top right (Chrome) of the extensions management page and turn it on.

4.  **Load Extension**:
    Click "Load unpacked", and select the root directory of this project (the folder containing `manifest.json`).

5.  **Start Using**:
    Open any Bilibili video or anime playback page, click the plugin icon on the browser toolbar to start using.

## 🛠️ Tech Stack

- **Manifest V3**: Complies with the latest browser extension specifications for better performance and higher security.
- **FFmpeg.wasm**: Ports the powerful multimedia processing tool FFmpeg to WebAssembly, achieving pure frontend audio/video merging.
- **Vanilla JS**: Native JavaScript development, lightweight and efficient, with no redundant dependencies.

## 📝 Development Structure

Project structure is as follows:

```text
Bilibili video download\
├── _locales/           # Multi-language support (zh_CN, en)
├── ffmpeg/             # FFmpeg Wasm core files
├── icons/              # Plugin icons
├── content_merge.js    # Core logic: Video download and merge
├── popup.html          # Popup interface
├── popup.js            # Popup logic
├── manifest.json       # Extension configuration file
└── rules.json          # Declarative net request rules
```

## 💡 Usage Tips & Notes

### About "Out of Memory" & Large File Downloads
Due to browser memory limits on the WebAssembly runtime environment (typically 2GB - 4GB), downloading and merging **extremely large files** (such as 4K movies, long documentaries) may trigger an **"Out of Memory (OOM)"** error.

To solve this, the plugin has a built-in **Smart Rescue Mechanism**:

1.  **Safe Zone (< 10 mins 4K / < 30 mins 1080P)**:
    *   Most short videos, MVs, and singles fall within this range.
    *   The plugin will automatically download and perfectly merge them into an `.mp4` file without any extra action.

2.  **Danger Zone (> 20 mins 4K / Long Movies)**:
    *   When a file is too large for the browser to merge in memory, the plugin automatically intercepts the error.
    *   **Popup Prompt**: The plugin will ask if you want to save the **raw track data**.
    *   **Auto Naming**: Files will be saved as `Video-TitlePrefix.mp4` and `Audio-TitlePrefix.m4a` for easy identification.

### How to Handle Split Files?
If you trigger the rescue mechanism and download split files, you can use them in the following ways:

*   **Direct Playback**: Drag and drop into modern players like [PotPlayer](https://potplayer.daum.net/) or [VLC](https://www.videolan.org/) to play directly.
*   **Lossless Merge (Recommended)**: Use FFmpeg to instantly merge them into a standard MP4 (no quality loss):
    ```bash
    ffmpeg -i "Video-TitlePrefix.mp4" -i "Audio-TitlePrefix.m4a" -c copy output.mp4
    ```

## 📅 Changelog

### v1.2.6 (2026-06-16)
- **Fix**: Multi-part videos now download the correct episode selected by the user.
- **Fix**: FFmpeg WASM loading failure resolved by using direct extension URLs instead of oversized data URLs.
- **Fix**: File save dialog now opens before FFmpeg merge (prevents user gesture expiration SecurityError).
- **Fix**: Canceling a download no longer triggers the split-download confirmation dialog.
- **Fix**: Restored comprehensive HDR/SDR track detection rules from v1.2.3.
- **Optimization**: Injected COOP/COEP response headers via declarativeNetRequest to enable SharedArrayBuffer for FFmpeg multi-threaded mode.
- **Optimization**: Service worker simplified to file verification (HEAD requests) instead of base64 transfer, significantly faster response.

### v1.2.5 (2026-02-01)
- **Improvement**: Significantly improved UI performance during stream downloads by adding progress throttling, resolving page freeze issues with large files.
- **Improvement**: Enhanced stream save dialog experience by automatically triggering save prompts (no secondary confirmation needed) and fixed progress title display issues.
- **Improvement**: Refined popup tips to clarify "Premium" quality selection and simplified stream save instructions.

### v1.2.4 (2026-02-01)
- **New**: Added a language toggle button for one-click switching to English interface. All text, prompts, and menu items are fully internationalized with no hardcoded Chinese residue.
- **Improvement**: Upgraded stream audio save format to `.m4a` (AAC encoding) to ensure direct compatibility with professional editors like DaVinci Resolve.
- **Fix**: Fixed `ReferenceError: T is not defined` crashes during download initialization.

## 🔒 Privacy Policy

This extension values your privacy. We do not sell, share, or upload your personal information. Core processing (parsing, downloading, merging) is done locally.

### Data We Collect/Process

- **Page Content & Media Info**: Reads necessary page info and API responses (e.g., video title, quality info, stream URLs) in the Bilibili playback page you opened to complete downloading and naming.
- **Login State Info**: To access login-required video resources, requests initiated by the extension will automatically carry your login state (Cookie) at Bilibili to obtain high-definition quality permissions; the extension cannot directly read your Cookie content, nor will it save or upload it.
- **Local State Data**: The extension stores download progress and status locally in the browser (`chrome.storage.local`) to display download progress in the popup; it does not contain sensitive info like your account password.

### How We Use Data

- Solely to implement extension functions: parsing video streams, initiating downloads, displaying download progress, and merging audio/video locally.

### Data Sharing & Third Parties

- The extension does not send your personal data to the developer or third parties.
- Download requests point only to Bilibili/its CDN domains (e.g., `bilibili.com`, `bilivideo.com`, `hdslb.com`, etc.) to fetch audio/video data.

### Permissions Explanation (Usage)

- `downloads`: Used to save video/audio files with specified filenames.
- `storage`: Used to save local download status and necessary configurations.
- `activeTab` / `tabs` / `scripting`: Used to inject scripts into the current playback page and read necessary page info.
- `declarativeNetRequest`: Used to complete necessary request headers for download requests, improving download success rates.

### Data Retention & Deletion

- All data is retained only on your device by default. You can clear this extension's site data/storage via the browser extensions management page, or uninstall the extension to delete all local data.

### Contact

- For privacy-related questions, please contact: `luokexiaoguo@foxmail.com`

## ⚠️ Disclaimer

This project is for learning and research purposes only. Please respect the copyright of Bilibili and video creators. Downloaded content is for personal offline viewing only; please do not use it for any commercial purposes or secondary distribution. Any legal consequences arising from the use of this plugin are borne by the user.

## 📄 License

This project is open-sourced under the [MIT License](LICENSE).
