# Uncle Quote 報價單（Netlify + Cloudinary）

這是一個可直接部署到 **Netlify** 的報價單網站：
- 前端：靜態頁面（`index.html`, `quotes.html`）
- 後端：Netlify Functions（`netlify/functions/*.js`）
- 儲存：Cloudinary（以 **raw JSON** 儲存每份報價單）

---

## 目前檔案結構

```
uncle-quote-main/
  index.html
  app.js
  quotes.html
  netlify.toml
  netlify/
    functions/
      share.js
      view.js
      list.js
      lock.js
      cancel.js
      delete.js
      confirm.js
  README.md
  README.txt
```

---

## 核心功能

### 1) 報價單頁（index.html + app.js）

- 顧客資料、服務項目、合計與活動優惠
- 產生分享連結（可給顧客檢視/確認）
- 顧客「我同意此報價」後：寄通知信 + 封存鎖定
- 作廢報價單（可填原因）

#### 多地址（可新增 / 刪除 / 觸控拖曳排序）
- UI 容器：`#addressList`
- 按鈕：`#addAddressBtn`、`#clearAddressesBtn`
- 每列包含：
  - 地址輸入（`input.address-input`）
  - 拖曳把手（手機/桌機皆可拖曳排序）
  - 刪除按鈕（✕）
  - 每地址時間（`input[type=time].address-time`）

> **資料相容性設計：**
> - 仍保留隱藏欄位 `#customerAddress`、`#customerAddressSlots`，用「換行分隔」存多筆資料。
> - 拖曳/刪除/編輯後會同步寫回兩個隱藏欄位，方便分享/儲存/載入。

#### 方案 B：共用日期 + 每地址自選時間
- 共用日期：`#cleanDate`
- 每地址時間：`input[type=time].address-time`（與該地址綁定，排序時會一起移動）

#### 顯示規則（你目前的客製需求）
- 只有 **1 個地址** 時：時間顯示 **不加「第1地址」**
- 有 **2 個地址以上**：才加上 `第1地址 / 第2地址 ...`
- 時間前綴：依時間自動加上 `上午 / 下午 / 晚上`
  - `< 12:00` → 上午
  - `12:00–17:59` → 下午
  - `>= 18:00` → 晚上

#### 摘要區（重點顯示區）服務地址顯示
- 多地址以「換行」顯示（不使用 `；` 串接）
- `#summaryArea` 使用 `white-space: pre-line;` 以支援 `\n` 斷行

### 2) 管理列表頁（quotes.html）

- 查詢、日期區間、狀態篩選、排序
- 匯出 CSV
- 刪除報價單

---

## 分享 / API（Netlify Functions）

`netlify.toml` 已設定將 `/api/*` 轉到 `/.netlify/functions/*`。

| API | 方法 | 用途 |
|---|---|---|
| `/api/share` | POST | 上傳報價 JSON 到 Cloudinary（raw），回傳分享網址 |
| `/api/view?id=...` | GET | 讀取 Cloudinary raw JSON，回傳資料 + 狀態（locked/cancelled） |
| `/api/list` | GET | 列出報價單（分頁/篩選） |
| `/api/lock` | POST | 封存/鎖定報價單（locked=1） |
| `/api/cancel` | POST | 作廢報價單（可附原因/時間） |
| `/api/delete` | POST | 刪除 Cloudinary 資源 |
| `/api/confirm` | POST | 顧客同意 → 寄通知信（Resend 或 Brevo） |

### 分享連結含稅參數（tax）
- 產生分享連結時會依「顯示含稅」狀態附加 `?tax=1` 或 `?tax=0`
- 開啟連結時：
  - `tax=1`：預設顯示含稅
  - `tax=0`：預設不顯示含稅，並隱藏含稅切換 UI

---

## 環境變數（Netlify Site settings → Environment variables）

### Cloudinary（必填）
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

選填：
- `CLOUDINARY_FOLDER`（預設 `quotes`）
- `QUOTE_PREFIX`（預設 `q-`，列表用的檔名前綴過濾）
- `SITE_BASE_URL`（產生分享網址用，建議設定為你的網站網域）

### Email（顧客同意後寄通知信用）
收寄件：
- `FROM_EMAIL`（或 `EMAIL_FROM`）
- `TO_EMAIL`（或 `EMAIL_TO`）

寄信服務二擇一：
- `RESEND_API_KEY` **或** `BREVO_API_KEY`

選填：
- `SENDER_NAME`
- `EMAIL_SUBJECT_PREFIX`

---

## 備註
- 目前專案 **沒有** `app.backup.js`，也 **沒有** `untaxedBox` 這類額外 DOM 控制點；含稅/未稅顯示由 `app.js` 依切換狀態動態渲染。
- 若要限制 `quotes.html` / 管理 API 的存取，建議加上管理端 token 或使用 Netlify Identity / 基本驗證保護。
