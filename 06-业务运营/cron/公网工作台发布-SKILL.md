---
name: public-workbench-deploy
description: 将 dashboard 静态工作台发布到 Cloudflare Quick Tunnel 公网地址，并在自动刷新后同步最新页面。适用于“公网工作台”“重启后公网访问”“更新工作台后同步发布目录”等任务。
type: 运维
status: 持续更新
created: 2026-06-11
---

# Skill：公网工作台发布

## 当前架构

工作台仍由 `dashboard/build.py` 生成静态 HTML，但公网服务不直接读取 `dashboard/`，而是读取：

```bash
$HOME/.content-workbench-public
```

这样可以避开 macOS LaunchAgent 访问 `Documents/` 目录时的权限问题。公网入口由两个 LaunchAgent 保持在线：

- `com.content-workbench.http`：本机 `127.0.0.1:8787` 静态服务。
- `com.content-workbench.cloudflared`：Cloudflare Quick Tunnel，把 `127.0.0.1:8787` 暴露成 `trycloudflare.com` 地址。

Quick Tunnel 是免费、免账号的临时隧道；它适合个人使用和测试，不保证 SLA。电脑重启后服务会自动恢复，但公网网址可能变化。

## 常用命令

### 1. 首次安装/重装 LaunchAgent

```bash
cd $VAULT_ROOT
06-业务运营/cron/install-public-workbench-launchagents.sh
```

脚本会：

1. 重新生成并同步工作台到 `~/.content-workbench-public`。
2. 写入 `~/Library/LaunchAgents/com.content-workbench.http.plist`。
3. 写入 `~/Library/LaunchAgents/com.content-workbench.cloudflared.plist`。
4. 加载并启动两个服务。
5. 输出最新公网 URL。

### 2. 手动重新发布最新工作台

```bash
cd $VAULT_ROOT
06-业务运营/cron/publish-workbench.sh
```

这会执行：

1. `cd dashboard && python3 build.py`
2. 同步 6 个正式页面：`index/ideas/radar/pipeline/analytics/library`
3. 同步 `dashboard/assets/`
4. 输出当前发布目录和最新公网 URL（如果隧道已在线）

如果已经确定 `dashboard/` 是最新的，只想同步文件：

```bash
06-业务运营/cron/publish-workbench.sh --skip-build
```

### 3. 查看当前公网 URL

```bash
cd $VAULT_ROOT
06-业务运营/cron/public-workbench-url.sh
```

这个 URL 来自 `/tmp/content-workbench-cloudflared.err` 中最新的 `trycloudflare.com` 记录。重启电脑后，如果 URL 变了，重新运行这个命令即可。

### 4. 查看服务状态

```bash
launchctl print gui/$(id -u)/com.content-workbench.http | grep -E 'state =|pid ='
launchctl print gui/$(id -u)/com.content-workbench.cloudflared | grep -E 'state =|pid ='
```

### 5. 停止公网访问

```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.content-workbench.cloudflared.plist
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.content-workbench.http.plist
```

## 自动刷新链路

`06-业务运营/cron/daily-radar-refresh.sh` 已接入公网发布步骤：

1. headless agent 更新热点雷达笔记。
2. agent 跑完后，脚本调用 `publish-workbench.sh`。
3. `publish-workbench.sh` 重新 build 并同步到 `~/.content-workbench-public`。
4. Cloudflare Tunnel 无需重启，刷新公网页面即可看到新数据。

## 故障排查

- 公网页面打不开：先查 `public-workbench-url.sh`，确认 URL 是否变化。
- URL 有但页面 502/404：查本地服务 `curl -I http://127.0.0.1:8787/index.html`。
- 本地服务不在：运行 `install-public-workbench-launchagents.sh` 重新加载。
- 页面不是最新：运行 `publish-workbench.sh`，再强制刷新浏览器。
- 没有 `cloudflared`：运行 `brew install cloudflared` 后再执行安装脚本。

## 安全提醒

公网工作台会公开页面中内联的工作台数据。不要把 URL 发给不该看到这些内容的人。需要真正稳定域名、访问控制或不依赖本机时，改用 Cloudflare Named Tunnel、Cloudflare Pages、GitHub Pages 或 Vercel。
