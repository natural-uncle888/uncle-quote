/* 自然大叔｜線上報價單 GA4 追蹤
 * Measurement ID: G-Y1M01156XR
 * 僅追蹤顧客分享的報價單頁；不追蹤內部建立頁與管理列表。
 * 不讀取、不傳送顧客姓名、電話、地址、服務明細、報價金額或報價 ID。
 */
(function () {
  'use strict';

  var MEASUREMENT_ID = 'G-Y1M01156XR';
  var url;
  try { url = new URL(window.location.href); } catch (_) { return; }

  var hash = String(url.hash || '');
  var adminMode = url.searchParams.get('admin') === '1' || /(?:^#|[?&])admin=1(?:&|$)/i.test(hash);
  var pathname = url.pathname || '/';
  var datedQuotePath = /^\/\d{8}-\d{3,}\/?$/.test(pathname);
  var shortQuotePath = /^\/q\/[^/]+\/?$/i.test(pathname);
  var queryShare = url.searchParams.has('cid');
  var hashShare = /[#&?]cid=[^&]+/i.test(hash);
  var legacyDataShare = /^#data=/i.test(hash);
  var isCustomerQuotePage = !adminMode && (datedQuotePath || shortQuotePath || queryShare || hashShare || legacyDataShare);

  // 沒有顧客分享連結時立即停止：不載入 Google tag，也不記錄內部人員的編輯/管理操作。
  if (!isCustomerQuotePage) return;

  // 報價網址路徑可能含報價流水號，舊式 hash 甚至可能含報價資料。
  // 傳給 GA4 的網址一律正規化，不帶原始 path ID、query string 或 hash。
  var SAFE_PAGE_LOCATION = window.location.origin + '/quote/view';
  var SAFE_PAGE_TITLE = '自然大叔｜線上報價單';

  function safeReferrer() {
    if (!document.referrer) return undefined;
    try {
      var ref = new URL(document.referrer);
      // 同站或子網域的路徑可能包含客戶/報價識別資訊，只保留來源網域。
      return ref.origin + '/';
    } catch (_) {
      return undefined;
    }
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', MEASUREMENT_ID, {
    send_page_view: false,
    page_location: SAFE_PAGE_LOCATION,
    page_referrer: safeReferrer(),
    page_title: SAFE_PAGE_TITLE,
    cookie_domain: 'auto',
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });

  var tagScript = document.createElement('script');
  tagScript.async = true;
  tagScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + MEASUREMENT_ID;
  document.head.appendChild(tagScript);

  function track(eventName, params) {
    var eventParams = {
      page_location: SAFE_PAGE_LOCATION,
      page_title: SAFE_PAGE_TITLE,
      page_category: '線上報價單'
    };
    if (params && typeof params === 'object') {
      Object.keys(params).forEach(function (key) { eventParams[key] = params[key]; });
    }
    window.gtag('event', eventName, eventParams);
  }

  function quoteState() {
    if (window.__QUOTE_CANCELLED__ || String(window.QUOTE_STATUS || '').toLowerCase() === 'cancelled') return '已作廢';
    if (window.QUOTE_CONFIRMED === true || String(window.QUOTE_STATUS || '').toLowerCase() === 'confirmed') return '已確認';
    if (window.QUOTE_LOCKED === true || window.QUOTE_LOCKED === '1' || window.QUOTE_LOCKED === 1) return '已封存';
    return '待確認';
  }

  // 一般頁面瀏覽（不含報價 ID 與原始 query/hash）。
  track('page_view', {
    page_location: SAFE_PAGE_LOCATION,
    page_referrer: safeReferrer(),
    page_title: SAFE_PAGE_TITLE
  });

  // app.js 只有在分享資料成功載入/解析後才發出此事件。
  document.addEventListener('nu:quote-viewed', function () {
    track('quote_view', { quote_state: quoteState() });
  });

  // 顧客按下「我同意此報價」：只記錄點擊，不傳送按鈕文字或報價資料。
  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest
      ? event.target.closest('#confirmBtnDesktop, #confirmBtnMobile')
      : null;
    if (target) track('quote_confirm_click', { quote_state: quoteState() });

    var link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!link) return;
    var href = link.getAttribute('href') || '';
    var method = '';
    var domain = '';
    if (/^tel:/i.test(href)) {
      method = '電話';
    } else if (/^mailto:/i.test(href)) {
      method = '電子郵件';
    } else {
      try {
        var dest = new URL(href, window.location.href);
        domain = dest.hostname.toLowerCase();
        if (domain === 'lin.ee' || domain === 'line.me' || domain.endsWith('.line.me')) method = 'LINE';
        else if (domain === 'facebook.com' || domain.endsWith('.facebook.com')) method = 'Facebook';
        else if (domain === 'naturaluncle.com' || domain.endsWith('.naturaluncle.com')) method = '官方網站';
      } catch (_) {}
    }
    if (method) track('quote_contact_click', { contact_method: method });
  });

  // app.js 僅在確認 API 成功且封存流程完成後發出此事件。
  document.addEventListener('nu:quote-confirmed', function () {
    track('quote_confirm_success', { quote_state: '已確認' });
  });
})();
