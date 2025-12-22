# B站离线舱 (BiliDown)

[![Manifest Version](https://img.shields.io/badge/Manifest-V3-blue)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

**B站离线舱** 是一款基于 Microsoft Edge / Google Chrome 的浏览器扩展，专注于提供 Bilibili 视频的高清下载体验。它利用 WebAssembly 版本的 FFmpeg 在本地进行音视频合并，确保隐私安全，无需将数据上传至第三方服务器。

## ✨ 功能特性

- **高清下载**：支持 Bilibili 4K、1080P+ 等高清画质视频下载。
- **断点续传**：网络波动不用怕，支持下载任务暂停与恢复。
- **本地合并**：内置 FFmpeg (Wasm)，下载完成后直接在浏览器内完成音视频轨道合并，输出 MP4 文件。
- **隐私安全**：所有操作均在本地完成，不收集任何用户个人信息。
- **跨平台**：支持 Windows, macOS, Linux 等桌面端主流浏览器 (Edge, Chrome)。

## 🚀 安装指南

由于目前插件正在商店审核中，您可以通过“加载解压缩的扩展”方式进行安装体验：

1.  **下载代码**：
    克隆本仓库或下载 ZIP 包并解压。
    ```bash
    git clone https://github.com/your-username/bilibili-video-download.git
    ```

2.  **打开扩展管理页面**：
    - **Edge**: 在地址栏输入 `edge://extensions/`
    - **Chrome**: 在地址栏输入 `chrome://extensions/`

3.  **开启开发者模式**：
    在扩展管理页面左侧（Edge）或右上角（Chrome）找到“开发人员模式”开关并开启。

4.  **加载扩展**：
    点击“加载解压缩的扩展”（Load unpacked），选择本项目的根目录（即包含 `manifest.json` 的文件夹）。

5.  **开始使用**：
    打开任意 Bilibili 视频播放页面，点击浏览器工具栏上的插件图标即可开始使用。

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

## ⚠️ 免责声明

本项目仅供学习和研究使用。请尊重 Bilibili 及视频创作者的版权，下载的内容仅供个人离线观看，请勿用于任何商业用途或进行二次分发。使用本插件产生的任何法律后果由使用者自行承担。

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。
