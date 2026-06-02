# ARCHITECT AI SYSTEM 上架設定

## 目前已完成

- A1-A5 任務格式已接到 Z83 API。
- 網站在 `config.js` 留空時會維持展示模式。
- `config.js` 填入 Z83 公開 API 網址後，會送出真實任務並等待結果。

## 正式上架架構

- 前端網站：Cloudflare Pages 或其他靜態網站服務。
- API 入口：Cloudflare Tunnel 指向 Z83 的 `http://localhost:5000`。
- UM760：執行 `um760-dispatch`，負責任務、上傳檔、成果檔。
- 5060 / 5070：執行各自 worker，向 Z83 領任務並回傳成果。

## 上架前必改

### 1. 網站 API 網址

正式站的 `config.js` 必須填 HTTPS API 網址，例如：

```js
window.ARCHITECT_AI_API_BASE = "https://api.your-domain.com";
```

不能使用：

```js
window.ARCHITECT_AI_API_BASE = "http://192.168.68.54:5000";
```

原因是公開網站通常是 HTTPS，瀏覽器會阻擋 HTTPS 網站呼叫 HTTP API。

### 2. Z83 公開成果網址

Z83 執行前要讓 `AIA_PUBLIC_BASE_URL` 也指向同一個 HTTPS API 網址，否則成果圖網址會回傳區網 IP，外部使用者打不開。

正式環境範例：

```bat
set AIA_PUBLIC_BASE_URL=https://api.your-domain.com
```

### 3. CORS 來源

測試期可以用：

```bat
set AIA_ALLOWED_ORIGINS=*
```

正式期建議改成網站網域，例如：

```bat
set AIA_ALLOWED_ORIGINS=https://www.your-domain.com
```

## 建議上架順序

1. 申請或準備網域。
2. 建立 Cloudflare Pages，部署 `architect-ai-site`。
3. 在 Z83 建立 Cloudflare Tunnel，讓 `https://api.your-domain.com` 指到 Z83 的 `localhost:5000`。
4. 修改 Z83 的 `AIA_PUBLIC_BASE_URL` 和 `AIA_ALLOWED_ORIGINS`。
5. 修改網站 `config.js` 的 `ARCHITECT_AI_API_BASE`。
6. 測試 A1-A5。
7. 再加入會員、登入、額度、付款。

## 第一階段上架範圍

先讓 A1-A5 能被網站使用：

- A1：真實建築照片 / 渲染參考圖 → 提示詞
- A2：真實建築照片 / 渲染參考圖 → 精準提示詞
- A3：Sketch / 3D 量體圖 + 自行提詞 → 建築圖
- A4：Sketch / 3D 量體圖 + 風格參考圖 → 建築圖
- A5：Sketch / 3D 量體圖 + 風格參考圖 + 基地與周邊環境圖 → 建築圖

會員與付款可以第二階段接上，避免卡住首發測試。
