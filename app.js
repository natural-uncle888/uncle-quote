
/* ===== UI helpers for cancelled state ===== */
function showCancelledUI(reason, timeText){
  try{
    const banner = document.querySelector('#cancelBanner');
    if (banner){
      let extra = [];
      if (timeText) extra.push(timeText);
      if (reason) extra.push(`原因：${reason}`);
      banner.textContent = `⚠️ 本報價單已作廢${extra.length? '（' + extra.join('，') + '）' : ''}`;
      banner.classList.remove('d-none');
    }
    document.body.classList.add('cancelled-watermark');
  }catch(_){ /* noop */ }
}

function alertCancelledOnce(){
  if (window.__ALERTED_CANCELLED__) return;
  window.__ALERTED_CANCELLED__ = true;
  try{ alert('⚠️ 注意：本報價單已作廢，僅供查看，請勿繼續操作。'); }catch(_){}
}
/* ===== end helpers ===== */

/* =====================
   公用工具
===================== */
function qs(sel){ return document.querySelector(sel); }
function qsa(sel){ return document.querySelectorAll(sel); }
function getParam(name){ try{ return new URL(location.href).searchParams.get(name) || ""; }catch(_){ return ""; } }
function getCid(){
  const q = getParam('cid'); if (q) return q;
  const m = (location.hash||"").match(/[#&?]cid=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}
function isAdmin(){ return getParam('admin') === '1' || /[?&]admin=1/.test(location.hash||""); }
function setText(el, s){ if (el) el.textContent = String(s); }
function addClass(el, c){ if (el) el.classList.add(c); }
function removeClass(el, c){ if (el) el.classList.remove(c); }
function toggle(el, show){ if (el) el.classList.toggle('d-none', !show); }

// ========== Mobile bottom bar visibility helper（ChatGPT Patch） ==========
function setMobileBottomBar(show){
  const bar = document.querySelector('.mobile-bottom-bar');
  // === Injected: strengthen cancelled UI trigger ===
  try {
    const __cancelledStrong =
      isCancelled ||
      (Array.isArray(res.tags) && (res.tags.includes('CANCELLED') || res.tags.includes('CANCELED') || res.tags.includes('CANCEL'))) ||
      (typeof ctx.status === 'string' && /cancel+ed?/i.test(ctx.status)) ||
      (ctx.cancelled === true || ctx.isCancelled === true);

    if (__cancelledStrong) {
      const cancelInfo = (res && res.cancelInfo) || (ctx && ctx.cancelInfo) || {};
      const reason = cancelInfo.reason || (ctx && ctx.reason) || '';
      const timeText = cancelInfo.timeText || (ctx && ctx.cancelledAt) || '';
      showCancelledUI(reason, timeText);
      alertCancelledOnce();
    }
  } catch(__){ /* ignore */ }
  // === End Injected ===

  if (!bar) return;
  // 以行為為主：show=false → 移除；show=true → 顯示（仍受 CSS @media 控制）
  bar.style.display = show ? '' : 'none';
}
// ========== End helper ==========

function wantShowCancel(){ return true; }


/* 取消狀態全域旗標 */
window.__QUOTE_CANCELLED__ = false;

/* =====================
   Header 初始化
===================== */
(function initHeader(){
  const el = qs("#quoteInfo");
  if (!el) return;
  const d = new Date();
  const dateStr = `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
  el.innerHTML = `<span class="qi-proj">承辦項目：家電清洗服務</span><span class="qi-sep"> ｜ </span><span class="qi-date">報價日期：${dateStr}</span>`;
})();

/* =====================
   預約時間合成
===================== */
function updateCleanFull(){
  const dv = qs("#cleanDate")?.value;
  const tv = qs("#cleanTime")?.value;
  if(!dv || !tv) return;
  const dt = new Date(`${dv}T${tv}`);
  const wd = ["星期日","星期一","星期二","星期三","星期四","星期五","星期六"][dt.getDay()];
  const yyyy = dt.getFullYear(); const mm = String(dt.getMonth()+1).padStart(2,'0'); const dd = String(dt.getDate()).padStart(2,'0');
  const hh = String(dt.getHours()).padStart(2,'0'); const mi = String(dt.getMinutes()).padStart(2,'0');
  const ampm = dt.getHours() < 12 ? "上午" : "下午";
  qs("#cleanFull").innerHTML = `<span class="cf-date">${yyyy}/${mm}/${dd}（${wd}）</span><span class="cf-time">${ampm} ${hh}:${mi} 開始</span>`;
  try{ updateSummaryCard(); }catch(_){}
}
qs("#cleanDate")?.addEventListener("change", updateCleanFull);
qs("#cleanTime")?.addEventListener("change", updateCleanFull);

/* =====================
   報價摘要卡同步
===================== */
function updateSummaryCard(){
  const totalSpan   = document.querySelector('#summaryTotal');
  const taxTag      = document.querySelector('#summaryTaxTag');
  const statusSpan  = document.querySelector('#summaryStatus');
  const dateSpan    = document.querySelector('#summaryDate');
  const areaSpan    = document.querySelector('#summaryArea');

  // 1. 金額：優先取含稅，否則未稅
  let rawText = '';
  const withTax = document.querySelector('#totalWithTax');
  const noTax   = document.querySelector('#total');
  if (withTax) rawText = withTax.textContent.trim();
  else if (noTax) rawText = noTax.textContent.trim();

  if (totalSpan && rawText){
    const num = parseInt(rawText.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num)){
      try{
        totalSpan.textContent = num.toLocaleString('zh-TW');
      }catch(_){
        totalSpan.textContent = String(num);
      }
    }
  }

  // 2. 稅別 tag：勾選含稅才顯示
  const showTax = document.querySelector('#toggleTax')?.checked === true;
  if (taxTag){
    taxTag.classList.toggle('d-none', !showTax);
  }

  // 3. 預約時間：直接拿 #cleanFull 的文字
  if (dateSpan){
    const src = document.querySelector('#cleanFull');
    const txt = (src?.innerText || src?.textContent || '').trim();
    dateSpan.textContent = txt || '尚未排定，將由我們與您聯繫。';
  }

  // 4. 服務地址：拿 #customerAddress 的值
  if (areaSpan){
    const addr = document.querySelector('#customerAddress');
    const val = (addr?.value || addr?.textContent || '').trim();
    areaSpan.textContent = val || '地址尚未填寫';
  }

  // 5. 狀態：用全域狀態 / 作廢旗標推論
  let key = '';
  if (typeof window.QUOTE_STATUS === 'string') {
    key = window.QUOTE_STATUS.toLowerCase();
  } else if (window.__QUOTE_CANCELLED__) {
    key = 'cancelled';
  }

  // 狀態標籤（摘要卡右側）
  let label = '待顧客確認';
  let cls   = 'badge bg-warning text-dark';

  // 對客戶說明的下一步提示
  let hintText = '請您確認以下資料與報價內容無誤後，點選「我同意此報價」，以利後續的安排事宜。';

  if (key === 'confirmed') {
    label   = '已確認';
    cls     = 'badge bg-success';
    hintText = '您已同意此報價，我們會依照預約時間安排服務，如需變更請與我們聯繫。';
  } else if (key === 'cancelled') {
    label   = '已作廢';
    cls     = 'badge bg-secondary';
    hintText = '本報價單已作廢，僅供紀錄，如需重新估價請與我們聯繫。';
  }

  if (statusSpan) {
    statusSpan.textContent = label;
    statusSpan.className = cls;
  }

  // 同步更新摘要卡上方的提示列
  const hintLabelEl = document.querySelector('#statusHintLabel');
  const hintTextEl  = document.querySelector('#statusHintText');

  if (hintLabelEl) hintLabelEl.textContent = label;
  if (hintTextEl)  hintTextEl.textContent  = hintText;
}

/* 類別標籤與小計輔助函數 */
function getServiceCategoryLabel(selectEl){
  if (!selectEl) return '';
  try{
    const opt = selectEl.options[selectEl.selectedIndex];
    if (!opt) return '';
    const parent = opt.parentElement;
    if (parent && parent.tagName === 'OPTGROUP'){
      return parent.getAttribute('label') || parent.label || '';
    }
  }catch(_){}
  return '';
}

function updateRowCategoryTag(tr){
  if (!tr) return;
  const serviceSelect = tr.querySelector('.service');
  if (!serviceSelect) return;
  const cat = getServiceCategoryLabel(serviceSelect);
  let pill = tr.querySelector('.service-cat-tag');
  if (cat){
    if (!pill){
      pill = document.createElement('div');
      pill.className = 'service-cat-tag small text-muted';
      serviceSelect.insertAdjacentElement('afterend', pill);
    }
    pill.textContent = cat;
  }else if (pill){
    pill.textContent = '';
  }
}

/* =====================
   自動帶價 + 合計
===================== */


function updateTotals(){
  let total = 0, hasAC=false, hasPipe=false;
  const categoryTotals = {};

  // 先掃描是否有指定項目以決定優惠
  qsa("#quoteTable tbody tr").forEach(tr=>{
    const s = tr.querySelector(".service")?.value || "";
    if (s === "冷氣清洗") hasAC = true;
    if (s === "自來水管清洗") hasPipe = true;
  });

  // 計算每列小計與總計（維持你原本的定價與優惠規則）
  qsa("#quoteTable tbody tr").forEach(tr=>{
    const service = tr.querySelector(".service")?.value || "";
    const option  = tr.querySelector(".option")?.value  || "";
    const qtyEl   = tr.querySelector(".qty");
    const priceEl = tr.querySelector(".price");
    const noteEl  = tr.querySelector(".discount-note");
    const subEl   = tr.querySelector(".subtotal");
    const qty = Math.max(1, Number(qtyEl?.value || 1));
    let price = Number(priceEl?.value || 0);

    if (noteEl) noteEl.textContent = "";
    const overridden = priceEl?.dataset.override === "true";

    if (!overridden){
      if (service === "冷氣清洗" && option.includes("分離式")){
        price = (qty >= 3) ? 1500 : 1800;
        if (qty >= 3 && noteEl) noteEl.textContent = "已套用三台以上優惠價";
      } else if (service === "冷氣清洗" && option.includes("吊隱式")){
        price = 2800;
      } else if (service === "洗衣機清洗" && option.includes("直立式")){
        price = hasAC ? 1800 : 2000;
        if (hasAC && noteEl) noteEl.textContent = "已套用冷氣清洗優惠價";
      } else if (service === "防霉處理"){
        price = (qty >= 5) ? 250 : 300;
        if (qty >= 5 && noteEl) noteEl.textContent = "已套用五台以上優惠價";
      } else if (service === "臭氧殺菌"){
        price = (qty >= 5) ? 150 : 200;
        if (qty >= 5 && noteEl) noteEl.textContent = "已套用五台以上優惠價";
      } else if (service === "變形金剛機型"){ price = 500; }
      else if (service === "一體式水盤機型"){ price = 500; }
      else if (service === "超長費用"){ price = 300; }
      else if (service === "水塔清洗"){
        price = hasPipe ? 800 : 1000;
        if (hasPipe && noteEl) noteEl.textContent = "已套用自來水管清洗優惠價";
      }
      priceEl.value = price;
    }

    const subtotal = qty * (Number(priceEl?.value || price) || 0);
    if (subEl) subEl.textContent = String(subtotal);
    total += subtotal;

    // 類別標籤與小計累計
    updateRowCategoryTag(tr);
    const catLabel = getServiceCategoryLabel(tr.querySelector('.service'));
    if (catLabel){
      if (!categoryTotals[catLabel]) categoryTotals[catLabel] = { amount: 0, count: 0 };
      categoryTotals[catLabel].amount += subtotal;
      if (subtotal > 0) categoryTotals[catLabel].count += 1;
    }
  });

  // 更新類別小計區塊
  window.__categoryTotals = categoryTotals;
  try{
    const box = qs('#categoryTotals');
    if (box){
      const entries = Object.entries(categoryTotals).filter(([_, v])=> (v.amount||0) > 0);
      if (!entries.length){
        box.innerHTML = '';
        box.classList.add('d-none');
      }else{
        box.classList.remove('d-none');
        const rows = entries.map(([label, info])=> 
          `<div class="d-flex justify-content-between"><span>${label}</span><span>NT$ ${info.amount}（${info.count} 項）</span></div>`
        ).join('');
        box.innerHTML = `
          <div class="card bg-light border-0">
            <div class="card-body py-2">
              <div class="small fw-semibold mb-1">類別小計</div>
              <div class="small d-flex flex-column gap-1">
                ${rows}
              </div>
            </div>
          </div>`;
      }
    }
  }catch(_){}

  // 未稅總計
  // Dynamic totals rendering (no static #total/#totalWithTax banners)
  const totalWithTax = Math.round(total * 1.05);
  const showTax = qs("#toggleTax")?.checked === true;
  (function(){
    const container = qs("#totalContainer");
    if (container) {
      container.innerHTML = showTax
        ? `<h5 class="mt-2 total-banner text-success">含稅 (5%)：<span id="totalWithTax">${totalWithTax}</span> 元</h5>`
        : `<h5 class="mt-3 total-banner">合計：<span id="total">${total}</span> 元</h5>`;
    }
  })();

  // Mobile footer number & tag
  setText(qs("#totalMobile"), showTax ? totalWithTax : total);
  { const tag = qs("#totalMobileTag"); if (tag) tag.classList.toggle("d-none", !showTax); }

  // 手機底部合計：若開啟含稅，就顯示含稅；否則顯示未稅
  setText(qs("#totalMobile"), showTax ? totalWithTax : total);

  // 同步更新摘要卡
  try{ updateSummaryCard(); }catch(_){}
}

function applyMobileLabels(){
  const labels = Array.from(qsa('#quoteTable thead th')).map(th => th.textContent.trim());
  qsa('#quoteTable tbody tr').forEach(tr=>{
    Array.from(tr.children).forEach((td, i)=> td.setAttribute('data-label', labels[i] || '') );
  });
}
qs("#quoteTable tbody")?.addEventListener("change", (e)=>{
  const t = e.target;
  if(t.classList.contains("service") || t.classList.contains("option") || t.classList.contains("qty")){
    const rowPrice = t.closest("tr").querySelector(".price");
    if(rowPrice && rowPrice.dataset.override) delete rowPrice.dataset.override;
    updateTotals();
  }
});
qs("#quoteTable tbody")?.addEventListener("input", (e)=>{
  const t = e.target;
  if(t.classList.contains("price")){ t.dataset.override = "true"; updateTotals(); }
  else if(t.classList.contains("qty")){ updateTotals(); }
});
qs("#addRow")?.addEventListener("click", ()=>{
  const tbody = qs("#quoteTable tbody");
  const tr = document.createElement("tr");
  tr.innerHTML = `
        <td>
      <select class="form-select service">
        <option value="">請選擇服務項目</option>
        <optgroup label="空調清洗">
          <option value="冷氣清洗">冷氣清洗</option>
        </optgroup>
        <optgroup label="家電清洗">
          <option value="洗衣機清洗">洗衣機清洗</option>
        </optgroup>
        <optgroup label="其他清洗">
          <option value="自來水管清洗">自來水管清洗</option>
          <option value="水塔清洗">水塔清洗</option>
        </optgroup>
        <optgroup label="加值服務">
          <option value="防霉處理">防霉處理</option>
          <option value="臭氧殺菌">臭氧殺菌</option>
        </optgroup>
        <optgroup label="加價項目">
          <option value="變形金剛機型">變形金剛機型</option>
          <option value="一體式水盤機型">一體式水盤機型</option>
          <option value="超長費用">超長費用</option>
        </optgroup>
      </select>
    </td>
        <td>
      <select class="form-select option">
        <option value="">請選擇規格 / 坪數</option>
        <optgroup label="機型 / 規格">
          <option>分離式（壁掛式）</option>
          <option>吊隱式（隱藏式）</option>
          <option>直立式</option>
          <option>家用</option>
        </optgroup>
        <optgroup label="優惠 / 加值">
          <option>特殊機型額外加收費</option>
          <option>冷氣防霉處理（抑菌噴劑）</option>
          <option>高臭氧殺菌30分鐘</option>
          <option>加購價</option>
        </optgroup>
        <optgroup label="坪數 / 衛浴數">
          <option>無廚一衛</option>
          <option>一廚一衛</option>
          <option>一廚兩衛</option>
          <option>一廚三衛</option>
          <option>一廚四衛</option>
        </optgroup>
      </select>
    </td>
    </td>
    <td><input type="number" class="form-control qty" value="1" min="1" /></td>
    <td><input type="number" class="form-control price" value="0" /><small class="discount-note"></small></td>
    <td class="subtotal">0</td>
    <td><button class="btn btn-danger btn-sm removeRow">刪除</button></td>`;
  tbody.appendChild(tr);
  updateTotals(); applyMobileLabels();
});
qs("#quoteTable tbody")?.addEventListener("click",(e)=>{
  const t = e.target;
  if(t.classList.contains("removeRow")){
    t.closest("tr").remove();
    updateTotals(); applyMobileLabels();
  }
});

/* =====================
   本機保險（舊 #data 連結）
===================== */
function markLocallyLocked(key){ try{ localStorage.setItem(key, "1"); }catch(_){} }
function isLocallyLocked(key){ try{ return localStorage.getItem(key)==="1"; }catch(_){ return false; } }

/* =====================
   送出「我同意此報價」
===================== */
async function handleConfirmSubmit(clickedBtn){
  if (clickedBtn && clickedBtn.disabled) return;
  const originalText = clickedBtn ? clickedBtn.textContent : "";
  try{
    if (clickedBtn){ clickedBtn.disabled = true; clickedBtn.textContent = "送出中…"; }

    let payload = collectShareData(); if (typeof window.__augmentPayloadWithPromo==='function') payload = window.__augmentPayloadWithPromo(payload);
    let cid = null;
    const hash = location.hash || "";
    const cidFromHash = hash.startsWith("#cid=") ? decodeURIComponent(hash.replace("#cid=","")) : "";
    if (cidFromHash) { cid = cidFromHash; payload.cloudinaryId = cid; }

    const res = await fetch("/api/confirm", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    if(!res.ok){
      const t = await res.text(); alert("送出失敗：" + t);
      if (clickedBtn){ clickedBtn.disabled = false; clickedBtn.textContent = originalText; }
      return;
    }
    await res.json();

    
      window.__confirmModalShow && window.__confirmModalShow(`✅ 感謝您的確認，我們明日見囉！😊

為確保清洗順利進行，煩請提前清出冷氣室內機下方空間，以便擺放 A 字梯。

若下方為以下家具，將由現場人員視情況協助判斷是否可移動，敬請見諒：
・大型衣櫃、書櫃等重物
・無法移動之床或沙發
・其他無法暫移之家具

如有異動也歡迎提前與我們聯繫，謝謝您配合！

— 自然大叔 敬上`);
    

    if (cid) {
      try{
        await fetch("/api/lock", {
          method:"POST", headers:{ "Content-Type":"application/json" },
          body: JSON.stringify({ id: cid })
        });
      }catch(_){}
      setTimeout(()=>{ location.href = location.pathname + "#cid=" + encodeURIComponent(cid); location.reload(); }, 300);
      markLocallyLocked("locked:cid:"+cid);
    } else if (hash.startsWith("#data=")) {
      markLocallyLocked("locked:data:"+hash);
      const btn = qs("#confirmBtnDesktop");
      if (btn){ btn.textContent = "已送出同意"; btn.disabled = true; }
    }

  }catch(err){
    console.error(err);
    alert("送出失敗，請稍後再試。");
    if (clickedBtn){ clickedBtn.disabled = false; clickedBtn.textContent = originalText; }
  }
}
qs('#confirmBtnDesktop')?.addEventListener('click', function(){ handleConfirmSubmit(this); });
qs('#confirmBtnMobile')?.addEventListener('click', function(){ handleConfirmSubmit(this); });

/* =====================
   產生分享連結
===================== */
async function handleShareClick(){
  let clickedBtn = (document.activeElement && (document.activeElement.id==='shareLinkBtn' || document.activeElement.id==='shareLinkBtnMobile')) ? document.activeElement : null;
  const originalText = clickedBtn ? clickedBtn.textContent : '';
  if (clickedBtn) { clickedBtn.disabled = true; clickedBtn.textContent = '產生中…'; }
  try{
    let payload = collectShareData(); if (typeof window.__augmentPayloadWithPromo === 'function') payload = window.__augmentPayloadWithPromo(payload);
    // timeout 15s with AbortController
    const ac = new AbortController();
    const to = setTimeout(()=>ac.abort(), 15000);
    const res = await fetch("/api/share", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      signal: ac.signal
    });
    clearTimeout(to);
    if(!res.ok){ const t = await res.text().catch(()=> ''); alert("產生連結失敗：" + (t||("HTTP "+res.status))); return; }
    const raw = await res.text();
    let data; try{ data = JSON.parse(raw); }catch(_){ data = {}; }
    const href = data.share_url || data.pdf_url || "#";
    
    // Append tax preference as query param to the share link
    try {
      const taxOn = qs('#toggleTax')?.checked === true;
      const urlObj = new URL(href, location.href);
      urlObj.searchParams.set('tax', taxOn ? '1' : '0');
      var hrefWithTax = urlObj.toString();
    } catch(_) { var hrefWithTax = href; }
    const box = qs("#shareLinkBox");
    removeClass(box, "d-none");
    box.innerHTML = `
      <div class="mb-1 fw-bold">專屬報價單網址</div>
      <div class="input-group">
        <input type="text" class="form-control" id="shareLinkInput" value="${hrefWithTax}" readonly>
        <button class="btn btn-primary" id="copyLinkBtn" type="button">📋 一鍵複製</button>
      </div>
      <div class="mt-2"><a href="${hrefWithTax}" target="_blank">${hrefWithTax}</a></div>`;
    qs('#copyLinkBtn')?.addEventListener('click', async ()=>{
      const link = qs('#shareLinkInput')?.value || hrefWithTax;
      try{
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(link);
        else { const ta=document.createElement('textarea'); ta.value=link; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
        const el=qs('#copyLinkBtn'); const orig=el.textContent; el.textContent="✅ 已複製"; setTimeout(()=> el.textContent=orig,1500);
      }catch(_){ alert("複製失敗，請手動選取複製"); }
    });
  }catch(err){ console.error(err); alert("產生連結失敗，請稍後再試。"); }
  finally { if (clickedBtn){ clickedBtn.disabled=false; clickedBtn.textContent=originalText||'產生連結'; } }

}
qs("#shareLinkBtn")?.addEventListener("click", handleShareClick);
qs('#shareLinkBtnMobile')?.addEventListener('click', handleShareClick);

/* =====================
   序列化
===================== */
function collectShareData(){
  const items = [];
  qsa("#quoteTable tbody tr").forEach(tr=>{
    items.push({
      service: tr.querySelector(".service")?.value || "",
      option:  tr.querySelector(".option")?.value  || "",
      qty:     tr.querySelector(".qty")?.value     || "1",
      price:   tr.querySelector(".price")?.value   || "0",
      subtotal:tr.querySelector(".subtotal")?.textContent || "0",
      overridden: tr.querySelector(".price")?.dataset.override === "true"
    });
  });
  return {
    quoteInfo: qs("#quoteInfo").textContent.replace(/\s+/g,' ').trim(),
    customer:  qs("#customerName").value,
    phone:     qs("#customerPhone").value,
    address:   qs("#customerAddress").value,
    technician:qs("#technicianName").value,
    techPhone: qs("#technicianPhone").value,
    cleanTime: qs("#cleanFull").textContent,
    otherNotes:qs("#otherNotes").value,
    items, total: (function(){ try{ let sum=0; qsa("#quoteTable tbody tr").forEach(tr=>{ const v=parseInt(tr.querySelector(".subtotal")?.textContent||"0",10); sum+=isNaN(v)?0:v; }); return String(sum);}catch(_){return "0";} })()
  };
}

/* =====================
   可見性（考慮取消狀態）
===================== */
function setReadonlyButtonsVisibility(canConfirm){
  const admin = isAdmin();
  const cancelled = !!window.__QUOTE_CANCELLED__;
  const effectiveConfirm = canConfirm && !cancelled;

  const shareDesk = qs("#shareLinkBtn"); if (shareDesk) shareDesk.style.display = "none";
  const shareM   = qs("#shareLinkBtnMobile"); if (shareM) shareM.style.display = "none";

  const ro = qs("#readonlyActions");
  if (ro) ro.classList.toggle("d-none", !(effectiveConfirm || admin));

  // 確認按鈕永遠不在 cancelled 顯示
  const mConfirm = qs("#confirmBtnMobile");
  const dConfirm = qs("#confirmBtnDesktop");
  if (mConfirm) mConfirm.classList.toggle("d-none", !effectiveConfirm);
  if (dConfirm) dConfirm.classList.toggle("d-none", !effectiveConfirm);
}

/* =====================
   套用唯讀資料
===================== */
function applyReadOnlyData(data){
  if(data.quoteInfo){
    const qi = qs("#quoteInfo");
    const m = data.quoteInfo.match(/承辦項目：([^｜\s]+).*?報價日期：(\d{4}\/\d{2}\/\d{2})/);
    qi.innerHTML = m ? `<span class="qi-proj">承辦項目：${m[1]}</span><span class="qi-sep"> ｜ </span><span class="qi-date">報價日期：${m[2]}</span>` : data.quoteInfo;
  }
  qs("#customerName").value   = data.customer  || "";
  qs("#customerPhone").value  = data.phone     || "";
  qs("#customerAddress").value= data.address   || "";
  qs("#technicianName").value = data.technician|| "";
  qs("#technicianPhone").value= data.techPhone || "";
  (function(){
    const cf = qs("#cleanFull");
    const s = data.cleanTime || "尚未選擇";
    const m = s.match(/^(\d{4}\/\d{2}\/\d{2}（[^）]+）)\s*(上午|下午)?\s*([0-2]\d:[0-5]\d)/);
    if (m) {
      const datePart = m[1];
      let [hour, minute] = m[3].split(":").map(Number);
      let displayHour = hour % 12 || 12;
      let displayTime = `${displayHour}:${String(minute).padStart(2, "0")}`;
      const timePart = `${m[2] ? m[2] + ' ' : ''}${displayTime} 開始`;
      cf.innerHTML = `<span class="cf-date">${datePart}</span><span class="cf-time">${timePart}</span>`;
    } else {
      cf.textContent = s;
    }
  })();
  (function(){
    const row = document.querySelector('#cleanFullBox .row');
    if (row) row.style.display = 'none';
    const cd = qs('#cleanDate'); const ct = qs('#cleanTime');
    if (cd) cd.style.display = 'none';
    if (ct) ct.style.display = 'none';
  })();
  qs("#otherNotes").value     = data.otherNotes|| "";
  const tbody = qs("#quoteTable tbody"); tbody.innerHTML = "";

  // ✅ 修正版：保留 data-override 與自訂單價顯示
  (data.items || []).forEach(it=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><select class="form-select service" disabled><option>${it.service||""}</option></select></td>
      <td><select class="form-select option" disabled><option>${it.option||""}</option></select></td>
      <td><input type="number" class="form-control qty" value="${it.qty||1}" readonly /></td>
      <td>
        <input type="number" class="form-control price" value="${it.price||0}" 
               ${it.overridden ? 'data-override="true"' : ''} readonly />
        ${it.overridden ? '<small class="text-warning ms-1">(自訂單價)</small>' : '<small class="discount-note"></small>'}
      </td>
      <td class="subtotal">${it.subtotal||0}</td>
      <td></td>`;
    tbody.appendChild(tr);
  });

  qsa("input, textarea").forEach(el=>el.setAttribute("readonly", true));
  qsa("select").forEach(el=>el.setAttribute("disabled", true));
  ["addRow","shareLinkBtn","shareLinkBtnMobile"].forEach(id=>{ const el = qs("#"+id); if(el) el.style.display="none"; });
  updateTotals();
}

/* =====================
   取消狀態（含 payload.resource）
===================== */
function extractResource(p){
  if (!p) return null;
  if (p.resource) return p.resource;
  return p;
}
function applyCancelStatus(payload){
  try{
    const resource = extractResource(payload);
    let cancelled = false;
    if (resource?.resource_type === "raw") {
      const tags = resource?.tags || [];
      if (Array.isArray(tags) && tags.includes("cancelled")) cancelled = true;
    } else {
      const status = resource?.context?.custom?.status;
      if (status === "cancelled") cancelled = true;
    }
    window.__QUOTE_CANCELLED__ = cancelled;

    if (cancelled) {
      const banner = qs("#cancelBanner");
      if (banner) {
        removeClass(banner, "d-none");
        const reason = resource?.context?.custom?.cancel_reason || "";
        const time = resource?.context?.custom?.cancel_time || "";
        
      window.QUOTE_STATUS = 'cancelled'; window.QUOTE_REASON = reason; window.QUOTE_CANCEL_TIME = time;banner.textContent = `⚠️ 本報價單已作廢${time ? `（${new Date(time).toLocaleString()}）` : ""}${reason ? `，原因：${reason}` : ""}`;
      try{ if (typeof window.__cancelModalShow === 'function') window.__cancelModalShow(); }catch(_){/*noop*/}
    }
      // 無論是否 admin，都隱藏「我同意」
      addClass(qs("#confirmBtnDesktop"), "d-none");
      addClass(qs("#confirmBtnMobile"), "d-none");
    }
  }catch(e){ console.warn("applyCancelStatus error:", e); }
}

/* =====================
   顯示/綁定取消按鈕（admin）
===================== */
function setupCancelButtonsVisibility(payload){
  const resource = extractResource(payload);
  const isCancelled =
    (resource?.resource_type === 'raw' && Array.isArray(resource?.tags) && resource.tags.includes('cancelled')) ||
    (resource?.context?.custom?.status === 'cancelled');
  const show = !isCancelled; // always show unless already cancelled

  console.debug('[quote] cancel visibility', {admin:isAdmin(), want: wantShowCancel(), isCancelled});
  toggle(qs('#cancelBtnDesktop'), show);
  toggle(qs('#cancelBtnMobile'), show);

  if (show){
    if (!qs('#cancelBtnDesktop')?.dataset.bound){
      qs('#cancelBtnDesktop')?.addEventListener('click', async ()=>{ const ans = await askCancelReason(); if(!ans) return; const {reason, lock} = ans; callCancel(reason, lock); });
      if (qs('#cancelBtnDesktop')) qs('#cancelBtnDesktop').dataset.bound = '1';
    }
    if (!qs('#cancelBtnMobile')?.dataset.bound){
      qs('#cancelBtnMobile')?.addEventListener('click', async ()=>{ const ans = await askCancelReason(); if(!ans) return; const {reason, lock} = ans; callCancel(reason, lock); });
      if (qs('#cancelBtnMobile')) qs('#cancelBtnMobile').dataset.bound = '1';
    }
  }
}

/* =====================
   付款：顯示/隱藏 + 一鍵複製（代理）
===================== */
document.addEventListener('click', function(e){
  const t = e.target;
  if (!t) return;
  if (t.id === 'toggleAccountBtn'){
    const box = qs('#bankBox');
    if (!box) return;
    box.classList.toggle('d-none');
    t.textContent = box.classList.contains('d-none') ? '查看匯款資訊' : '🙈 隱藏匯款資訊';
    if (!box.classList.contains('d-none')){
      try{ box.scrollIntoView({behavior:'smooth', block:'center'}); }catch(_){}
    }
  }
  if (t.id === 'copyAccountBtn'){
    const acct = qs('#bankAccount');
    if (!acct) return;
    try{
      navigator.clipboard.writeText(((acct.value.match(/\d+/g)||[]).join(''))).then(function(){
        const orig = t.textContent;
        t.textContent = '✅ 已複製';
        setTimeout(function(){ t.textContent = orig; }, 1200);
      });
    }catch(_){}
  }
});

/* =====================
   初始：若 admin，預先顯示取消鈕與唯讀動作區（避免晚一步載入）
===================== */
document.addEventListener('DOMContentLoaded', function(){
  // Initialize tax mode from URL (?tax=1 or ?tax=0)
  (function(){
    try {
      const taxParam = getParam('tax');
      const toggle = qs('#toggleTax');
      const group  = toggle?.closest('.form-check') || qs('#taxToggleGroup');
      if (taxParam === '1') {
        if (toggle) toggle.checked = true;
        if (group) group.classList.remove('d-none');
      } else if (taxParam === '0') {
        if (toggle) toggle.checked = false;
        if (group) group.classList.add('d-none');
      }
      if (typeof updateTotals === 'function') updateTotals();
    } catch(_) {}
  })();

  removeClass(qs('#readonlyActions'), 'd-none');
  removeClass(qs('#cancelBtnDesktop'), 'd-none');
  removeClass(qs('#cancelBtnMobile'), 'd-none');
});

/* =====================
   載入（view）
===================== */
(async function loadReadOnlyIfHash(){
  const cidQ = getCid();

  if (cidQ) {
    if (isLocallyLocked("locked:cid:"+cidQ)) { 
      addClass(qs("#confirmBtnDesktop"), "d-none");
      addClass(qs("#confirmBtnMobile"), "d-none");
    }
    try{
      const r = await fetch(`/.netlify/functions/view?id=${encodeURIComponent(cidQ)}&ts=${Date.now()}`, { cache:"no-store" });
      if(!r.ok) throw new Error(await r.text());
      const payload = await r.json();
      const data = payload?.data || {};
      const locked = !!payload?.locked;
      window.QUOTE_LOCKED = locked;

      applyCancelStatus(payload);
      setupCancelButtonsVisibility(payload);
      
  // ChatGPT Patch: hide mobile action bar on cancelled or confirmed & archived (locked)
  try{
    const res = extractResource(payload) || {};
    const ctx = (res.context && res.context.custom) || {};
    const isCancelled = (Array.isArray(res.tags) && res.tags.includes('cancelled')) || (ctx.status === 'cancelled');
    const isLocked = (ctx.locked === '1' || ctx.locked === 1 || payload.locked === true);
    setMobileBottomBar(!(isCancelled || isLocked));
  }catch(_){ /* ignore */ }
applyReadOnlyData(data); 
      if (data && data.promo && typeof window.__applyPromoFromData==='function') { window.__applyPromoFromData(data.promo); }
      applyMobileLabels();
      setReadonlyButtonsVisibility(!locked);

      if (locked){
        const notice = document.createElement('div');
        notice.className = 'alert alert-success mt-2';
        notice.innerHTML = '此報價單已<span class="fw-bold">完成確認並封存</span>，僅供查看。';
        qs('.container-quote').prepend(notice);
        addClass(qs("#confirmBtnDesktop"), "d-none");
        addClass(qs("#confirmBtnMobile"), "d-none");
        if (!isAdmin()) addClass(qs("#readonlyActions"), "d-none");
        window.QUOTE_STATUS = (window.__QUOTE_CANCELLED__ ? 'cancelled' : 'confirmed');
        window.QUOTE_CONFIRMED = !window.__QUOTE_CANCELLED__;
        if (!window.__QUOTE_CANCELLED__ && typeof window.__confirmModalShow === 'function') window.__confirmModalShow(window.QUOTE_REASON || '');
    }
      return;
    }catch(e){
      console.error("讀取分享資料失敗：", e);
      alert("此連結已失效或資料讀取失敗。");
      forceReadOnlyBlank();
      addClass(qs("#confirmBtnDesktop"), "d-none");
      addClass(qs("#confirmBtnMobile"), "d-none");
      if (!isAdmin()) addClass(qs("#readonlyActions"), "d-none");
      return;
    }
  }

  const hash = location.hash || "";
  if (hash.startsWith("#data=")) {
    try{
      const data = JSON.parse(decodeURIComponent(hash.replace("#data=","")));
      applyReadOnlyData(data); applyMobileLabels();
      if (isLocallyLocked("locked:data:"+hash)) { 
        addClass(qs("#confirmBtnDesktop"), "d-none");
        addClass(qs("#confirmBtnMobile"), "d-none");
        if (!isAdmin()) addClass(qs("#readonlyActions"), "d-none");
        const notice = document.createElement('div');
        notice.className = 'alert alert-success mt-2';
        notice.innerHTML = '此報價單已<span class="fw-bold">完成確認並封存</span>，僅供查看。';
        qs('.container-quote').prepend(notice);
      } else { 
        setReadonlyButtonsVisibility(true); 
      }
      return;
    }catch(err){ 
      console.error("讀取分享資料失敗：", err); 
      updateTotals(); applyMobileLabels(); 
      return; 
    }
  }

  // 無 cid：編輯模式
  updateTotals(); applyMobileLabels();
  try{ setMobileBottomBar(true); }catch(_){}
})();


// ========== 補上取消動作（ChatGPT Patch） ==========
async function callCancel(reason, lock) {
  const id = getCid();
  if (!id) {
    alert("找不到報價單 ID，無法作廢。");
    return;
  }
  const dBtn = qs('#cancelBtnDesktop');
  const mBtn = qs('#cancelBtnMobile');
  const origD = dBtn ? dBtn.textContent : "";
  const origM = mBtn ? mBtn.textContent : "";
  [dBtn, mBtn].forEach(b => { if (b) { b.disabled = true; b.textContent = "作廢中…"; } });

  try {
    const res = await fetch("/api/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, reason: reason || "", lock: !!lock })
    });
    let data = null;
    try { data = await res.json(); } catch(_) {}
    if (!res.ok) {
      const msg = (data && data.error) ? data.error : ("HTTP " + res.status);
      throw new Error(msg);
    }

    const banner = qs('#cancelBanner');
    if (banner) {
      const when = (data && (data.cancelledAt || data.updatedAt)) || Date.now();
      const timeStr = new Date(when).toLocaleString();
      banner.classList.remove('d-none');
      banner.textContent = `⚠️ 本報價單已作廢（${timeStr}）${reason ? `，原因：${reason}` : ""}`;
    }
    window.__QUOTE_CANCELLED__ = true;
    if (dBtn) dBtn.classList.add('d-none');
    if (mBtn) mBtn.classList.add('d-none');
    niceAlert('已作廢。');
  } catch (err) {
    console.error("取消/作廢失敗：", err);
    alert("作廢失敗：" + (err.message || err));
    if (dBtn) dBtn.textContent = origD;
    if (mBtn) mBtn.textContent = origM;
    [dBtn, mBtn].forEach(b => { if (b) b.disabled = false; });
    return;
  }
}
// ========== End Patch ==========

document.addEventListener('DOMContentLoaded', function(){
  // Initialize tax mode from URL (?tax=1 or ?tax=0)
  (function(){
    try {
      const taxParam = getParam('tax');
      const toggle = qs('#toggleTax');
      const group  = toggle?.closest('.form-check') || qs('#taxToggleGroup');
      if (taxParam === '1') {
        if (toggle) toggle.checked = true;
        if (group) group.classList.remove('d-none');
      } else if (taxParam === '0') {
        if (toggle) toggle.checked = false;
        if (group) group.classList.add('d-none');
      }
      if (typeof updateTotals === 'function') updateTotals();
    } catch(_) {}
  })();

  if (window.__QUOTE_CANCELLED__) {
    showCancelledUI(window.__QUOTE_CANCEL_REASON__ || '', window.__QUOTE_CANCEL_TIME__ || '');
    alertCancelledOnce();
  }
});




// === Cancellation Warning Modal (debuggable & overrideable) ===
(function(){
  function log(...args){ try{ console.debug('[CancelModal]', ...args); }catch(e){} }

  function normalize(v){ return (v==null?'':String(v)).trim().toLowerCase(); }

  function isCancelledWord(s){
    s = normalize(s);
    // common zh/eng variants (exact match)
    const WORDS = new Set(['cancelled','canceled','void','voided','作廢','已作廢','取消','已取消','作廢單','作廢中']);
    // also accept wrapped variants like 「已作廢」 with punctuation or spaces
    const cleaned = s.replace(/[\s\u3000\uFF08\uFF09\(\)\[\]【】「」『』]/g,'');
    if (WORDS.has(s) || WORDS.has(cleaned)) return true;
    return false;
  }

  function getQuoteId(){
    try { if (window.quote && (window.quote.id || window.quote.qid || window.quote.uuid)) return String(window.quote.id || window.quote.qid || window.quote.uuid); } catch(e){}
    const metaId = document.querySelector('meta[name="quote:id"]');
    if (metaId && metaId.content) return metaId.content;
    try { const u = new URL(window.location.href); return u.searchParams.get('qid') || u.searchParams.get('quote_id') || u.searchParams.get('id') || null; } catch(e){}
    return null;
  }

  function getCancelReason(){
    try { if (window.quote && (window.quote.cancel_reason || window.quote.reason)) return String(window.quote.cancel_reason || window.quote.reason); } catch(e){}
    if (typeof window.QUOTE_REASON !== 'undefined') return String(window.QUOTE_REASON);
    const meta = document.querySelector('meta[name="quote:reason"]');
    if (meta && meta.content) return meta.content;
    return null;
  }

  function getExplicitStatus(){
    try { if (window.quote && (window.quote.status || window.quote.state)) return normalize(window.quote.status || window.quote.state); } catch(e){}
    if (typeof window.QUOTE_STATUS !== 'undefined') return normalize(window.QUOTE_STATUS);
    const b = document.body;
    if (b){
      const bodyStatus = b.dataset.quoteStatus || b.dataset.status;
      if (bodyStatus) return normalize(bodyStatus);
    }
    const meta = document.querySelector('meta[name="quote:status"]');
    if (meta && meta.content) return normalize(meta.content);
    try { const u = new URL(window.location.href); const qs = u.searchParams.get('status'); if (qs) return normalize(qs); } catch(e){}
    return '';
  }

  function getBooleanFlags(){
    try {
      if (window.quote && (typeof window.quote.cancelled !== 'undefined' || typeof window.quote.canceled !== 'undefined' || typeof window.quote.is_cancelled !== 'undefined')){
        return Boolean(window.quote.cancelled || window.quote.canceled || window.quote.is_cancelled);
      }
    } catch(e){}
    if (typeof window.QUOTE_CANCELLED !== 'undefined') return Boolean(window.QUOTE_CANCELLED);
    const b = document.body;
    if (b){
      if (b.dataset.cancelled === 'true' || b.dataset.canceled === 'true') return true;
      if (b.classList && (b.classList.contains('is-cancelled') || b.classList.contains('cancelled'))) return true;
    }
    const meta = document.querySelector('meta[name="quote:cancelled"]');
    if (meta && normalize(meta.content) === 'true') return true;
    try {
      const u = new URL(window.location.href);
      const qp = (u.searchParams.get('cancelled') || u.searchParams.get('canceled') || u.searchParams.get('void') || '').toLowerCase();
      if (qp === '1' || qp === 'true' || qp === 'yes') return true;
    } catch(e){}
    return false;
  }

  // Manual overrides for testing / fallback
  function hasManualOverride(){
    try {
      if (window.__FORCE_CANCEL_MODAL__ === true) return true;
      const b = document.body;
      if (b && b.dataset.showCancelModal === 'true') return true;
      const u = new URL(window.location.href);
      if (u.searchParams.get('show_cancel_modal') === '1') return true;
    } catch(e){}
    return false;
  }

  function detectCancelled(){
    if (hasManualOverride()) return true;
    if (getBooleanFlags()) return true;
    const s = getExplicitStatus();
    if (isCancelledWord(s)) return true;
    return false;
  }

  function alreadyShownForThisQuote(){
    const id = getQuoteId() || 'default';
    const key = 'cancelModalShown:' + id;
    if (sessionStorage.getItem(key)) return true;
    sessionStorage.setItem(key, '1');
    return false;
  }

  function showCancellationModal(){
    const backdrop = document.createElement('div');
    backdrop.className = 'cancel-modal-backdrop';
    const reason = getCancelReason();
    backdrop.innerHTML = `
      <div class="cancel-modal" role="dialog" aria-modal="true" aria-labelledby="cancel-modal-title">
        <header><span id="cancel-modal-title">⚠️ 注意</span><span class="badge">已作廢</span></header>
        <div class="body">本報價單已作廢，僅供查看用途。請勿再分享、修改或入帳使用。${reason ? ('<br><br><strong>原因：</strong>' + reason) : ''}</div>
        <div class="actions"><button class="btn primary" id="cancel-modal-ok">我知道了</button></div>
      </div>`;
    document.body.appendChild(backdrop);
    function close(){ if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); }
    document.getElementById('cancel-modal-ok').addEventListener('click', close);
    backdrop.addEventListener('click', function(e){ if (e.target === backdrop) close(); });
  }

  function diagnostics(){
    const diag = {
      quoteId: getQuoteId(),
      explicitStatus: getExplicitStatus(),
      booleanFlags: getBooleanFlags(),
      manualOverride: hasManualOverride(),
      reason: getCancelReason()
    };
    log('diagnostics', diag);
    return diag;
  }

  function maybeShow(){
    const d = diagnostics();
    if (!detectCancelled()) { log('not cancelled, skip'); return; }
    if (alreadyShownForThisQuote()) { log('already shown for this quote, skip'); return; }
    log('show modal');
    showCancellationModal();
  }

  // expose helper for quick test in console
  window.__cancelModalDiag = diagnostics;
  window.__cancelModalShow = function(){ sessionStorage.removeItem('cancelModalShown:' + (getQuoteId()||'default')); showCancellationModal(); };

  if (document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', maybeShow); } else { setTimeout(maybeShow, 0); }
})();
// === End Cancellation Warning Modal (debuggable & overrideable) ===

// === Confirmed Modal (archived/locked & custom thank-you, no auto-close) ===
(function(){
  // 可傳入自訂文字；若未提供則使用預設「已確認並封存」訊息
  window.__confirmModalShow = function(customText){
    const defaultText = '✅ 已確認\n此報價單已完成確認並封存，僅供查看。';
    const text = (typeof customText === 'string' && customText.trim().length > 0) ? customText : defaultText;

    const backdrop = document.createElement('div');
    backdrop.className = 'confirm-modal-backdrop';

    // 將換行轉為 <br>，保留段落
    const bodyHtml = text.replace(/\n/g, '<br/>');

    backdrop.innerHTML = [
      '<div class="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">',
        '<header><span id="confirm-modal-title">通知</span></header>',
        `<div class="body">${bodyHtml}</div>`,
        '<div class="actions">',
          '<button class="btn primary" id="confirm-modal-ok">關閉</button>',
        '</div>',
      '</div>'
    ].join('');

    document.body.appendChild(backdrop);

    function close(){ if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); }
    document.getElementById('confirm-modal-ok').addEventListener('click', close);
    // 允許點擊外層關閉；不自動關閉
    backdrop.addEventListener('click', function(e){ if (e.target === backdrop) close(); });
  };
})(); 
// === End Confirmed Modal ===

document.addEventListener('DOMContentLoaded', function(){
  // Initialize tax mode from URL (?tax=1 or ?tax=0)
  (function(){
    try {
      const taxParam = getParam('tax');
      const toggle = qs('#toggleTax');
      const group  = toggle?.closest('.form-check') || qs('#taxToggleGroup');
      if (taxParam === '1') {
        if (toggle) toggle.checked = true;
        if (group) group.classList.remove('d-none');
      } else if (taxParam === '0') {
        if (toggle) toggle.checked = false;
        if (group) group.classList.add('d-none');
      }
      if (typeof updateTotals === 'function') updateTotals();
    } catch(_) {}
  })();

  qs('#toggleTax')?.addEventListener('change', updateTotals);
});


/* =========================
   __PROMO_MODULE_V2__ 活動優惠模組（輕量注入）
========================= */
(function(){
  if (window.__promoInjected) return; window.__promoInjected = true;
  const $ = (s)=>document.querySelector(s);

  // 狀態與預設
  const state = { nameType:'none', presetKey:'none', customName:'', rules:[] };
  const PRESETS = {
    "new-year": { name: "新年換新優惠", rules: [
      {type:"threshold-flat", threshold:8000, amount:500, stack:true, cap:null},
      {type:"threshold-rate", threshold:12000, amount:5, stack:false, cap:null}
    ]},
    "anniv-5": { name: "五周年優惠活動", rules: [
      {type:"flat", amount:200, threshold:0, stack:true, cap:null},
      {type:"threshold-rate", threshold:10000, amount:10, stack:false, cap:2000}
    ]},
    "year-end": { name: "年底大掃除活動", rules: [
      {type:"threshold-flat", threshold:6000, amount:300, stack:true, cap:null},
      {type:"threshold-flat", threshold:12000, amount:700, stack:true, cap:null}
    ]}
  };

  const toInt = (v)=>{ v=Number(v); return Number.isFinite(v)?Math.max(0,Math.floor(v)):0; };
  const currentName = ()=> state.nameType==='preset' ? (PRESETS[state.presetKey]?.name || '活動優惠') : (state.nameType==='custom' ? (state.customName||'活動優惠') : '活動優惠');

  function renderSummary(discount){
    const sum=$('#promoSummary'), tot=$('#promoTotal'), n=currentName();
    const d = toInt(discount||0);
    if (sum){
      if (d>0){
        sum.textContent = `已套用「${n}」，折抵 $${d}`;
      }else{
        sum.textContent = '目前未套用優惠';
      }
    }
    if (tot) tot.textContent = (d>0 ? '- $' + d : '- $0');
  }

  function getSubtotal(){
    let total=0; document.querySelectorAll('#quoteTable tbody tr .subtotal').forEach(el=>{ total+= Number((el.textContent||'').replace(/[^\d.-]/g,''))||0; });
    return Math.max(0, Math.round(total));
  }

  function computeDiscount(subtotal, rules){
    if (!rules || subtotal<=0) return 0;
    let dsum=0;
    for (const r of rules){
      let d=0, th=toInt(r.threshold||0), amt=toInt(r.amount||0);
      if (r.type==='flat') d = amt;
      else if (r.type==='threshold-flat'){ if(subtotal>=th) d=amt; }
      else if (r.type==='threshold-rate'){ if(subtotal>=th) d=Math.round(subtotal*(amt/100)); }
      if (r.cap!=null) d = Math.min(d, toInt(r.cap));
      d = Math.max(0,d);
      dsum += d;
      if (!r.stack && d>0) break;
    }
    return Math.min(dsum, subtotal);
  }

  function bindUI(){
    const preset=$('#promoPreset'), custom=$('#promoCustomName'), addBtn=$('#btnAddPromoRule'), list=$('#promoRulesList'), tpl=$('#promoRuleTpl');
    function renderRules(){
      if(!list||!tpl) return; list.innerHTML='';
      state.rules.forEach((rule,idx)=>{
        const node = tpl.content.firstElementChild.cloneNode(true);
        const type=node.querySelector('.rule-type'), th=node.querySelector('.rule-threshold'), amt=node.querySelector('.rule-amount'), st=node.querySelector('.rule-stack'), cap=node.querySelector('.rule-cap'), rm=node.querySelector('.rule-remove');
        type.value=rule.type; if(th) th.value=rule.threshold||0; if(amt) amt.value=rule.amount||0; if(st) st.checked=!!rule.stack; if(cap) cap.value=(rule.cap??'');
        function updateLabels(){
          const thWrap = node.querySelector('.rule-field-threshold'); const lth=node.querySelector('.rule-label-threshold'); const lam=node.querySelector('.rule-label-amount');
          if (rule.type==='flat'){ if(thWrap) thWrap.style.display='none'; if(lam) lam.textContent='折多少（$）'; if(amt){ amt.placeholder='例：折 300'; amt.title='直接折抵多少金額'; } }
          else if (rule.type==='threshold-flat'){ if(thWrap) thWrap.style.display=''; if(lth) lth.textContent='滿多少（$）'; if(lam) lam.textContent='折多少（$）'; if(th){ th.placeholder='例：滿 8,000'; th.title='達到此金額門檻才會套用'; } if(amt){ amt.placeholder='例：折 500'; amt.title='達門檻後折抵多少金額'; } }
          else { if(thWrap) thWrap.style.display=''; if(lth) lth.textContent='滿多少（$）'; if(lam) lam.textContent='折數（%）'; if(th){ th.placeholder='例：滿 12,000'; th.title='達到此金額門檻才會套用'; } if(amt){ amt.placeholder='例：10 = 9折'; amt.title='折扣百分比（10 表示 10% 折扣 ≈ 9折）'; } }
        } updateLabels();
        type.addEventListener('change',()=>{ if (document.getElementById('promoCard')?.classList.contains('readonly')) return; rule.type=type.value; updateLabels(); requestTotalsUpdate(); });
        th?.addEventListener('input',()=>{ if (document.getElementById('promoCard')?.classList.contains('readonly')) return; rule.threshold=toInt(th.value); requestTotalsUpdate(); });
        amt?.addEventListener('input',()=>{ if (document.getElementById('promoCard')?.classList.contains('readonly')) return; rule.amount=toInt(amt.value); requestTotalsUpdate(); });
        st?.addEventListener('change',()=>{ if (document.getElementById('promoCard')?.classList.contains('readonly')) return; rule.stack=!!st.checked; requestTotalsUpdate(); });
        cap?.addEventListener('input',()=>{ if (document.getElementById('promoCard')?.classList.contains('readonly')) return; rule.cap=cap.value===''?null:toInt(cap.value); requestTotalsUpdate(); });
        rm?.addEventListener('click',()=>{ if (document.getElementById('promoCard')?.classList.contains('readonly')) return; state.rules.splice(idx,1); renderRules(); requestTotalsUpdate(); });
        list.appendChild(node);
      });
    }
    window.__renderPromoRules = renderRules;

    if (preset) preset.addEventListener('change',()=>{
      const v=preset.value;
      if (v==='custom'){ state.nameType='custom'; state.presetKey='none'; if(custom){ custom.style.display=''; custom.focus(); } }
      else if (v==='none'){ state.nameType='none'; state.presetKey='none'; if(custom) custom.style.display='none'; state.rules=[]; renderRules(); requestTotalsUpdate(); }
      else { state.nameType='preset'; state.presetKey=v; if(custom) custom.style.display='none'; state.rules=(PRESETS[v]?.rules||[]).map(r=>Object.assign({}, r)); renderRules(); requestTotalsUpdate(); }
    });
    if (custom) custom.addEventListener('input',()=>{ state.customName=custom.value.trim(); renderSummary(); });
    if (addBtn) addBtn.addEventListener('click',()=>{ state.rules.push({type:'flat',threshold:0,amount:0,stack:false,cap:null}); renderRules(); });
  }

  const orig = window.updateTotals;
  if (typeof window.requestTotalsUpdate !== 'function'){ let t=null; window.requestTotalsUpdate=function(){ if(t) cancelAnimationFrame(t); t=requestAnimationFrame(()=>{ if(typeof window.updateTotals==='function') window.updateTotals(); }); }; }
  window.updateTotals = function(){
    const ret = (typeof orig==='function') ? orig() : undefined;
        const subtotal = getSubtotal();
    const rules = (window.__promoData && window.__promoData.rules) ? window.__promoData.rules : state.rules;
    const discount = computeDiscount(subtotal, rules);
    renderSummary(discount);
    const after = Math.max(0, subtotal - discount);
    const showTax = document.getElementById('toggleTax')?.checked === true;
    const taxRate = 0.05;
    const tax = showTax ? Math.round(after * taxRate) : 0;
    const grand = after + tax;
    const container = document.getElementById('totalContainer');
    const d = toInt(discount||0);

    if (container){
      const rows = [];
      rows.push('<div class="d-flex justify-content-between small text-muted"><span>小計</span><span>NT$ '+ subtotal +'</span></div>');
      if (d > 0){
        rows.push('<div class="d-flex justify-content-between promo-row-total"><span>活動優惠折抵</span><strong>- $'+ d +'</strong></div>');
      } else {
        rows.push('<div class="d-flex justify-content-between small text-muted"><span>活動優惠</span><span>目前未套用</span></div>');
      }
      const totalLine = showTax
        ? '<h5 class="mt-2 total-banner text-success">含稅 (5%)：<span id="totalWithTax">'+ grand +'</span> 元</h5>'
        : '<h5 class="mt-2 total-banner">合計：<span id="total">'+ grand +'</span> 元</h5>';
      container.innerHTML = '<div class="d-flex flex-column gap-1">'+ rows.join('') + totalLine + '</div>';
    }

    // 更新手機版合計
    const mobile = document.getElementById('totalMobile');
    if (mobile) mobile.textContent = String(grand);

    // 更新摘要卡優惠提示
    try{
      const promoName = (window.__promoData && window.__promoData.displayName) || currentName();
      const tagBox = document.getElementById('summaryPromoTag');
      const nameSpan = document.getElementById('summaryPromoName');
      const amountSpan = document.getElementById('summaryPromoAmount');
      if (tagBox){
        if (d > 0){
          tagBox.classList.remove('d-none');
          if (nameSpan) nameSpan.textContent = promoName || '活動優惠';
          if (amountSpan) amountSpan.textContent = String(d);
        }else{
          tagBox.classList.add('d-none');
        }
      }
    }catch(_){}

    window.__quoteTotals = { subtotal, promoDiscount:discount, taxableBase:after, tax, grandTotal:grand };
    return window.__quoteTotals;
  };

  window.__augmentPayloadWithPromo = function(payload){
    const totals = window.__quoteTotals || {};
    payload.promo = {
      nameType: state.nameType, presetKey: state.presetKey, customName: state.customName,
      rules: state.rules,
      computed: { discount: totals.promoDiscount||0, taxableBase: totals.taxableBase||null, tax: totals.tax||null, grandTotal: totals.grandTotal||null },
      displayName: (state.nameType==='preset' ? (PRESETS[state.presetKey]?.name || '活動優惠') : (state.nameType==='custom' ? (state.customName || '活動優惠') : '活動優惠'))
    };
    return payload;
  };
  
window.__applyPromoFromData = function(p){
  try{
    if (!p) return;
    window.__promoData = p;

    // Set preset/custom selection for display
    var preset = document.getElementById('promoPreset');
    var custom = document.getElementById('promoCustomName');
    if (preset){
      if (p.nameType === 'preset' && p.presetKey){
        preset.value = p.presetKey;
        if (custom) custom.style.display = 'none';
      } else if (p.nameType === 'custom'){
        preset.value = 'custom';
        if (custom){ custom.style.display = ''; custom.value = p.customName || ''; }
      } else {
        preset.value = 'none';
        if (custom) custom.style.display = 'none';
      }
    }

    // Render rule list using saved rules (read-only)
    var list = document.getElementById('promoRulesList');
    var tpl  = document.getElementById('promoRuleTpl');
    if (list && tpl){
      list.innerHTML = '';
      (p.rules || []).forEach(function(rule){
        var node = tpl.content.firstElementChild.cloneNode(true);
        var type = node.querySelector('.rule-type');
        var th   = node.querySelector('.rule-threshold');
        var amt  = node.querySelector('.rule-amount');
        var st   = node.querySelector('.rule-stack');
        var cap  = node.querySelector('.rule-cap');
        var rm   = node.querySelector('.rule-remove');

        if (type) type.value = rule.type || 'flat';
        if (th) th.value = rule.threshold || 0;
        if (amt) amt.value = rule.amount || 0;
        if (st) st.checked = !!rule.stack;
        if (cap) cap.value = (rule.cap == null ? '' : rule.cap);

        // Make read-only
        [type, th, amt, st, cap, rm].forEach(function(el){
          if (!el) return;
          if (el.tagName === 'BUTTON') { el.disabled = true; el.style.display = 'none'; }
          else { el.disabled = true; el.readOnly = true; }
        });

        // Simple label visibility based on type
        var thWrap = node.querySelector('.rule-field-threshold');
        var lblAmt = node.querySelector('.rule-label-amount');
        if (rule.type === 'flat'){
          if (thWrap) thWrap.style.display = 'none';
          if (lblAmt) lblAmt.textContent = '折多少（$）';
        } else if (rule.type === 'threshold-flat'){
          if (thWrap) thWrap.style.display = '';
          if (lblAmt) lblAmt.textContent = '折多少（$）';
        } else {
          if (thWrap) thWrap.style.display = '';
          if (lblAmt) lblAmt.textContent = '折數（%）';
        }

        list.appendChild(node);
      });
    }

    // Update summary text with saved displayName
    var summary = document.getElementById('promoSummary');
    if (summary) summary.textContent = (p.displayName || '活動優惠') + ' - $' + (Number(p.computed?.discount || 0));

    var total = document.getElementById('promoTotal');
    if (total) total.textContent = '- $' + (Number(p.computed?.discount || 0));

    // Trigger totals recalculation using saved rules
    if (typeof requestTotalsUpdate === 'function') lockPromoReadOnly();
    requestTotalsUpdate();
  }catch(e){ console.warn('apply promo error', e); }
};


  document.addEventListener('DOMContentLoaded', ()=>{ bindUI(); renderSummary(0); });

// ---- Read-only lock for promo UI ----
function lockPromoReadOnly(){
  try{
    var card = document.getElementById('promoCard');
    if (!card) return;
    card.classList.add('readonly');
    var addBtn = document.getElementById('btnAddPromoRule');
    if (addBtn){ addBtn.disabled = true; addBtn.style.display = 'none'; }
    var preset = document.getElementById('promoPreset');
    var custom = document.getElementById('promoCustomName');
    if (preset){ preset.disabled = true; }
    if (custom){ custom.readOnly = true; custom.disabled = true; }
    (card.querySelectorAll('#promoRulesList .promo-rule .rule-type, #promoRulesList .promo-rule .rule-threshold, #promoRulesList .promo-rule .rule-amount, #promoRulesList .promo-rule .rule-stack, #promoRulesList .promo-rule .rule-cap, #promoRulesList .promo-rule .rule-remove') || [])
      .forEach(function(el){
        if (!el) return;
        if (el.tagName === 'BUTTON'){ el.disabled = true; el.style.display = 'none'; }
        else { el.disabled = true; el.readOnly = true; }
      });
  }catch(_){}
}

})();



// ===== Modal helpers (enhanced, allow typing even in read-only pages) =====
function nuOpenModal(el){ el.classList.remove('hidden'); document.documentElement.style.overflow='hidden'; }
function nuCloseModal(el){ el.classList.add('hidden'); document.documentElement.style.overflow=''; }

function askCancelReason() {
  return new Promise((resolve) => {
    const root = document.getElementById('cancel-modal');
    const ta = document.getElementById('cancel-reason');
    const lock = document.getElementById('cancel-lock');
    const presets = document.getElementById('cancel-presets');
    const btnOk = document.getElementById('cancel-submit');

    // 解除任何全域唯讀/禁用（部分頁面會把所有 input/textarea 設 readonly/disabled）
    if (ta) { ta.readOnly = false; ta.disabled = false; ta.removeAttribute('readonly'); ta.removeAttribute('disabled'); }
    if (lock) { lock.disabled = false; lock.removeAttribute('disabled'); }

    root.querySelectorAll('[data-close="1"]').forEach(el => el.onclick = () => { nuCloseModal(root); resolve(null); });

    // chips
    if (presets) presets.querySelectorAll('.nu-chip').forEach(chip => {
      chip.onclick = () => { ta.value = chip.dataset.text || ''; ta.focus(); };
    });

    // Ctrl/Cmd+Enter 送出
    if (ta) ta.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') btnOk.click();
    }, { once:false });

    // ESC 關閉
    root.addEventListener('keydown', (e) => { if (e.key === 'Escape') { nuCloseModal(root); resolve(null); } }, { once:false });

    // 送出
    btnOk.onclick = () => {
      const reason = (ta?.value || '').trim();
      const shouldLock = !!(lock && lock.checked);
      nuCloseModal(root);
      resolve({ reason, lock: shouldLock });
      setTimeout(()=>{ if(ta){ ta.value=''; } if(lock){ lock.checked=true; } }, 200);
    };

    nuOpenModal(root);
    setTimeout(()=> ta && ta.focus(), 60);
  });
}

function niceAlert(message='完成', title='完成'){
  const root = document.getElementById('nu-alert');
  if (!root) return alert(message);
  root.querySelector('#alert-title').textContent = title;
  root.querySelector('#alert-message').textContent = message;
  root.querySelectorAll('[data-close="1"]').forEach(el=> el.onclick = () => nuCloseModal(root));
  nuOpenModal(root);
}


// ===== Override window.alert to use pretty modal when available =====
(function(){
  try {
    if (typeof window !== 'undefined') {
      window.__orig_alert = window.__orig_alert || window.alert;
      window.alert = function(msg){
        try{
          if (document.getElementById('nu-alert')) {
            niceAlert(String(msg), /錯誤|失敗/i.test(String(msg)) ? '提示' : '完成');
            return;
          }
        }catch(e){}
        return window.__orig_alert(String(msg));
      };
    }
  } catch(_) {}
})();
