# ARCHITECT AI SYSTEM 上架設定

## 目前上架範圍

- 首頁：AI 建築提案生成平台文案與 A1-A9 模組介紹。
- 工作台：A1-1／A1-2 訪客試用，A2-1～A9 登入會員後送出任務。
- 會員：Email / Google 登入、會員中心、用量與任務紀錄。
- 後台：會員方案、狀態、角色與額度管理。
- How To Use：`assets/operation-guides` 內的 A1-A9 操作說明圖。

## 正式上架架構

- 前端網站：Cloudflare Pages，部署此專案的 `dist`。
- API 入口：Cloudflare Tunnel 指向 UM760 dispatch API。
- UM760：執行 `platform-runtime/um760-dispatch`，負責會員、任務、上傳檔與成果檔。
- GPU Worker：5060 / 5070 節點執行 worker，向 UM760 領任務並回傳成果。

## Cloudflare Pages 設定

- Root directory: 留空
- Build command: `npm run build -- --configLoader native`
- Build output directory: `dist`

建置後 `vite.config.ts` 會將 `app.js`、`config.js`、Cloudflare 設定檔與 `assets/operation-guides` 一起放入 `dist`。

## 上架前必檢查

### 1. 網站 API 網址

正式站的 `config.js` 必須填 HTTPS API 網址，例如：

```js
window.ARCHITECT_AI_API_BASE = "https://api.your-domain.com";
```

不能使用區網 HTTP，例如：

```js
window.ARCHITECT_AI_API_BASE = "http://192.168.68.54:5000";
```

公開網站通常是 HTTPS，瀏覽器會阻擋 HTTPS 網站呼叫 HTTP API。

### 2. Supabase public 設定

`config.js` 需要包含正式 Supabase 專案的 public URL 與 publishable / anon key：

```js
window.ARCHITECT_AI_SUPABASE_URL = "https://your-project.supabase.co";
window.ARCHITECT_AI_SUPABASE_ANON_KEY = "your-public-anon-key";
```

### 3. UM760 公開成果網址

UM760 dispatch 執行前，`AIA_PUBLIC_BASE_URL` 要指向同一個 HTTPS API 網址，避免成果圖回傳區網 IP。

```bat
set AIA_PUBLIC_BASE_URL=https://api.your-domain.com
```

### 4. CORS 來源

測試期可以用：

```bat
set AIA_ALLOWED_ORIGINS=*
```

正式期建議改成網站網域，例如：

```bat
set AIA_ALLOWED_ORIGINS=https://www.your-domain.com
```

## 上架前本機檢查

```powershell
npm run build -- --configLoader native
```

確認 `dist` 內至少包含：

- `index.html`
- `app.js`
- `config.js`
- `_headers`
- `_redirects`
- `assets/operation-guides`

再用本機靜態伺服器預覽 `dist`：

```powershell
python -m http.server 8001 --bind 127.0.0.1
```

開啟：

```text
http://127.0.0.1:8001/index.html
```

## 建議上架順序

1. 確認 `config.js` 已指向正式 API 與 Supabase。
2. 執行正式建置並檢查 `dist`。
3. 建立或更新 Cloudflare Pages 專案。
4. 設定 Cloudflare Pages build command 與 output directory。
5. 設定 UM760 的 `AIA_PUBLIC_BASE_URL` 與 `AIA_ALLOWED_ORIGINS`。
6. 上傳後測試 A1-1／A1-2 訪客試用。
7. 登入會員後測試 A2-1、A2-2、A9-1 任務送出與用量扣除。
8. 測試 How To Use 圖片、會員中心、管理員後台。
