/*! quote-receiver-tailored.js v1.1.0 — Prefill for 自然大叔 線上報價單 (improved) */
(function(){
  'use strict';

  // ====== Configurable 白名單：可以在呼叫頁面用 window.__QUOTE_ALLOW_ORIGINS__ 指定 ======
  // 範例（在你的訂單頁 console 或在載入前的 script 設定）：
  // window.__QUOTE_ALLOW_ORIGINS__ = ['https://your-orders.example.com', 'https://staging.example.com', '*.internal.local'];
  const DEFAULT_ALLOW_ORIGINS = [
    'https://unclequotation.netlify.app' // ← 保留一個預設樣板（請改成你的實際訂單頁域名）
  ];
  const ALLOW_FILE_DEV = true; // 允許本機 file:// 或 origin === 'null' 測試（開發時方便）
  const ALLOW_LOCALHOST_DEV = true; // 允許 localhost 與 127.0.0.1 開發測試

  function loadAllowOrigins(){
    try {
      // 1) 環境變數：window.__QUOTE_ALLOW_ORIGINS__ (優先)
      if (Array.isArray(window.__QUOTE_ALLOW_ORIGINS__) && window.__QUOTE_ALLOW_ORIGINS__.length) {
        return window.__QUOTE_ALLOW_ORIGINS__.slice();
      }
      // 2) meta 標籤：<meta name="quote:allow_origins" content="https://a,https://b,*.example.com">
      const meta = document.querySelector('meta[name="quote:allow_origins"]');
      if (meta && meta.content) {
        return meta.content.split(',').map(s=>s.trim()).filter(Boolean);
      }
    } catch(e){}
    return DEFAULT_ALLOW_ORIGINS.slice();
  }

  const ALLOW_ORIGINS = loadAllowOrigins();

  // 判斷 origin 是否允許（支援精確、通配 *.domain, localhost, file://)
  function isAllowed(origin){
    try {
      if (!origin) origin = '';
      // file:// 在 postMessage 時通常傳 'null'（字串）
      if (ALLOW_FILE_DEV && (origin === 'null' || origin.startsWith('file'))) return true;
      if (ALLOW_LOCALHOST_DEV && (origin.indexOf('localhost') !== -1 || origin.indexOf('127.0.0.1') !== -1)) return true;

      // 精確比對或通配
      for (let rule of ALLOW_ORIGINS){
        if (!rule) continue;
        rule = String(rule).trim();
        if (rule === origin) return true;
        // wildcard like *.example.com
        if (rule.indexOf('*') !== -1){
          // convert to regex, escape dots
          const re = new RegExp('^' + rule.split('*').map(s=>s.replace(/[.+^${}()|[\]\\]/g,'\\$&')).join('.*') + '$', 'i');
          if (re.test(origin)) return true;
        }
        // allow scheme-less host match: if rule is example.com and origin contains example.com
        try {
          const u = new URL(origin);
          if (rule === u.host) return true;
        } catch(_){}
      }
    } catch(e){}
    return false;
  }

  function whenReady(cb){
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', cb, {once:true});
    } else cb();
  }
  function setValue(el, val){
    if (!el) return;
    el.value = (val ?? '');
    el.dispatchEvent(new Event('input', {bubbles:true}));
    el.dispatchEvent(new Event('change', {bubbles:true}));
  }
  function setSelectByTextOrValue(selEl, value, text){
    if (!selEl) return;
    const opts = Array.from(selEl.options || []);
    let hit = null;
    if (value != null) hit = opts.find(o => String(o.value) === String(value));
    if (!hit && text)  hit = opts.find(o => String(o.textContent).trim() === String(text).trim());
    if (hit){
      selEl.value = hit.value;
      selEl.dispatchEvent(new Event('change', {bubbles:true}));
    }
  }

  // 更彈性的 service mapping：支援更多 code、也以 label 關鍵字做兜底
  function mapServiceForThisPage(service){
    const code  = (service && service.code)  || '';
    const label = (service && service.label) || (typeof service === 'string' ? service : '');
    let serviceValue = '';
    let optionText   = '';

    // label keyword first (容錯最高)
    if (/分離|壁掛|split|wall/i.test(label)) {
      serviceValue = '冷氣清洗';
      optionText   = '分離式（壁掛式）';
    } else if (/吊隱|隱藏|duct|hidden|吊/i.test(label)) {
      serviceValue = '冷氣清洗';
      optionText   = '吊隱式（隱藏式）';
    } else if (/窗型|窗機|window/i.test(label)) {
      serviceValue = '冷氣清洗';
      optionText   = '窗型（Window）';
    } else if (/洗衣|直立|top|直立式/i.test(label)) {
      serviceValue = '洗衣機清洗';
      optionText   = '直立式';
    } else if (/前開|滾筒|front|drum/i.test(label)) {
      serviceValue = '洗衣機清洗';
      optionText   = '前開式（滾筒）';
    } else if (/水塔|water\s*tank/i.test(label)) {
      serviceValue = '水塔清洗';
      optionText   = '';
    } else if (/抽油煙機|排油煙|rangehood|hood/i.test(label)) {
      serviceValue = '抽油煙機清洗';
      optionText   = '';
    } else if (/冰箱|fridge|refrigerator/i.test(label)) {
      serviceValue = '冰箱清洗';
      optionText   = '';
    } else if (/冷氣|ac|aircon/i.test(label)) {
      // generic cold-air fallback
      serviceValue = '冷氣清洗';
    }

    // code-based explicit mapping（補強）
    if (!serviceValue){
      switch(String(code)){
        case 'ac_split':       serviceValue='冷氣清洗'; optionText='分離式（壁掛式)'; break;
        case 'ac_duct':        serviceValue='冷氣清洗'; optionText='吊隱式（隱藏式)'; break;
        case 'ac_window':      serviceValue='冷氣清洗'; optionText='窗型（Window）'; break;
        case 'ac_other':       serviceValue='冷氣清洗'; optionText='其他型式'; break;
        case 'washer_top':     serviceValue='洗衣機清洗'; optionText='直立式'; break;
        case 'washer_front':   serviceValue='洗衣機清洗'; optionText='前開式（滾筒）'; break;
        case 'water_tank':     serviceValue='水塔清洗'; optionText=''; break;
        case 'rangehood':      serviceValue='抽油煙機清洗'; optionText=''; break;
        case 'fridge':         serviceValue='冰箱清洗'; optionText=''; break;
        case 'uv_disinfect':   serviceValue='消毒/殺菌'; optionText='紫外線消毒'; break;
        // 若你有其他自定義 code，可以在這裡加入
      }
    }

    // 最後兜底：少數情況僅有 '冷氣清洗' 之類 label
    if (!serviceValue && /冷氣/.test(label)) serviceValue = '冷氣清洗';
    if (!serviceValue && /洗衣/.test(label)) serviceValue = '洗衣機清洗';

    return { serviceValue, optionText };
  }

  function prefill(payload){
    // 這些 ID 來自報價單頁的實際欄位：
    const $name    = document.querySelector('#customerName');
    const $phone   = document.querySelector('#customerPhone');
    const $address = document.querySelector('#customerAddress');
    const $date    = document.querySelector('#cleanDate');
    const $time    = document.querySelector('#cleanTime');

    setValue($name,    payload.name);
    setValue($phone,   payload.phone);
    setValue($address, payload.address);

    if (payload.appointment){
      if (payload.appointment.date) setValue($date, payload.appointment.date);
      if (payload.appointment.time) setValue($time, payload.appointment.time);
      try { if (typeof window.updateCleanFull === 'function') window.updateCleanFull(); } catch(_){}
    }

    // 清洗項目在表格第一列：.service 與 .option（保留既有行為）
    const row = document.querySelector('#quoteTable tbody tr');
    if (row && payload.service){
      const sSel = row.querySelector('.service');
      const oSel = row.querySelector('.option');
      const mapped = mapServiceForThisPage(payload.service);
      setSelectByTextOrValue(sSel, mapped.serviceValue, mapped.serviceValue);
      if (mapped.optionText) setSelectByTextOrValue(oSel, null, mapped.optionText);
      try { if (typeof window.updateTotals === 'function') window.updateTotals(); } catch(_){}
    }
  }

  // 接收 postMessage，並回 ACK
  window.addEventListener('message', function(ev){
    if (!isAllowed(ev.origin)) {
      console.warn('[quote-receiver] blocked origin:', ev.origin, 'allowed:', ALLOW_ORIGINS);
      return;
    }
    const msg = ev.data || {};
    if (msg.type !== 'PREFILL_QUOTE') return;
    whenReady(function(){ prefill(msg.payload || {}); });
    try { ev.source && ev.source.postMessage({type:'PREFILL_ACK'}, ev.origin); } catch(_){}
  });

  console.debug('[quote-receiver] ready (tailored to #customerName/#customerPhone/#customerAddress/#cleanDate/#cleanTime & #quoteTable .service/.option)');
  console.debug('[quote-receiver] allowed origins:', ALLOW_ORIGINS, 'ALLOW_FILE_DEV:', ALLOW_FILE_DEV, 'ALLOW_LOCALHOST_DEV:', ALLOW_LOCALHOST_DEV);
})();
