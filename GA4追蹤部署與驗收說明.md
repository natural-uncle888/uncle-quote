# 自然大叔｜線上報價單 GA4 追蹤版部署與驗收說明

日期：2026-10-23

## GA4 設定
- GA4 資源：自然大叔｜網站分析
- Measurement ID：`G-Y1M01156XR`
- 正式網域：`https://quote.naturaluncle.com/`

## 追蹤範圍
- 只在顧客分享報價連結（日期流水號、`/q/` 短網址、相容的 `cid`／`#data=` 連結）啟用 Google tag。
- 內部建立報價的首頁、`quotes.html` 管理列表及 `/admin/` 不送出 GA4 事件。
- 傳給 GA4 的頁面網址一律正規化成 `/quote/view`，不包含原始報價流水號、query string 或 hash。
- 不讀取或傳送顧客姓名、電話、地址、服務明細、報價金額、報價 ID、作廢原因或表單欄位內容。
- 已在顧客報價頁底部加上簡短的 GA4 統計告知。

## 事件
| GA4 事件 | 中文用途 | 觸發時機 |
|---|---|---|
| `page_view` | 報價頁瀏覽 | 顧客開啟分享報價連結 |
| `quote_view` | 報價內容成功載入 | 分享資料成功從後端載入或舊式資料連結成功解析 |
| `quote_confirm_click` | 點擊同意報價 | 顧客點擊「我同意此報價」 |
| `quote_confirm_success` | 成功確認報價 | 確認 API 成功，且需要的封存流程完成 |
| `quote_contact_click` | 點擊聯絡方式 | 顧客點擊 LINE、Facebook、官方網站、電話或電子郵件連結 |

事件參數只包含一般頁面分類、報價狀態或聯絡方式，不包含顧客資料、報價 ID、服務內容或金額。

## 部署方式
1. 先備份目前 Netlify 正式部署版本。
2. 解壓縮 ZIP，進入 `naturaluncle-quote-ga4-2026-10-23` 資料夾。
3. 將資料夾中的所有檔案與子資料夾完整部署到**原本 `quote.naturaluncle.com` 所屬的 Netlify Site**；不要部署到預約、價目表或照片案例網站。
4. 確認 `index.html`、`app.js`、`ga4-tracking.js`、`netlify.toml`、`netlify/functions/`、`service-worker.js` 及 `icons/` 都位於網站根目錄正確位置。
5. 不要更改 Netlify 環境變數；既有 Cloudinary、Email、LINE 與 301 轉址設定應保留。

## 驗收步驟
1. 用手機或無痕視窗開啟一份真實的顧客分享報價連結。
2. 在 GA4「即時」報表確認 `page_view` 出現。
3. 等報價內容載入後，確認 `quote_view` 出現。
4. 點擊 LINE 或官方網站連結，確認 `quote_contact_click` 出現。
5. **不要為了測試而真的確認客戶的有效報價。** 若需測試 `quote_confirm_click`／`quote_confirm_success`，請先建立一份明確標示為測試的報價單，確認不會寄出真實通知或影響正式案件，再測試。
6. 在 GA4 DebugView 或即時事件詳情檢查 `page_location` 是否只顯示 `/quote/view`，沒有報價流水號、query string 或 hash。
7. 打開內部報價建立首頁及管理頁，確認沒有新的 GA4 事件送出。

## 注意
- 本 ZIP 已做靜態程式與 JavaScript 語法檢查，但尚未部署到正式網站，不能視為正式環境已驗收。
- `quote_confirm_success` 事件出現後，可再於 GA4 管理介面將它標記為「重要事件」（Key event），以供後續中文儀表板使用。
