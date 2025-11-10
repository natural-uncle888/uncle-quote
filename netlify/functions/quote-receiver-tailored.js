/*! quote-receiver-tailored.js v1.0.1 — Prefill for 自然大叔 線上報價單 */
(function(){
  'use strict';

  // ====== 安全白名單：請改成你的訂單系統網域 ======
  const ALLOW_ORIGINS = [
    'https://88888888888.netlify.app'   // ← 改成你的網域；本機 file:// 可先用下方 DEV 選項
  ];
  const ALLOW_FILE_DEV = true; // 允許本機 file:// 測試（origin 會是 "null"）

  function isAllowed(origin){
    if (ALLOW_ORIGINS.includes(origin)) return true;
    if (ALLOW_FILE_DEV && (origin === 'null' || origin.startsWith('file'))) return true;
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

  // 把 {code,label} 轉成本頁的服務/補充說明（select 的中文值）
  function mapServiceForThisPage(service){
    const code  = (service && service.code)  || '';
    const label = (service && service.label) || '';

    // 預設
    let serviceValue = ''; // 對應 <select.service> 的 value
    let optionText   = ''; // 對應 <select.option> 內文

    // 以 label 為主判斷（容錯最高）
    if (/分離|壁掛/.test(label)) {
      serviceValue = '冷氣清洗';
      optionText   = '分離式（壁掛式）';
    } else if (/吊隱|隱藏/.test(label)) {
      serviceValue = '冷氣清洗';
      optionText   = '吊隱式（隱藏式）';
    } else if (/洗衣|直立/.test(label)) {
      serviceValue = '洗衣機清洗';
      optionText   = '直立式';
    } else if (/水塔/.test(label)) {
      serviceValue = '水塔清洗';
      optionText   = '';
    }

    // 若 label 沒命中，用 code 與別名補強
    if (!serviceValue){
      switch(String(code)){
        case 'ac_split':  serviceValue = '冷氣清洗'; optionText='分離式（壁掛式）'; break;
        case 'ac_duct':   serviceValue = '冷氣清洗'; optionText='吊隱式（隱藏式）'; break;
        case 'washer_top':serviceValue = '洗衣機清洗'; optionText='直立式'; break;
        case 'water_tank':serviceValue = '水塔清洗'; optionText=''; break;
      }
    }
    // 再次用 label 關鍵字兜底（例如只給了「冷氣清洗」）
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
      // 若頁面有 updateCleanFull()，change 事件會自動更新完整時間顯示
      try { if (typeof window.updateCleanFull === 'function') window.updateCleanFull(); } catch(_){}
    }

    // 清洗項目在表格第一列：.service 與 .option
    const row = document.querySelector('#quoteTable tbody tr');
    if (row && payload.service){
      const sSel = row.querySelector('.service');
      const oSel = row.querySelector('.option');
      const mapped = mapServiceForThisPage(payload.service);
      setSelectByTextOrValue(sSel, mapped.serviceValue, mapped.serviceValue);
      if (mapped.optionText) setSelectByTextOrValue(oSel, null, mapped.optionText);
      // 改動後自動更新金額
      try { if (typeof window.updateTotals === 'function') window.updateTotals(); } catch(_){}
    }
  }

  window.addEventListener('message', function(ev){
    if (!isAllowed(ev.origin)) return;
    const msg = ev.data || {};
    if (msg.type !== 'PREFILL_QUOTE') return;
    whenReady(function(){ prefill(msg.payload || {}); });
    try { ev.source && ev.source.postMessage({type:'PREFILL_ACK'}, ev.origin); } catch(_){}
  });

  console.debug('[quote-receiver] ready (tailored to #customerName/#customerPhone/#customerAddress/#cleanDate/#cleanTime & #quoteTable .service/.option)');
})();
