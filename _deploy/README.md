# 部署与"自动更新"说明

玩家点开链接后**不会再看到旧版本**，靠三层保障：

## 1. 构建版本戳（构建时执行）
```bash
node _gen/run.js      # 生成 assets/atlas.png + assets/manifest.js
node _gen/stamp.js    # 生成版本号：给 index.html 里所有本地资源加 ?v=版本号，并写 version.json
```
- `_gen/stamp.js` 会：
  - 用时间戳生成版本号（或 `node _gen/stamp.js v1.2.3` 指定、`--keep` 保留原号）；
  - 把 `index.html` 里 `js/*.js`、`css/*.css`、图片等本地引用统一改写成 `xxx.js?v=20260101-120000`；
  - 写 `js/version.js`（页面内 `window.GAME_VERSION`）与 `version.json`（服务器侧真值）。
- 图集 `assets/atlas.png` 由 `js/assets.js` 用同一个版本号请求，避免"代码更新、贴图旧"。

## 2. 运行时自检（`js/main.js` 的 `checkVersion`）
- 启动时（以及每 5 分钟）用 `fetch('version.json?t=时间戳', { cache: 'no-store' })` 抓真值；
- 若 `version.json.version` 与页面里的 `GAME_VERSION` 不同：
  清理 Cache Storage / 更新 Service Worker → 提示"发现新版本，正在更新…" → 带 `?v=新版本` 强刷；
- 30 秒内只强刷一次（避免 CDN 尚未同步时反复刷新）；
- `file://` 打开或没部署 `version.json` 时静默跳过，不影响本地开发。

## 3. 服务器缓存头（关键：入口不缓存）
把 `_deploy/` 里对应文件放到站点根目录：

| 服务器 | 用哪个文件 | 放置位置 |
|---|---|---|
| Nginx | `_deploy/nginx.conf.txt` | 合并进站点 `server {}` 块 |
| Apache | `_deploy/.htaccess` | 站点根目录 |
| Netlify / Cloudflare Pages / Vercel | `_deploy/_headers` 或 `_deploy/vercel.json` | 站点根目录 |

规则要点：
- `index.html`、`version.json` → **no-store / 不缓存**（这样玩家每次点链接都会重新校验）；
- `js/`、`css/`、`assets/` → **长期缓存 + immutable**（反正 URL 带版本号，更新即换 URL）。

> 如果站点前面还有 CDN（Cloudflare、又拍、七牛等），也要把 `index.html` 与 `version.json`
> 设为不缓存（或很短 TTL，如 60 秒）；否则 CDN 会继续发旧 HTML。

## 发布流程（推荐）
```bash
node _gen/run.js && node _gen/stamp.js
# 上传：index.html、version.json、js/、css/、assets/、（可选 _deploy 配置）
```
玩家下一次打开页面（或停留在页面中满 5 分钟）即会自动拿到新版本。
