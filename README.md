# B站离线舱-番剧电影下载器 (BiliDown)

[![Manifest Version](https://img.shields.io/badge/Manifest-V3-blue)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

**B站离线舱-番剧电影下载器** 是一款基于 Microsoft Edge / Google Chrome 的浏览器扩展，专注于提供 Bilibili 视频、番剧、电影的高清下载体验。它利用 WebAssembly 版本的 FFmpeg 在本地进行音视频合并，确保隐私安全，无需将数据上传至第三方服务器。

## ✨ 功能特性

- **高清下载**：支持 Bilibili 4K、1080P+ 等高清画质视频下载。
- **番剧支持**：全面支持 Bilibili 番剧、电影等 Bangumi 内容的解析与下载。
- **断点续传**：网络波动不用怕，支持下载任务暂停与恢复。
- **本地合并**：内置 FFmpeg (Wasm)，下载完成后直接在浏览器内完成音视频轨道合并，输出 MP4 文件。
- **隐私安全**：所有操作均在本地完成，不收集任何用户个人信息。
- **跨平台**：支持 Windows, macOS, Linux 等桌面端主流浏览器 (Edge, Chrome)。

## 🚀 安装指南

由于目前插件正在商店审核中，您可以通过“加载解压缩的扩展”方式进行安装体验：

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
e:\Bilibili video download\
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
    *   **自动命名**：文件将被保存为 `[视频]标题.m4s` 和 `[音频]标题.m4s`，清晰易辨。

### 如何处理 `.m4s` 原始文件？
如果您触发了救援机制并下载了 `.m4s` 文件，可以通过以下方式使用：

*   **直接播放**：使用 [PotPlayer](https://potplayer.daum.net/)、[VLC](https://www.videolan.org/) 等现代播放器直接拖入播放。
*   **无损合并（推荐）**：使用 FFmpeg 瞬间合并为标准 MP4（不消耗画质）：
    ```bash
    ffmpeg -i "[视频]xxx.m4s" -i "[音频]xxx.m4s" -c copy output.mp4
    ```

## 📅 更新日志 (Changelog)

### v1.1.0 (2025-12-24)
- **新增**：全面支持 Bilibili 番剧、电影内容的解析与下载。
- **优化**：大文件下载内存救援机制，当浏览器内存不足时自动提示保存原始轨道。
- **优化**：改进文件命名规则，自动添加 `[视频]` / `[音频]` 前缀，方便区分。
- **修复**：修复了部分情况下下载状态显示异常的问题。

### v1.0.0
- **首发**：支持 Bilibili 普通视频 4K/1080P 高清下载。
- **核心**：基于 WebAssembly 的本地音视频合并功能。

## ⚠️ 免责声明

本项目仅供学习和研究使用。请尊重 Bilibili 及视频创作者的版权，下载的内容仅供个人离线观看，请勿用于任何商业用途或进行二次分发。使用本插件产生的任何法律后果由使用者自行承担。

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。
