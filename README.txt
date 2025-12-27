Uncle Quote 報價單（Netlify + Cloudinary）

此專案可直接部署到 Netlify：
- 前端：index.html / quotes.html
- 後端：netlify/functions/*.js（透過 netlify.toml 將 /api/* 轉址）
- 儲存：Cloudinary（以 raw JSON 儲存每份報價單）

---

一、目前檔案結構

uncle-quote-main/
  index.html
  app.js
  quotes.html
  netlify.toml
  netlify/functions/
    share.js
    view.js
    list.js
    lock.js
    cancel.js
    delete.js
    confirm.js
  README.md
  README.txt

---

二、主要功能

1) 報價單頁（index.html + app.js）
- 顧客資料、服務項目、合計、活動優惠
- 產生分享連結（給顧客檢視/確認）
- 顧客同意：寄通知信 + 封存鎖定
- 作廢報價單（可填原因）

2) 多地址（可新增/刪除/觸控拖曳排序）
- 容器：#addressList
- 按鈕：#addAddressBtn、#clearAddressesBtn
- 每列：地址 input + 拖曳把手 + 刪除 ✕ + 每地址時間 input(type=time)
- 相容性：仍以隱藏 textarea #customerAddress / #customerAddressSlots 用「換行分隔」儲存

3) 方案 B：共用日期 + 每地址自選時間
- 共用日期：#cleanDate
- 每地址時間：input.address-time（排序時會跟著地址一起移動）

4) 顯示規則（現行客製）
- 只有 1 個地址：時間顯示不加「第1地址」
- 2 個地址以上：顯示 第1地址/第2地址...
- 時間前綴：<12 上午；12–17 下午；>=18 晚上
- 摘要區地址：多地址以換行顯示（#summaryArea 支援斷行顯示）

5) 管理列表（quotes.html）
- 查詢/篩選/排序、匯出 CSV、刪除報價單

---

三、API（Netlify Functions）
- POST /api/share     上傳報價 JSON，回傳分享網址
- GET  /api/view      讀取報價 JSON + 狀態（locked/cancelled）
- GET  /api/list      列表（可分頁）
- POST /api/lock      封存/鎖定
- POST /api/cancel    作廢（含原因/時間）
- POST /api/delete    刪除 Cloudinary 資源
- POST /api/confirm   顧客同意 → 寄通知信（Resend 或 Brevo）

分享連結含稅參數（tax）：
- 產生連結時依含稅狀態附上 tax=1 或 tax=0
- tax=0 時會隱藏含稅切換 UI

---

四、環境變數（Netlify → Site settings → Environment variables）

Cloudinary（必填）
- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET

Cloudinary（選填）
- CLOUDINARY_FOLDER（預設 quotes）
- QUOTE_PREFIX（預設 q-，列表檔名前綴過濾）
- SITE_BASE_URL（產生分享網址用，建議設定）

Email（顧客同意後寄通知信）
- FROM_EMAIL（或 EMAIL_FROM）
- TO_EMAIL（或 EMAIL_TO）
- RESEND_API_KEY 或 BREVO_API_KEY（二擇一）
- 選填：SENDER_NAME、EMAIL_SUBJECT_PREFIX

---

備註：
- 本版本沒有 app.backup.js，也沒有 untaxedBox；含稅/未稅顯示由 app.js 動態控制。
- 若要限制管理頁/管理 API 存取，建議加上管理端 token 或使用 Netlify Identity/基本驗證。
