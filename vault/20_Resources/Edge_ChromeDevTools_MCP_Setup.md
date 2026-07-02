---
title: Edge & ChromeDevTools MCP Troubleshooting & Setup Guide
tags: [mcp, msedge, chromedevtools, debugging, windows]
aliases: [MSEdge MCP Guide]
---

# Edge & ChromeDevTools MCP Configuration & Troubleshooting Guide

It has been verified that `chrome-devtools` MCP works successfully with Microsoft Edge because Edge is Chromium-based and implements the Chrome DevTools Protocol (CDP).

## 🚀 How to Launch MSEdge for ChromeDevTools MCP

### 1. Launch Command (Windows PowerShell / Cmd)
Run Edge in a detached persistent background process with remote debugging enabled:

```powershell
& "cmd.exe" /c '"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --remote-debugging-port=9222 --remote-allow-origins=* --user-data-dir=D:\ForJobs\Qubiz\edge_profile_mcp_persist http://127.0.0.1:5173'
```

### 2. Critical Flags & Arguments
- `--remote-debugging-port=9222`: Opens the Chrome DevTools Protocol (CDP) port.
- `--remote-allow-origins=*`: **REQUIRED by Chromium 110+**. Without this flag, WebSocket / CDP connections fail with `fetch failed` or `Unable to connect`.
- `--user-data-dir="<path>"`: **CRITICAL on Windows**. Prevents Edge from forwarding commands to an existing background `msedge.exe` host instance. Forces creation of a distinct debugging process.

---

## ⚠️ Common Pitfalls & Solutions

### 1. `fetch failed` / `Could not connect to Chrome` on 127.0.0.1:9222
- **Cause**: Edge process attached to host Edge process or exited immediately, or missing `--remote-allow-origins=*`.
- **Fix**: Launch Edge using a unique `--user-data-dir` directory and ensure `--remote-allow-origins=*` is included.

### 2. 401 Unauthorized / Cookie Drop on `http://localhost:5173` vs `http://127.0.0.1:8090`
- **Cause**: Browser treats `localhost` and `127.0.0.1` as different origins, dropping HttpOnly SameSite cookies.
- **Fix**: Always navigate the browser to `http://127.0.0.1:5173` so origin domain matches backend API (`http://127.0.0.1:8090`).

### 3. WinError 10013 / Port Binding Failure on Ports 8000/8080
- **Cause**: Windows Hyper-V / WSL reserves TCP port range `7981-8080` (`netsh interface ipv4 show excludedportrange protocol=tcp`).
- **Fix**: Bind FastAPI backend to port `8090` or `9000` which are outside the reserved exclusion range.

---

## 🛠️ MCP Verification Steps
1. Test CDP connectivity: `Invoke-RestMethod -Uri "http://127.0.0.1:9222/json/version"` (returns `Edg/149.x...`).
2. Open tab in MCP: Call `new_page` with `url: "http://127.0.0.1:5173/#/login"`.
3. Interact: Use `take_snapshot`, `click`, `fill`, `navigate_page`, and `take_screenshot`.
