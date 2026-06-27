# ARCHITECT AI SYSTEM

AI 建築提案生成平台。首頁、A1-A9 工作台、會員登入、推廣期額度、任務送出與 How To Use 操作說明皆集中在此專案。

## 本機預覽

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

開啟：

```text
http://127.0.0.1:8000/index.html
```

## 正式建置

```powershell
npm run build -- --configLoader native
```

建置輸出在 `dist`。目前 `vite.config.ts` 會在建置後自動複製正式網站需要的 runtime 檔案：

- `app.js`
- `config.js`
- `_headers`
- `_redirects`
- `robots.txt`
- `assets/operation-guides`

## Cloudflare Pages

- Root directory: 留空
- Build command: `npm run build -- --configLoader native`
- Build output directory: `dist`

## 上傳前確認

- `config.js` 的 API 與 Supabase public keys 是正式值。
- How To Use 圖片在 `assets/operation-guides` 齊全。
- `npm run build -- --configLoader native` 通過。
- 本機預覽與 `dist` 預覽都沒有瀏覽器錯誤。
