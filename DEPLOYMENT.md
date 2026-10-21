# ARCHITECT AI SYSTEM 上架設定

## 本次發布範圍

- 首頁：AI 建築提案生成平台文案與 A1-A10 模組介紹。
- 工作台：A1-1／A1-2 訪客試用，A2-1～A9 及 A10-v1 登入會員後送出任務；新增 A2-3 獨立局部重繪入口。
- A10-Bata：停止新增任務，保留歷史成果與授權下載；A10-v1 及 A10 累計獨立額度保留。
- 會員：Email / Google 登入、會員中心、用量與任務紀錄。
- 後台：會員方案、狀態、角色與額度管理。
- How To Use：`assets/operation-guides` 內的 A1-A9 操作說明圖。

## 正式上架架構

- 前端網站：Cloudflare Pages，部署此專案的 `dist`。
- API 入口：Cloudflare Tunnel 指向 UM760 dispatch API。
- UM760：執行 `platform-runtime/um760-dispatch`，負責會員、任務、上傳檔與成果檔。
- GPU Worker：可擴充的 N 台 Worker 向 UM760 領任務並回傳成果；每台只宣告已安裝模型、節點與工作流的能力。

## Cloudflare Pages 設定

- Root directory: 留空
- Build command: `npm run build -- --configLoader native`
- Build output directory: `dist`

建置後 `vite.config.ts` 會將 `app.js`、`a2-3-editor.js`、`a2-3-editor.html`、`config.js`、Cloudflare 設定檔、`assets/operation-guides` 與 `assets/workflow-defaults` 一起放入 `dist`。

## A2-3 發布設定（主機已驗收）

### r3 與現行 A10-v1 的相容整合

本次前端以正式站已驗證的 `87d3ea3`（2026-10-07）為基底，保留 A10-v1 的 mm／cm／m 圖面單位、含單位的送件識別、狀態查詢期限、原任務重查、過期回應防護及安全錯誤顯示。`npm run build` 會先執行 `test:a10`；A10-Bata 退場不移除共用歷史查詢與下載功能。

先前 A2-3 r1／r2 更新包已撤回，不應再用於部署。r3 必須先比對並整合各主機現行程式，保留 A10-v1 的 dispatch 路由、權限、額度與任務處理；前端通過建置不能代替主機相容檢查。發布前再次核對遠端 main 與正式站載入的資產，避免以過時的本機分支覆蓋正式修正。

2026-10-08 主機部署驗收已完成：UM760 使用整合後的 r3 程式，健康檢查、A10-v1 保留、A10-Bata 關閉新送件及 A2-3 `members` 模式的匿名阻擋均已核對。三台目前在役 GPU Worker 的 A2-3 實際生成已通過；`5060TI-1` 僅協助 A1–A8（含 A2-3），兩台 5070 Worker 保留 A9 能力。

本次 `config.js` 已將 `ARCHITECT_AI_A2_3_ENABLED` 設為 `true`，網站發布後即顯示 A2-3。入口開放仍受 UM760 的有效會員驗證、帳號狀態與額度檢查控制。本機 `localhost`／`127.0.0.1` 的 `/?a2_3_test=1#workspace` 參數只供開發定位頁面，不能略過伺服器權限。

主機生成驗收與既有瀏覽器 fixture 測試不等於正式 Supabase 會員整條流程驗收。正式會員的權限回覆、用量、歷史紀錄及成果下載須另行確認；新增生成任務仍依當次驗收安排執行。

A2-3 使用原型衍生的獨立編輯器，透過 `POST /api/a2-3/jobs` 送出 `original_image`、不透明黑白 `mask_image`、`prompt`、`full_mask_ack` 及 `request_key`，每次固定一張，使用 A1–A8 會員共用額度一次。若送出回應中斷，相同圖片、遮罩與提詞的重試會沿用同一個請求識別，避免重複建立任務或扣額度。任務狀態、原圖與最終成果均以會員 Bearer 驗證，成果只能從對應任務取回。

UM760 以 `AIA_A2_3_ENABLED=1` 啟用服務，再用 `AIA_A2_3_ACCESS_MODE` 選擇開放範圍：`testers` 為預設，只允許 `AIA_A2_3_TEST_EMAILS` 名單；`members` 允許通過正式會員驗證的帳號，仍檢查帳號狀態與額度。未設定啟用或模式值無效時不開放。`GET /api/a2-3/status` 回傳 `enabled`、`available`、`access_mode` 及固定的公開 `message`，前端依此顯示使用權限；前端旗標不能略過這些限制。

測試 API 設定應只存在本機測試伺服器或未提交的建置副本，勿將內部主機資訊放入公開 repo。此整合需分別更新 UM760 的專用處理模組，以及具備 A2-3 模型／節點且明確加入此能力的 GPU Worker；僅建置或推送前端不會部署這些服務。更新所有主機的共用程式時也須保留各自能力清單，不可替未驗收主機自動加入 A2-3。

正式發布依下列順序進行：

1. 比對各主機現行版本與待更新檔案，保留主機專有修正、環境設定及既有能力清單。UM760 更新整合後的 `app.py`、`a2_3.py`，並確認相容的 `a10.py`、`a10_v1.py` 與 Pillow 齊備；GPU Worker 更新 `worker.py`、`a2_3_worker.py`，A2-3 啟用主機還須安裝 `requirements-a2_3.txt`、專用工作流與對應模型／節點。已退場的 `a10_worker.py` 不再由共用 Worker 載入，獨立 A10-v1 服務仍須保留。分別完成啟動匯入檢查。
2. 更新並重新啟動 UM760 與本次更新的 Worker。先維持 `testers`，逐台驗收準備啟用 A2-3 的主機，包括實際生成、精確任務 FINAL、原圖尺寸及圈外像素不變。
3. 使用正式 Supabase 會員驗證送件、額度、排隊、歷史紀錄與下載；並回歸 A2-1、A2-2。既有隔離 fixture 身分的瀏覽器／GPU 測試不能取代此項。
4. 在 UM760 明確設定所需開放模式。全部會員正式開放時使用 `members`，確認有效會員的 `/api/a2-3/status` 回覆可用。
5. 確認主機驗收完成及前端 `ARCHITECT_AI_A2_3_ENABLED=true`，執行下方檢查。從前端 Git repo commit/push 至 `origin main`，等待 Cloudflare Pages 建置成功。
6. 在正式網站驗證 A2-3 入口、會員登入、實際生成與下載；檢查瀏覽器 console、手機版和 A2-1／A2-2 原有操作。若需先關閉入口，可把前端旗標改回 `false`；後端是否繼續接受任務另由 UM760 啟用設定控制。

## 上架前必檢查

### A10-Bata 停止新增任務

舊 `system_id=A10` 僅保留會員歷史任務與授權成果下載。工作台 A10 群組只有 `A10-v1`（`A10_V1`），首頁 A10 卡片也導向 A10-v1；舊任務頁不提供上傳或生成表單。A10-v1 的四種建模項目、名稱與 API 保留，`member_a10_lifetime` 獨立額度與會員用量／歷史資料不刪除或重置。

前端更新須配合 UM760 拒絕舊 `/api/a10/jobs` 新送件，並保留歷史成果授權端點。更新 Worker 時依主機職責調整舊 A10 能力；不要因為停止 A10-Bata 就停用 A10-v1。發布前分別驗證 A10-v1 新任務、舊 A10 的 SKP／摘要下載，以及 A10 獨立額度顯示。

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
node --check app.js
node --check a2-3-editor.js
npm run build -- --configLoader native
```

確認 `dist` 內至少包含：

- `index.html`
- `app.js`
- `a2-3-editor.js`
- `a2-3-editor.html`
- `config.js`
- `_headers`
- `_redirects`
- `assets/operation-guides`
- `assets/workflow-defaults`

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


## A10-Site 上線（2026-10-14）

A10 群組新增 A10-Site。上限為 2000 × 2000 公尺，預設全平面，街廓可選航照或灰色；輸出為 SKP 2019。瀏覽器只負責範圍與狀態，資料取得、幾何與 SketchUp 存檔在既有 5070 主機執行。

權限由 UM760 的 `full_access.py` 驗證 Supabase 身分：指定擁有者預設開通，只有該身分可透過 `PATCH /api/admin/members/{email}/full-access` 開關他人的 `full_feature_access`。一般 admin 角色與共用管理密鑰不能開通；既有會員額度不變。未開通者可看到完整畫面，但操作區為 inert，伺服器也拒絕送件及下載。畫面提示「本功能使用需管理員開通」。

`a10_site.py` 提供專用建立、狀態與授權下载端點，成果置於非公開資料夾；前端帶 Bearer 下載成 Blob，不在網址傳遞憑證。 A10-Site 與 A2-3 同樣以持續性 Shadow DOM 工作區嵌入原網站工具面板，保留側欄與原有登入視窗，入口不跳轉頁面。工作區使用主站登入資訊；同帳號刷新或切換功能保留範圍，登出或換帳號則清除先前任務與選取。未開通者可查看畫面，登入及重新確認權限按鈕位於 inert 操作區之外。舊 /a10-site/ 直連頁保留，但不作主站入口。

A10-V1 與 A10-Site 使用同一常駐工作程序、同一 SketchUp 2019 工作階段，依送出時間共用 FIFO，每次僅允許一筆 processing/finalizing。不是各自一條可同時執行的佇列。過期的原生建模 lease 不自動重送，避免舊 SketchUp 工作仍在執行時重入。

UM760 由排程 `AIAS_Dispatch_Service` 在互動登入階段啟動，透過既有啟動批次保留私人設定；5070 延用 `AIAS_A10_V1_Worker`。SketchUp 視窗與該使用者登入階段需保持可用。先前只有 SSH 子程序的啟動方式不能用作常駐服務。未配置 5060。

操作維護：`AIA_BASE_DIR/a10-site-enabled.flag` 控制是否接受 Site 新單（另可用既有環境旗標）；移除可暫停 Site 新單。`a10-shared-maintenance.flag` 暫停兩種原生任務的新領取。更新前先設維護旗標、等待現有工作結束，再更新並重啟已命名的服務排程，跨 SSH 連線驗證健康後清除維護旗標。若出現 `BLOCKED_SKETCHUP.json` 或未結束的過期 lease，先查看該工作原生驗證報告與 SketchUp 模型狀態；不可盲目刪除標記、殺程序或重排任務。

本次驗證包括 18 項後端權限／佇列測試、既有 41 項 A10 前端回歸測試、5070 實際原生存檔／重開，以及正式派工佇列的一筆 100 × 100 公尺診斷任务完成與航照內嵌。此小範圍驗證不代表 2 公里高密度區域效能已壓測。部署候選與操作備份保存在維運工作區 `A10-Site-deployment` 及兩台主機的 site-backup/site-release 目錄。


## 獨立管理後台

主站右上方與會員中心的 Admin 入口以新分頁開啟 `/admin.html`，預設顯示會員管理。頁面上方可切換會員管理與主機／排單監控；切換保留尚未儲存的會員設定，監控只在該頁籤可見時每 15 秒查詢，回到會員管理或背景頁面即暫停。

後台沿用同源 Supabase 登入，另以 `/api/member/profile` 驗證管理員身分後才載入會員與主機資料。不在網址或 opener 傳遞憑證；登出、換帳號及伺服器拒絕授權會撤下資料，晚到的舊回覆不能還原。全功能開通仍由既有擁有者專用端點驗證。

監控使用現有 health、admin/workers 與 admin/overview API，顯示服務連線、排單數量、工作程式回報與目前任務；工作程式有回報不代表 GPU、SketchUp 或任務進度均正常。本次是前端發布，不需要重啟 UM760 或 GPU Worker。Vite 會攜帶獨立後台 HTML、CSS、模組及共用樣式，`npm run build` 包含管理權限與監控回歸測試。

## A2 Plus 發布（2026-10-21）

發布前基線為遠端與正式網站已核對的 c4827c1。新增入口按以下順序排列，保留原項目：A2-1 → A2-1 + → A2-1 +精準版 → A2-2 → A2-2 + → A2-3。對應新 ID 為 A2-1-PLUS、A2-1-PLUS-PRECISE、A2-2-PLUS。

發布前已完成受影響 GPU 的真實生成驗收與新能力登錄核對，UM760 已部署 A2 Plus 並啟用新送件，原有 A10 設定及維護控制保持不變。前端已通過 75 項既有測試與正式建置；這些檢查不代表正式會員端完整流程已驗收，仍須在網站發布後檢查送件、成果比較、歷史及下載。

操作為上傳圖片、選擇光線（平面版選新風格）、修改選項提詞及共用規則、選 1 張或 6 張（預設 1 張）、AI生成圖說。A2-1+ 與精準版另有 B 材質／C 攝影語言；A2-2+ 只含現代暖木、北歐白、日式原木、輕奢大理石，風格已含材質與光線，不另顯示空白 B/C 欄位。每張平面成果保留 AI 原始上色與線稿疊回兩種版本。

2026-10-22 成果區改用表單下方的全寬卡片，預設左右比對，可用單一按鈕切換成直接拖曳分隔線的疊圖比對。多張成果以縮圖切換，平面版另有原始上色／線稿疊回的版本切換；保留單張 PNG、整批 ZIP 與歷史成果讀取。本次呈現方式更新只需發布 Cloudflare Pages，不修改 API 合約、不需重啟 UM760 或 GPU Worker。

三個部署面須分開更新：

1. 受影響 GPU：先比對現行 worker.py，合併 hook；包含 a2_plus_worker.py、其匯入的 a2_3_worker.py、三個 A2_*plus*.json 及 requirements-a2_plus.txt。以 verify_a2_plus.py 驗證該機即時 schema、模型及 Python 匯入，再逐項做實際生成。只將驗收項目加入該機 AIA_A2_PLUS_SYSTEMS，保留既有 worker 身分、A2-3 opt-in 與能力清單。增量安裝包會核對原啟動 BAT 呼叫鏈及實際工作流目錄，備份後在同一個 leaf 加入已驗收能力與啟動檢查；仍從原本外層 BAT 啟動，不用套件 BAT 取代主機入口。a2_plus_launch_guard.ps1 與 a2_plus_startup_probe.py 必須和該 hook 一起保留，以原本 worker 選定的 Python 及有效環境再次檢查。正常啟動後還須核對最新 heartbeat，不能只以 INSTALL_OK 判定可以派工。
2. UM760：更新已與現行主機整合的 app.py 和 a2_plus.py，確認 a10.py、a10_v1.py、a2_3.py、a10_site.py、full_access.py、shared_queue.py 及 Pillow 均齊備。先核對目前主機 hash，保留環境與會員帳冊，完成隔離匯入及既有功能驗證。正式啟用設 AIA_A2_PLUS_ENABLED=1；停用只關閉新送件，歷史授權存取仍保留。維護及服務重新啟動須另行安排。
3. Cloudflare Pages：config.js 的 ARCHITECT_AI_A2_PLUS_ENABLED 設為 true，index.html 的 config.js 查詢版本同步更新為 a2-plus-20261021。只有 UM760 正式啟用及已驗收 worker 最新能力登錄均確認後才能發布。執行 node --check app.js、node --check a2-plus.js 及 npm run build -- --configLoader native，再依核准的發布安排 commit/push。vite 同時複製 a2-plus.js、a2-plus-presets.js、a2-plus.css。正式會員送件、額度、排隊、兩種成果及歷史下載仍需上線驗收。

本機可用 /?a2_plus_test=1#workspace 查看候選入口；此參數不會略過 dispatch 身分與啟用檢查。只有本機 fixture 測試服務使用隔離測試帳號與示意成果。穩定運作後是否替代舊項目須再決定，本次不刪除、不自動停用任何既有工作項目。
