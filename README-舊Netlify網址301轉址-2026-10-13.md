# 自然大叔｜線上報價單｜舊 Netlify 網址 301 永久轉址

日期：2026-10-13

## 本次修改

將舊網址：

- `https://unclequotation.netlify.app/*`

以 **301 Permanent Redirect** 永久轉址到正式網址：

- `https://quote.naturaluncle.com/*`

並保留原本路徑。例如：

- `https://unclequotation.netlify.app/20260527-001`
  → `https://quote.naturaluncle.com/20260527-001`
- `https://unclequotation.netlify.app/q/ABCD2345EFGH`
  → `https://quote.naturaluncle.com/q/ABCD2345EFGH`
- `https://unclequotation.netlify.app/admin/`
  → `https://quote.naturaluncle.com/admin/`

## 保留功能

原本正式網域、報價分享、確認、作廢、PWA、管理頁、API 與 Netlify Functions 的 rewrite 規則皆保留。
本次僅新增「舊 Netlify 網域 → 正式網域」的 host-level 301 轉址規則。
