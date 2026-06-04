# PWA 設定說明

這版已將 `index.html` 與 `quotes.html` 做成 PWA，可在手機瀏覽器使用「加入主畫面」安裝成類似 App 的開啟方式。

## 檔案

- `manifest-quote.webmanifest`：報價單頁用，icon 使用 `/icons/quote-*`。
- `manifest-admin.webmanifest`：管理列表頁用，icon 使用 `/icons/admin-*`。
- `service-worker.js`：PWA 快取與安裝支援。API 與 Cloudinary 資料不快取，避免報價狀態或管理列表顯示舊資料。
- `icons/`：兩組 App icon，不同尺寸供 Android、iOS、桌面瀏覽器使用。

## 使用方式

部署到 Netlify 後，用手機 Safari 或 Chrome 開啟：

- 報價單 App：開啟首頁或報價單頁，選擇「加入主畫面」，App 名稱為「大叔報價」。
- 管理 App：開啟 `/quotes.html`，選擇「加入主畫面」，App 名稱為「大叔(報)管理」。

手機加入主畫面後，會用各自的名稱與 icon 顯示。


## 重要：分成兩個主畫面 icon 的安裝方式

這版已將兩個 PWA 拆成不同 scope，避免手機瀏覽器把它們判斷成同一個 App：

- 報價單 App：請開啟 `/quote/` 後加入主畫面，名稱為「大叔報價」。
- 管理 App：請開啟 `/admin/` 後加入主畫面，名稱為「大叔(報)管理」。

若手機之前已安裝舊版，只看到一個 icon，請先把舊的主畫面 icon 或已安裝的 PWA 移除，再重新用以上兩個網址分別加入主畫面。

`/index.html` 與 `/quotes.html` 仍然保留可用；`/quote/` 與 `/admin/` 是為了讓瀏覽器能用不同 scope 分開安裝。
