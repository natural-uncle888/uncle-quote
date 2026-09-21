# 摘要與匯款資訊優化 v2.1 Hotfix

- 修正 `app.js` 匯款摘要文字處理的正規表示式換行語法錯誤。
- 該錯誤會造成整支 `app.js` 無法載入，進而使舊報價顯示為金額 0、日期/服務資料未載入。
- 已使用 `node --check` 檢查專案內所有 JavaScript 檔案，語法均通過。
- 更新 `app.js` query version 與 PWA cache name，降低部署後仍讀取錯誤快取的機率。
- 其餘 v2 的摘要精簡與匯款資訊版面不變。
