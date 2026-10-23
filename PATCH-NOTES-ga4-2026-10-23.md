# GA4 追蹤整合（2026-10-23）

- 新增 `ga4-tracking.js`，沿用既有 GA4 Measurement ID `G-Y1M01156XR`。
- 只對顧客分享報價連結啟用追蹤；內部報價建立頁、管理列表不追蹤。
- 新增事件：`quote_view`、`quote_confirm_click`、`quote_confirm_success`、`quote_contact_click`。
- GA4 `page_location` 正規化為 `/quote/view`，不傳送報價流水號、原始 query/hash。
- 追蹤程式不讀取或傳送姓名、電話、地址、服務明細、報價金額、報價 ID 或作廢原因。
- `quote_confirm_success` 只在確認 API 與必要封存流程成功後觸發。
- 更新 PWA cache 名稱與核心程式版本，避免已安裝的報價 App 持續使用舊快取。
- 保留既有 Netlify 301 永久轉址、API、Functions 與環境變數。
