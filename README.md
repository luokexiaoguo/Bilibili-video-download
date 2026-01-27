# B站离线舱-番剧电影下载器 (BiliDown)

[![Manifest Version](https://img.shields.io/badge/Manifest-V3-blue)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

**[中文](#chinese)** | **[English](#english)**

<span id="chinese"></span>

**B站离线舱-番剧电影下载器** 是一款基于 Microsoft Edge / Google Chrome 的浏览器扩展，专注于提供 Bilibili 视频、番剧、电影的高清下载体验。它利用 WebAssembly 版本的 FFmpeg 在本地进行音视频合并，确保隐私安全，无需将数据上传至第三方服务器。

## ✨ 功能特性

- **高清下载**：支持 Bilibili 4K、1080P+ 等高清画质视频下载。
- **SDR 优先**：自动排除 HDR / 杜比视界轨道，仅下载 SDR(709) 视频。
- **编码优先**：在 SDR 轨道中优先选择 H.265(HEVC)，否则选择 H.264(AVC)。
- **番剧支持**：全面支持 Bilibili 番剧、电影等 Bangumi 内容的解析与下载。
- **断点续传**：网络波动不用怕，支持下载任务暂停与恢复。
- **本地合并**：内置 FFmpeg (Wasm)，下载完成后直接在浏览器内完成音视频轨道合并，输出 MP4 文件。
- **文件命名**：保存为 `视频-标题前10字.mp4` / `音频-标题前10字.m4a`（自动清理 emoji 等异常字符，标题取视频标题，非网页标题）。
- **下载兼容**：自动补全下载请求 Referer，遇到 403 会自动尝试备用地址；兼容 bilivideo.com / bilivideo.cn / hdslb.com。
- **流式保存**：遇到持续 403 或其它异常时，可用“流式保存”直接写盘分轨保存。
- **隐私安全**：所有操作均在本地完成，不收集任何用户个人信息。
- **跨平台**：支持 Windows, macOS, Linux 等桌面端主流浏览器 (Edge, Chrome)。

## 🚀 安装指南

1.  **下载代码**：
    克隆本仓库或下载 ZIP 包并解压。
    ```bash
    git clone https://github.com/luokexiaoguo/Bilibili-video-download.git
    ```

2.  **打开扩展管理页面**：
    - **Edge**: 在地址栏输入 `edge://extensions/`
    - **Chrome**: 在地址栏输入 `chrome://extensions/`

3.  **开启开发者模式**：
    在扩展管理页面左侧（Edge）或右上角（Chrome）找到“开发人员模式”开关并开启。

4.  **加载扩展**：
    点击“加载解压缩的扩展”（Load unpacked），选择本项目的根目录（即包含 `manifest.json` 的文件夹）。

5.  **开始使用**：
    打开任意 Bilibili 视频或番剧播放页面，点击浏览器工具栏上的插件图标即可开始使用。

## 🛠️ 技术栈

- **Manifest V3**: 符合最新的浏览器扩展规范，性能更优，安全性更高。
- **FFmpeg.wasm**: 将强大的多媒体处理工具 FFmpeg 移植到 WebAssembly，实现纯前端音视频合并。
- **Vanilla JS**: 原生 JavaScript 开发，轻量高效，无冗余依赖。

## 📝 开发说明

项目结构如下：

```text
Bilibili video download\
├── _locales/           # 多语言支持 (zh_CN, en)
├── ffmpeg/             # FFmpeg Wasm 核心文件
├── icons/              # 插件图标
├── content_merge.js    # 核心逻辑：视频下载与合并
├── popup.html          # 弹窗界面
├── popup.js            # 弹窗逻辑
├── manifest.json       # 扩展配置文件
└── rules.json          # 声明式网络请求规则
```

## 💡 使用建议与注意事项

### 关于“内存不足”与大文件下载
由于浏览器对 WebAssembly 运行环境的内存限制（通常为 2GB - 4GB），在下载并合并**超大文件**（如 4K 电影、长篇纪录片）时，可能会触发**“内存不足 (OOM)”**的错误。

为了解决这个问题，本插件内置了**智能救援机制**：

1.  **安全区（< 10 分钟 4K / < 30 分钟 1080P）**：
    *   绝大多数短视频、MV、单曲都在此范围内。
    *   插件会自动下载并完美合并为 `.mp4` 文件，无需任何额外操作。

2.  **危险区/必爆区（> 20 分钟 4K / 长电影）**：
    *   当文件过大导致浏览器无法在内存中完成合并时，插件会自动拦截错误。
    *   **弹窗提示**：插件会询问您是否保存**原始轨道数据**。
    *   **自动命名**：文件将被保存为 `视频-标题前10字.mp4` 和 `音频-标题前10字.m4a`，清晰易辨。

### 如何处理分轨文件？
如果您触发了救援机制并下载了分轨文件，可以通过以下方式使用：

*   **直接播放**：使用 [PotPlayer](https://potplayer.daum.net/)、[VLC](https://www.videolan.org/) 等现代播放器直接拖入播放。
*   **无损合并（推荐）**：使用 FFmpeg 瞬间合并为标准 MP4（不消耗画质）：
    ```bash
    ffmpeg -i "视频-xxx.mp4" -i "音频-xxx.m4a" -c copy output.mp4
    ```

## 📅 更新日志 (Changelog)

### v1.2.3 (2026-01-22)
- **重构**：移除所有远程 CDN 代码，完全本地化运行，严格符合 Manifest V3 规范。
- **UI**：全新暗黑模式界面，优化排版与交互反馈（点击即显示启动提示）。
- **优化**：“流式保存”机制重构，不再加载 FFmpeg 组件，彻底解决大文件内存溢出与组件加载卡顿问题。
- **优化**：流式保存采用并行下载策略，并改为连续两次弹窗（视频+音频），流程更稳定。
- **修复**：修复流式保存取消后文件体积持续增长的问题，增加明确的“取消”按钮。

### v1.2.2 (2026-01-18)
- **修复**：长视频分流下载导致页面卡顿、音频未触发下载的问题。
- **优化**：分流命名升级为“标题前10字”，自动清理 emoji 等异常字符。
- **修复**：分流下载文件名不再显示为一串数字，强制使用指定文件名。
- **优化**：分流音频导出优先 MP3，失败则导出 WAV（剪辑更稳，适用于流式保存场景）。
- **新增**：弹窗增加反馈邮箱与赞助链接入口。

### v1.2.0 (2025-12-31)
- **新增**：仅下载 SDR(709) 视频轨道，自动排除 HDR / 杜比视界。
- **新增**：在 SDR 轨道中优先选择 H.265(HEVC)，否则选择 H.264(AVC)。
- **新增**：下载文件命名为 `视频-标题前5字.mp4` / `音频-标题前5字.m4a`（标题取视频标题）。
- **优化**：下载请求自动补全 Referer，遇到 403 会自动尝试备用地址，并兼容更多 CDN 域名。
- **新增**：下载失败时可使用“流式保存”直接写盘分轨保存。

### v1.1.0 (2025-12-24)
- **新增**：全面支持 Bilibili 番剧、电影内容的解析与下载。
- **优化**：大文件下载内存救援机制，当浏览器内存不足时自动提示保存原始轨道。
- **优化**：改进文件命名规则，自动添加 `[视频]` / `[音频]` 前缀，方便区分。
- **修复**：修复了部分情况下下载状态显示异常的问题。

### v1.0.0
- **首发**：支持 Bilibili 普通视频 4K/1080P 高清下载。
- **核心**：基于 WebAssembly 的本地音视频合并功能。

## 🔒 隐私政策

本扩展重视您的隐私。我们不会出售、共享或上传您的个人信息。扩展的核心处理（解析、下载、合并）均在本地完成。

### 我们会收集/处理哪些数据

- **网页内容与媒体信息**：在您打开的 Bilibili 播放页中读取必要的页面信息与接口响应（例如视频标题、清晰度信息、音视频流地址），用于完成下载与命名。
- **登录状态相关信息**：为访问需要登录的视频资源，扩展发起的请求会自动携带您在 Bilibili 的登录态信息（Cookie），以获取高清画质权限；扩展无法直接读取您的 Cookie 内容，也不会将其保存或上传。
- **本地状态数据**：扩展会在浏览器本地存储下载进度与状态（`chrome.storage.local`），用于在弹窗中展示下载进度；不包含您输入的账号密码等敏感信息。

### 我们如何使用数据

- 仅用于实现扩展功能：解析视频流、发起下载、显示下载进度、在本地合并音视频。

### 数据共享与第三方

- 扩展不会将您的个人数据发送给开发者或第三方。
- 下载请求仅指向 Bilibili/其 CDN 域名（如 `bilibili.com`、`bilivideo.com`、`hdslb.com` 等），用于获取音视频数据。

### 权限说明（用途）

- `downloads`：用于以指定文件名保存视频/音频文件。
- `storage`：用于保存本地下载状态与必要配置。
- `activeTab` / `tabs` / `scripting`：用于在当前播放页注入脚本并读取必要页面信息。
- `declarativeNetRequest`：用于为下载请求补全必要请求头，提高下载成功率。

### 数据保留与删除

- 所有数据默认仅保留在您的设备上。您可以通过浏览器扩展管理页清除本扩展的站点数据/存储数据，或卸载扩展以删除全部本地数据。

### 联系方式

- 如有隐私相关问题，请联系：`luokexiaoguo@foxmail.com`

## ⚠️ 免责声明

本项目仅供学习和研究使用。请尊重 Bilibili 及视频创作者的版权，下载的内容仅供个人离线观看，请勿用于任何商业用途或进行二次分发。使用本插件产生的任何法律后果由使用者自行承担。

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。

---

<span id="english"></span>

# BiliDown - Bilibili Video Downloader

**[中文](#chinese)** | **[English](#english)**

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
    ffmpeg -i "Video-xxx.mp4" -i "Audio-xxx.m4a" -c copy output.mp4
    ```

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
