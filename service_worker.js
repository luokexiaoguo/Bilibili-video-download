async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function getSiteCookies(url) {
  return await chrome.cookies.getAll({ url });
}

function netscapeFromCookies(cookies) {
  const lines = ["# Netscape HTTP Cookie File"];
  for (const c of cookies) {
    const domain = c.domain.startsWith(".") ? c.domain : "." + c.domain;
    const flag = domain.startsWith(".") ? "TRUE" : "FALSE";
    const path = c.path || "/";
    const secure = c.secure ? "TRUE" : "FALSE";
    const expires = c.expirationDate ? Math.floor(c.expirationDate) : 0;
    lines.push([domain, flag, path, secure, String(expires), c.name, c.value || ""].join("\t"));
  }
  return lines.join("\n");
}

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg && msg.type === "start-download") {
    try {
      const tab = await getActiveTab();
      const url = tab.url;
      if (!/bilibili\.com\/video\//i.test(url)) {
        sendResponse({ ok: false, error: "请在 B 站视频页使用" });
        return true;
      }
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content_merge.js"],
        world: "MAIN"
      });
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
    return true;
  }
  if (msg && msg.type === "download-direct") {
    try {
      const id = await chrome.downloads.download({
        url: msg.url,
        filename: msg.filename || "video.mp4",
        saveAs: false
      });
      sendResponse({ ok: true, id });
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
    return true;
  }
});
