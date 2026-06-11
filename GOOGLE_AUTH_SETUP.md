# Google 登入設定

網站端已使用 Supabase Auth，不要把 Google Client Secret 寫入 `config.js` 或任何前端檔案。

## 1. Google Cloud

1. 在 Google Auth Platform 建立 OAuth Client。
2. Application type 選擇 `Web application`。
3. Authorized JavaScript origins 加入：
   - `https://www.arch-ai-system.com`
   - `https://arch-ai-system.com`
4. Authorized redirect URIs 加入：
   - `https://veetqwxkvssdhuarxlpv.supabase.co/auth/v1/callback`
5. Data Access scopes 使用：
   - `openid`
   - `userinfo.email`
   - `userinfo.profile`
6. 保存 Client ID 與 Client Secret。

## 2. Supabase

1. 開啟 Authentication > Providers > Google。
2. 啟用 Google Provider。
3. 填入 Google Client ID 與 Client Secret。
4. Authentication > URL Configuration：
   - Site URL：`https://www.arch-ai-system.com`
   - Redirect URLs：加入 `https://www.arch-ai-system.com/**`
   - Redirect URLs：加入 `https://arch-ai-system.com/**`

## 3. 驗證

1. 部署前端更新。
2. 開啟無痕視窗並按「使用 Google 帳號繼續」。
3. 登入後確認會員中心顯示正確 Email。
4. 使用 `zheng08026@gmail.com` 登入，確認仍顯示主要管理員入口。
5. 在管理員會員資料確認 `auth_provider` 為 `google`。

Google 與 Email/密碼使用相同 Email 時，Supabase 會依其身分連結規則處理；正式啟用前必須用既有會員信箱實測，確認沒有出現重複會員資料。
