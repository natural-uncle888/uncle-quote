
function askCustomSurchargeName() {
  const dialog = document.getElementById("addSurchargeDialog");
  const input = document.getElementById("addSurchargeInput");
  const error = document.getElementById("addSurchargeError");
  const okBtn = document.getElementById("addSurchargeOk");
  const cancelBtn = document.getElementById("addSurchargeCancel");

  // Fallback for browsers without <dialog>
  if (!dialog || typeof dialog.showModal !== "function") {
    const name = (prompt("請輸入要新增的加價項目名稱：") || "").trim();
    return Promise.resolve(name || null);
  }

  return new Promise((resolve) => {
    const cleanup = () => {
      dialog.removeEventListener("close", onClose);
      dialog.removeEventListener("cancel", onCancel);
    };

    const onCancel = (e) => {
      // ESC cancel
      e.preventDefault();
      input.value = "";
      error.textContent = "";
      dialog.close("cancel");
    };

    const onClose = () => {
      const v = (input.value || "").trim();
      cleanup();
      if (dialog.returnValue !== "ok") return resolve(null);
      return resolve(v || null);
    };

    input.value = "";
    error.textContent = "";

    okBtn.onclick = (ev) => {
      const v = (input.value || "").trim();
      if (!v) {
        ev.preventDefault();
        error.textContent = "請輸入項目名稱。";
        input.focus();
        return;
      }
      if (v.length > 30) {
        ev.preventDefault();
        error.textContent = "項目名稱請勿超過 30 個字。";
        input.focus();
        return;
      }
      error.textContent = "";
      dialog.close("ok");
    };

    cancelBtn.onclick = () => dialog.close("cancel");

    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("close", onClose);

    dialog.showModal();
    setTimeout(() => input.focus(), 0);
  });
}


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
  try{
    if (typeof getQuoteFinalState === 'function' && getQuoteFinalState().finalized) {
      if (typeof updateMobileFinalStatus === 'function') updateMobileFinalStatus();
      return;
    }
  }catch(_){}
  const statusBox = document.querySelector('#mobileQuoteFinalStatus');
  if (statusBox) statusBox.classList.add('d-none');
  bar.classList.remove('is-finalized', 'is-confirmed', 'is-cancelled', 'is-locked');
  // 以行為為主：show=false → 移除；show=true → 顯示（仍受 CSS @media 控制）
  bar.style.display = show ? '' : 'none';
  bar.classList.toggle('d-none', !show);
  if (!show) {
    ['#shareLinkBtnMobile', '#cancelBtnMobile', '#confirmBtnMobile'].forEach(function(sel){
      var btn = document.querySelector(sel);
      if (btn) {
        btn.classList.add('d-none');
        btn.disabled = true;
        btn.setAttribute('aria-disabled', 'true');
      }
    });
  }
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
   服務地址：多欄位（可新增 / 刪除 / 排序）
   - UI：#addressList + #addAddressBtn + #clearAddressesBtn
   - Hidden：#customerAddress（以換行分隔，維持既有序列化相容）
   - Hidden：#customerAddressSlots（每行對應一個地址的排程）
     - 舊版：僅存時間，例如 "09:00"
     - 新版：支援同一地址多筆日期/時間，格式：
         "2026-03-03@09:00|2026-03-10@13:00"
       若日期為空（或省略），則視為沿用 #cleanDate 的預設日期
===================== */
function parseAddressText(raw){
  const s = String(raw == null ? "" : raw);
  return s.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
}
function addressesToText(list){
  return (Array.isArray(list) ? list : []).map(v=>String(v||"").trim()).filter(Boolean).join("\n");
}

// 舊版時段代碼相容：AM/PM/EV → 代表性起始時間
function legacySlotToTime(v){
  const s = String(v || "").trim();
  if (s === "AM") return "09:00";
  if (s === "PM") return "13:00";
  if (s === "EV") return "18:00";
  // 正規化 9:00 → 09:00（避免某些行動裝置 time input 顯示/回填不一致）
  const m = s.match(/^\s*(\d{1,2})\s*:\s*(\d{2})\s*$/);
  if (m){
    const hh = String(parseInt(m[1], 10)).padStart(2,'0');
    return `${hh}:${m[2]}`;
  }
  return s;
}
function timeWithPeriod(t){
  const raw = String(t || "").trim();
  if (!raw) return "";
  const m = raw.match(/^\s*(\d{1,2})\s*:\s*(\d{2})\s*$/);
  if (!m) return raw;
  const h = parseInt(m[1], 10);
  const mm = m[2];
  const hh = String(h).padStart(2,'0');
  const period = (h < 12) ? "上午" : (h < 18 ? "下午" : "晚上");
  return `${period} ${hh}:${mm}`;
}

function getDefaultCleanDate(){
  try{ return String(qs("#cleanDate")?.value || "").trim(); }catch(_){ return ""; }
}

// slots 編碼/解碼：支援多筆日期/時間
function decodeScheduleLine(line){
  const raw = String(line || "").trim();
  if (!raw) return [{ date:"", time:"" }];

  // 新版：含 | 或 @
  if (raw.includes("|") || raw.includes("@")){
    const parts = raw.split("|").map(s=>String(s||"").trim()).filter(v=>v!=="");
    const out = [];
    parts.forEach(p=>{
      if (p.includes("@")){
        const idx = p.indexOf("@");
        const d = String(p.slice(0, idx) || "").trim();
        const t = String(p.slice(idx+1) || "").trim();
        out.push({ date: d, time: legacySlotToTime(t) });
      } else {
        out.push({ date:"", time: legacySlotToTime(p) });
      }
    });
    return out.length ? out : [{ date:"", time:"" }];
  }

  // 舊版：時間
  return [{ date:"", time: legacySlotToTime(raw) }];
}
function encodeSchedules(schedules){
  const list = Array.isArray(schedules) ? schedules : [];
  const dv = getDefaultCleanDate();
  const normalized = (list.length ? list : [{date:"", time:""}]).map(sc=>{
    const d = String(sc?.date || "").trim();
    const t = legacySlotToTime(String(sc?.time || "").trim());
    // 若日期等於預設日期 → 省略日期（沿用 cleanDate）
    const dOut = (d && dv && d === dv) ? "" : d;
    return { date: dOut, time: t };
  });

  // 移除完全空白但保留至少一筆
  const nonEmpty = normalized.filter(x => (x.date || x.time));
  const final = nonEmpty.length ? nonEmpty : [{date:"", time:""}];

  // 只有 1 筆且沒有日期 → 盡量沿用舊版格式（僅時間）
  if (final.length === 1 && !final[0].date){
    return final[0].time || "";
  }

  return final.map(x => `${x.date||""}@${x.time||""}`).join("|");
}

function updateSchedulePeriod(srow){
  try{
    if (!srow) return;
    const input = srow.querySelector(".addr-schedule-time");
    const badge = srow.querySelector(".addr-schedule-period");
    if (!input || !badge) return;
    const raw = String(input.value || "").trim();
    const m = raw.match(/^\s*(\d{1,2})\s*:\s*(\d{2})\s*$/);
    if (!m){
      badge.textContent = "";
      badge.classList.add("d-none");
      return;
    }
    const h = parseInt(m[1], 10);
    const period = (h < 12) ? "上午" : (h < 18 ? "下午" : "晚上");
    badge.textContent = period;
    badge.classList.remove("d-none");
  }catch(_){}
}

function getAddressListEl(){ return qs("#addressList"); }

function renumberAddressRows(){
  const list = getAddressListEl();
  if (!list) return;
  const rows = Array.from(list.querySelectorAll(".address-row"));
  rows.forEach((row, idx)=>{
    const num = row.querySelector(".addr-num");
    if (num) num.textContent = String(idx + 1);
    row.dataset.index = String(idx);
  });
  rows.forEach((row, idx)=>{
    const up = row.querySelector(".addr-up");
    const down = row.querySelector(".addr-down");
    if (up) up.disabled = idx === 0;
    if (down) down.disabled = idx === rows.length - 1;
  });
}

function ensureAtLeastOneScheduleRow(addrRow){
  const box = addrRow?.querySelector(".addr-schedules");
  if (!box) return;
  const rows = box.querySelectorAll(".addr-schedule");
  if (rows.length === 0){
    addScheduleRow(addrRow, "", "");
  }
}

function addScheduleRow(addrRow, dateVal, timeVal){
  if (!addrRow) return null;
  const box = addrRow.querySelector(".addr-schedules");
  if (!box) return null;

  const dv = getDefaultCleanDate();
  const d = String(dateVal || "").trim();
  const t = legacySlotToTime(String(timeVal || "").trim());

  const srow = document.createElement("div");
  srow.className = "addr-schedule d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-2";
  const safeDate = String(d || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const safeTime = String(t || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

  srow.innerHTML = `
    <input type="date" class="form-control form-control-sm addr-schedule-date" aria-label="選擇此地址的日期" value="${safeDate}">
    <div class="d-flex align-items-center gap-2">
      <span class="badge text-bg-light border text-dark addr-schedule-period d-none" aria-hidden="true"></span>
      <input type="time" class="form-control form-control-sm addr-schedule-time" aria-label="選擇此地址的時間" value="${safeTime}">
    </div>
    <button class="btn btn-outline-danger btn-sm addr-schedule-remove" type="button" title="刪除此筆日期/時間" aria-label="刪除此筆日期/時間">✕</button>
  `;

  box.appendChild(srow);

  // 若未指定日期，且已有預設日期，則先顯示預設日期但不寫入 slots（encode 時會省略）
  try{
    const di = srow.querySelector(".addr-schedule-date");
    if (di && !di.value && dv){
      di.value = dv;
      di.dataset.inherited = "1";
    }
  }catch(_){}

  // 套用時間
  try{ const ti = srow.querySelector(".addr-schedule-time"); if (ti){ ti.value = t || ""; } }catch(_){}

  updateSchedulePeriod(srow);
  return srow;
}

function syncHiddenAddressFromUI(){
  const hidden = qs("#customerAddress");
  const hiddenSlots = qs("#customerAddressSlots");
  const list = getAddressListEl();
  if (!hidden || !list) return;

  const addrs = [];
  const slots = [];

  Array.from(list.querySelectorAll(".address-row")).forEach(row=>{
    const addr = String(row.querySelector(".address-input")?.value || "").trim();
    if (!addr) return;

    const schedules = [];
    const srows = Array.from(row.querySelectorAll(".addr-schedule"));
    if (srows.length === 0){
      schedules.push({ date:"", time:"" });
    } else {
      srows.forEach(sr=>{
        const di = sr.querySelector(".addr-schedule-date");
        const ti = sr.querySelector(".addr-schedule-time");
        const dRaw = String(di?.value || "").trim();
        const tRaw = legacySlotToTime(String(ti?.value || "").trim());
        schedules.push({ date: dRaw, time: tRaw });
      });
    }

    addrs.push(addr);
    slots.push(encodeSchedules(schedules));
  });

  hidden.value = addrs.join("\n");
  if (hiddenSlots) hiddenSlots.value = slots.join("\n");

  try{ updateCleanFull(); }catch(_){}
  try{ updateSummaryCard(); }catch(_){}
}

function ensureAtLeastOneAddressRow(){
  const list = getAddressListEl();
  if (!list) return;
  const rows = list.querySelectorAll(".address-row");
  if (rows.length === 0){
    addAddressRow("", "");
  }
}

function addAddressRow(value, scheduleLine){
  const list = getAddressListEl();
  if (!list) return null;

  const row = document.createElement("div");
  row.className = "address-row d-flex flex-column flex-sm-row gap-2 align-items-stretch";
  const safeVal = String(value||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  row.innerHTML = `
    <div class="addr-main d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-2 flex-grow-1">
      <div class="addr-toolbar d-flex align-items-center gap-2 flex-shrink-0">
        <span class="badge text-bg-light addr-num">1</span>
        <button class="btn btn-outline-secondary btn-sm addr-handle" type="button" title="拖曳排序" aria-label="拖曳排序">⋮⋮</button>
        <button class="btn btn-outline-danger btn-sm addr-remove addr-remove-mobile" type="button" title="刪除" aria-label="刪除地址">✕</button>
      </div>

      <div class="addr-fields d-flex flex-column gap-2 flex-grow-1">
        <input type="text" class="form-control address-input" placeholder="請輸入服務地址" value="${safeVal}">

        <div class="addr-schedules vstack gap-2"></div>

        <div class="d-flex flex-wrap gap-2">
          <button class="btn btn-outline-primary btn-sm addr-schedule-add" type="button" aria-label="新增日期/時間">＋ 新增日期/時間</button>
          <span class="form-text small text-muted">（日期可不同；若同一天則維持預設日期即可）</span>
        </div>
      </div>
    </div>

    <div class="addr-actions d-flex align-items-center justify-content-end gap-2">
      <button class="btn btn-outline-secondary btn-sm addr-up" type="button" title="往上" aria-label="往上移動">↑</button>
      <button class="btn btn-outline-secondary btn-sm addr-down" type="button" title="往下" aria-label="往下移動">↓</button>
      <button class="btn btn-outline-danger btn-sm addr-remove addr-remove-desktop" type="button" title="刪除" aria-label="刪除地址">✕</button>
    </div>
  `;
  list.appendChild(row);

  // 初始排程
  const schedules = decodeScheduleLine(scheduleLine || "");
  schedules.forEach(sc=> addScheduleRow(row, sc.date, sc.time));
  ensureAtLeastOneScheduleRow(row);

  renumberAddressRows();
  syncHiddenAddressFromUI();
  return row;
}

function setAddressesFromData(addr, slotsArr){
  const hidden = qs("#customerAddress");
  const list = getAddressListEl();
  if (!hidden || !list) return;

  const lines = Array.isArray(addr) ? addr.map(v=>String(v||"")) : parseAddressText(addr);
  const slotLines = Array.isArray(slotsArr) ? slotsArr.map(v=>String(v||"")) : (typeof slotsArr==='string' ? slotsArr.split(/\r?\n/).map(s=>s.trim()) : []);
  hidden.value = addressesToText(lines);

  list.innerHTML = "";
  const finalLines = parseAddressText(hidden.value);
  if (finalLines.length === 0) finalLines.push("");

  finalLines.forEach((v, idx)=>{
    const row = document.createElement("div");
    row.className = "address-row d-flex flex-column flex-sm-row gap-2 align-items-stretch";
    const safeVal = String(v||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    row.innerHTML = `
      <div class="addr-main d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-2 flex-grow-1">
        <div class="addr-toolbar d-flex align-items-center gap-2 flex-shrink-0">
          <span class="badge text-bg-light addr-num">1</span>
          <button class="btn btn-outline-secondary btn-sm addr-handle" type="button" title="拖曳排序" aria-label="拖曳排序">⋮⋮</button>
          <button class="btn btn-outline-danger btn-sm addr-remove addr-remove-mobile" type="button" title="刪除" aria-label="刪除地址">✕</button>
        </div>

        <div class="addr-fields d-flex flex-column gap-2 flex-grow-1">
          <input type="text" class="form-control address-input" placeholder="請輸入服務地址" value="${safeVal}">

          <div class="addr-schedules vstack gap-2"></div>

          <div class="d-flex flex-wrap gap-2">
            <button class="btn btn-outline-primary btn-sm addr-schedule-add" type="button" aria-label="新增日期/時間">＋ 新增日期/時間</button>
            <span class="form-text small text-muted">（日期可不同；若同一天則維持預設日期即可）</span>
          </div>
        </div>
      </div>

      <div class="addr-actions d-flex align-items-center justify-content-end gap-2">
        <button class="btn btn-outline-secondary btn-sm addr-up" type="button" title="往上" aria-label="往上移動">↑</button>
        <button class="btn btn-outline-secondary btn-sm addr-down" type="button" title="往下" aria-label="往下移動">↓</button>
        <button class="btn btn-outline-danger btn-sm addr-remove addr-remove-desktop" type="button" title="刪除" aria-label="刪除地址">✕</button>
      </div>
    `;
    list.appendChild(row);

    const schedules = decodeScheduleLine(slotLines[idx] || "");
    schedules.forEach(sc=> addScheduleRow(row, sc.date, sc.time));
    ensureAtLeastOneScheduleRow(row);
  });

  renumberAddressRows();
  syncHiddenAddressFromUI();
}

function setAddressUIReadOnly(isReadonly){
  const list = getAddressListEl();
  if (!list) return;
  list.querySelectorAll("button").forEach(b => b.disabled = !!isReadonly);
  list.querySelectorAll("input, select, textarea").forEach(el => el.disabled = !!isReadonly);
  const addBtn = qs("#addAddressBtn"); if (addBtn) addBtn.disabled = !!isReadonly;
  const clearBtn = qs("#clearAddressesBtn"); if (clearBtn) clearBtn.disabled = !!isReadonly;
}

function initAddressUI(){
  const list = getAddressListEl();
  const hidden = qs("#customerAddress");
  if (!list || !hidden) return;

  // 初始渲染
  setAddressesFromData(hidden.value, qs('#customerAddressSlots')?.value || '');

  // 動態事件（委派）
  list.addEventListener("input", (e)=>{
    const t = e.target;
    if (!t) return;

    if (t.classList.contains("addr-schedule-time")){
      updateSchedulePeriod(t.closest(".addr-schedule"));
    }
    if (t.classList.contains("addr-schedule-date")){
      // 使用者手動修改日期後，不再視為 inherited
      try{ delete t.dataset.inherited; }catch(_){}
    }

    if (
      t.classList.contains("address-input") ||
      t.classList.contains("addr-schedule-date") ||
      t.classList.contains("addr-schedule-time")
    ){
      syncHiddenAddressFromUI();
    }
  });

  // 行動裝置的 <input type="time"> 常只會觸發 change，不一定會觸發 input
  list.addEventListener("change", (e)=>{
    const t = e.target;
    if (!t) return;
    if (t.classList.contains("addr-schedule-time")){
      updateSchedulePeriod(t.closest(".addr-schedule"));
      syncHiddenAddressFromUI();
      return;
    }
    if (t.classList.contains("addr-schedule-date")){
      try{ delete t.dataset.inherited; }catch(_){}
      syncHiddenAddressFromUI();
      return;
    }
  });

  list.addEventListener("click", (e)=>{
    const btn = e.target && e.target.closest("button");
    if (!btn) return;
    if (btn.disabled) return;

    // 刪除排程
    if (btn.classList.contains("addr-schedule-remove")){
      const srow = btn.closest(".addr-schedule");
      const arow = btn.closest(".address-row");
      if (srow) srow.remove();
      if (arow) ensureAtLeastOneScheduleRow(arow);
      syncHiddenAddressFromUI();
      return;
    }

    // 新增排程
    if (btn.classList.contains("addr-schedule-add")){
      const arow = btn.closest(".address-row");
      if (!arow) return;
      const srow = addScheduleRow(arow, "", "");
      try{ srow?.querySelector(".addr-schedule-date")?.focus(); }catch(_){}
      syncHiddenAddressFromUI();
      return;
    }

    // 地址列按鈕
    const row = btn.closest(".address-row");
    if (!row) return;

    if (btn.classList.contains("addr-remove")){
      row.remove();
      ensureAtLeastOneAddressRow();
      renumberAddressRows();
      syncHiddenAddressFromUI();
      return;
    }

    if (btn.classList.contains("addr-up")){
      const prev = row.previousElementSibling;
      if (prev) row.parentNode.insertBefore(row, prev);
      renumberAddressRows();
      syncHiddenAddressFromUI();
      return;
    }

    if (btn.classList.contains("addr-down")){
      const next = row.nextElementSibling;
      if (next) row.parentNode.insertBefore(next, row);
      renumberAddressRows();
      syncHiddenAddressFromUI();
      return;
    }
  });

  // 拖曳排序（滑鼠 / 手機）
  // - 使用 SortableJS（由 index.html 載入）
  // - 若載入失敗，仍可用 ↑↓ 排序
  try{
    if (window.Sortable && !list._addrSortable){
      list._addrSortable = new Sortable(list, {
        handle: ".addr-handle",
        animation: 150,
        fallbackOnBody: true,
        touchStartThreshold: 4,
        ghostClass: "sortable-ghost",
        chosenClass: "sortable-chosen",
        dragClass: "sortable-drag",
        onEnd: ()=>{ renumberAddressRows(); syncHiddenAddressFromUI(); }
      });
    }
  }catch(_){}

  qs("#addAddressBtn")?.addEventListener("click", ()=>{
    const row = addAddressRow("", "");
    try{ row?.querySelector(".address-input")?.focus(); }catch(_){}
  });

  qs("#clearAddressesBtn")?.addEventListener("click", ()=>{
    list.innerHTML = "";
    addAddressRow("", "");
    syncHiddenAddressFromUI();
  });

  // 預設日期變更時：同步更新「沿用預設日期」的排程日期（僅對 inherited 生效）
  qs("#cleanDate")?.addEventListener("change", ()=>{
    const dv = getDefaultCleanDate();
    if (!dv) { syncHiddenAddressFromUI(); return; }
    try{
      list.querySelectorAll(".addr-schedule-date").forEach(di=>{
        if (di && di.dataset && di.dataset.inherited === "1"){
          di.value = dv;
        }
      });
    }catch(_){}
    syncHiddenAddressFromUI();
  });
}


/* =====================
   預約時間合成（支援：同一地址多筆日期/時間）
===================== */
function formatIsoDateWithWeek(iso){
  const s = String(iso || "").trim();
  if (!s) return "";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  try{
    const dt = new Date(`${s}T00:00:00`);
    const wd = ["星期日","星期一","星期二","星期三","星期四","星期五","星期六"][dt.getDay()];
    return `${m[1]}/${m[2]}/${m[3]}（${wd}）`;
  }catch(_){
    return `${m[1]}/${m[2]}/${m[3]}`;
  }
}

function resolveScheduleDate(iso, defaultIso){
  const d = String(iso || "").trim();
  const dv = String(defaultIso || "").trim();
  return d || dv || "";
}

function updateCleanFull(){
  const dv = getDefaultCleanDate();

  // 服務地址 & slots（每行一筆地址）
  const addrHidden = qs("#customerAddress")?.value || "";
  const addrLines = addrHidden.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);

  const slotsHidden = qs("#customerAddressSlots")?.value || "";
  const slotLines = slotsHidden.split(/\r?\n/); // 保留空字串，避免 index 對不上

  const cf = qs("#cleanFull");
  if (!cf) return;

  // 整理每地址排程
  const perAddr = [];
  const dateSet = new Set();

  for (let i=0; i<addrLines.length; i++){
    const schedulesRaw = decodeScheduleLine(slotLines[i] || "");
    const schedules = schedulesRaw.map(sc=>{
      const d = resolveScheduleDate(sc.date, dv);
      const t = legacySlotToTime(sc.time || "");
      if (d) dateSet.add(d);
      return { date: d, time: t };
    });
    perAddr.push(schedules.length ? schedules : [{date:"", time:""}]);
  }

  // 若只有 1 個日期（所有排程都同一天） → 維持舊版展示（日期一行＋各地址時間）
  const uniqDates = Array.from(dateSet).filter(Boolean);
  const singleDate = (uniqDates.length === 1);
  const topDateText = singleDate ? formatIsoDateWithWeek(uniqDates[0] || dv) : (dv ? formatIsoDateWithWeek(dv) : "");

  const lines = [];

  if (singleDate && topDateText){
    // 舊版：日期一行
    lines.push(topDateText);

    // 時間（依地址順序）
    if (addrLines.length){
      const n = addrLines.length;
      for (let i=0;i<addrLines.length;i++){
        const schedules = perAddr[i] || [{date:"", time:""}];
        const timeLabels = schedules.map(x=> timeWithPeriod(x.time) || "時間待確認").filter(Boolean);
        const label = timeLabels.length ? timeLabels.join("、") : "時間待確認";
        if (n === 1) lines.push(label);
        else lines.push(`第${i+1}地址：${label}`);
      }
    }
  } else {
    // 多日期（或無法合併）
    // 若有預設日期但仍多日期，就不放單一日期行，直接逐筆列出
    if (!addrLines.length && dv){
      lines.push(formatIsoDateWithWeek(dv));
    }

    if (addrLines.length){
      const n = addrLines.length;
      for (let i=0;i<addrLines.length;i++){
        const schedules = perAddr[i] || [{date:"", time:""}];

        // 只有一筆排程
        if (schedules.length === 1){
          const dText = schedules[0].date ? formatIsoDateWithWeek(schedules[0].date) : "日期待確認";
          const tText = timeWithPeriod(schedules[0].time) || "時間待確認";
          if (n === 1) lines.push(`${dText} ${tText}`.trim());
          else lines.push(`第${i+1}地址：${dText} ${tText}`.trim());
          continue;
        }

        // 多筆排程
        if (n === 1) lines.push("同一地址多筆排程：");
        else lines.push(`第${i+1}地址：`);

        schedules.forEach(sc=>{
          const dText = sc.date ? formatIsoDateWithWeek(sc.date) : "日期待確認";
          const tText = timeWithPeriod(sc.time) || "時間待確認";
          lines.push(`- ${dText} ${tText}`.trim());
        });
      }
    }
  }

  if (!topDateText && lines.length === 0){
    cf.textContent = "尚未選擇";
    return;
  }

  const out = lines.join("\n").trim();
  cf.textContent = out || "尚未選擇";
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

  // 4. 服務地址：拿 #customerAddress 的值（支援多行 / 多地址）
  if (areaSpan){
    const addrEl = document.querySelector('#customerAddress');
    const raw = (addrEl?.value || addrEl?.textContent || '').trim();
    const lines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);

  // 單一地址直接顯示；多地址用「1. ...\n2. ...」並在摘要區以換行呈現
    const display = lines.length
      ? (lines.length === 1 ? lines[0] : lines.map((s, i) => `${i + 1}. ${s}`).join('\n'))
      : '';

    areaSpan.textContent = display || '地址尚未填寫';
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


function estimateGiftOriginalPrice(service, option, qty){
  qty = Math.max(1, Number(qty||1));
  if (service === "冷氣清洗" && String(option).includes("分離式")) return (qty >= 3) ? 1500 : 1800;
  if (service === "冷氣清洗" && String(option).includes("吊隱式")) return 2800;
  if (service === "洗衣機清洗" && String(option).includes("直立式")) return 2000;
  if (service === "防霉處理") return (qty >= 5) ? 250 : 300;
  if (service === "臭氧殺菌") return (qty >= 5) ? 150 : 200;
  if (service === "變形金剛機型") return 500;
  if (service === "一體式水盤機型") return 500;
  if (service === "超長費用") return 300;
  if (service === "水塔清洗") return 1000;
  return 0;
}

function formatGiftPriceNote(originalValue){
  originalValue = Number(originalValue || 0);
  if (originalValue <= 0) return '<span class="gift-price-note"><span class="gift-badge">🎁 贈送</span></span>';
  return '<span class="gift-price-note"><span class="gift-original">$' + originalValue.toLocaleString('zh-TW') + '</span><span class="gift-badge">🎁 贈送</span></span>';
}
function renderGiftTotalHint(value){
  value = Number(value || 0);
  return value > 0 ? '<div class="gift-total-hint">🎁 本次優惠贈送價值 $' + value.toLocaleString('zh-TW') + ' 服務</div>' : '';
}
function syncMobileGiftHint(value){
  value = Number(value || 0);
  const bar = document.querySelector('.mobile-bottom-bar');
  const line = document.getElementById('mobileGiftLine');
  if (bar) bar.classList.toggle('has-gift', value > 0);
  if (line){
    line.classList.toggle('d-none', value <= 0);
    if (value > 0) line.textContent = '🎁 贈送價值 $' + value.toLocaleString('zh-TW');
  }
}

/* =====================
   自動帶價 + 合計
===================== */


function updateTotals(){
  let total = 0, hasAC=false, hasPipe=false, giftValue=0;
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
    tr.classList.remove("gift-row");
    if (subEl) {
      subEl.classList.remove("gift-subtotal");
      subEl.removeAttribute("data-gift-value");
      subEl.removeAttribute("data-gift-label");
    }
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

    const finalPrice = (Number(priceEl?.value || price) || 0);
    if (service && finalPrice === 0) {
      const originalUnit = estimateGiftOriginalPrice(service, option, qty);
      giftValue += originalUnit * qty;
      tr.classList.add("gift-row");
      if (subEl) {
        subEl.classList.add("gift-subtotal");
        subEl.setAttribute("data-gift-label", "🎁 贈送");
        if (originalUnit > 0) subEl.setAttribute("data-gift-value", "價值 $" + (originalUnit * qty).toLocaleString('zh-TW'));
      }
      if (noteEl) noteEl.innerHTML = formatGiftPriceNote(originalUnit);
    }
    const subtotal = qty * finalPrice;
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

  window.__giftValueTotal = giftValue;
  // 未稅總計
  // Dynamic totals rendering (no static #total/#totalWithTax banners)
  const totalWithTax = Math.round(total * 1.05);
  const showTax = qs("#toggleTax")?.checked === true;
  (function(){
    const container = qs("#totalContainer");
    if (container) {
      const giftValue = window.__giftValueTotal || 0;
      const giftHtml = renderGiftTotalHint(giftValue);
      container.innerHTML = showTax
        ? `<h5 class="mt-2 total-banner text-success">含稅 (5%)：<span id="totalWithTax">${totalWithTax}</span> 元</h5>${giftHtml}`
        : `<h5 class="mt-3 total-banner">合計：<span id="total">${total}</span> 元</h5>${giftHtml}`;
    }
  })();

  // Mobile footer number & tag
  setText(qs("#totalMobile"), showTax ? totalWithTax : total);
  { const tag = qs("#totalMobileTag"); if (tag) tag.classList.toggle("d-none", !showTax); }

  // 手機底部合計：若開啟含稅，就顯示含稅；否則顯示未稅
  setText(qs("#totalMobile"), showTax ? totalWithTax : total);
  syncMobileGiftHint(giftValue);

  // 同步更新摘要卡
  try{ updateSummaryCard(); }catch(_){}
}

function applyMobileLabels(){
  const labels = Array.from(qsa('#quoteTable thead th')).map(th => th.textContent.trim());
  qsa('#quoteTable tbody tr').forEach(tr=>{
    Array.from(tr.children).forEach((td, i)=> td.setAttribute('data-label', labels[i] || '') );
  });
}
qs("#quoteTable tbody")?.addEventListener("change", async (e)=>{
  const t = e.target;

  // 自訂：加價項目可新增
  if (t.classList.contains("service") && t.value === "__custom_surcharge__"){
    const name = await askCustomSurchargeName();
    const sel = t;
    if (!name){
      sel.value = "";
      return;
    }
    // 避免重複：若已存在同名 option 直接選取
    const existing = Array.from(sel.options).find(o => (o.value || o.textContent || "").trim() === name);
    if (existing){
      sel.value = existing.value || existing.textContent.trim();
    } else {
      // 插入到「加價項目」群組中（放在「＋新增加價項目…」前面）
      const og = Array.from(sel.querySelectorAll('optgroup')).find(g => g.label === "加價項目");
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      if (og){
        const addOpt = Array.from(og.querySelectorAll('option')).find(o => o.value === "__custom_surcharge__");
        if (addOpt) og.insertBefore(opt, addOpt);
        else og.appendChild(opt);
      } else {
        sel.appendChild(opt);
      }
      sel.value = name;
    }

    // 自訂加價項目時，補充說明預設選「其他」（若存在）
    const row = sel.closest("tr");
    const noteSel = row?.querySelector(".option");
    if (noteSel && Array.from(noteSel.options).some(o => (o.value || o.textContent) === "其他")){
      noteSel.value = "其他";
      const otherInput = row?.querySelector(".option-other-input");
      if (otherInput){
        otherInput.style.display = "block";
      }

    }

    // 讓價格可手填（不套用固定定價）
    const rowPrice = sel.closest("tr")?.querySelector(".price");
    if (rowPrice){
      rowPrice.dataset.override = "true";
      if (!rowPrice.value) rowPrice.value = "0";
    }
    updateTotals();
    return;
  }

  
  // 「補充說明」選到「其他」時，顯示可手動輸入的說明欄位
  if (t.classList.contains("option")){
    const row = t.closest("tr");
    const otherInput = row?.querySelector(".option-other-input");
    if (otherInput){
      if ((t.value || "").trim() === "其他"){
        otherInput.style.display = "block";
      } else {
        otherInput.style.display = "none";
        otherInput.value = "";
      }
    }
  }

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
    <option value="__custom_surcharge__">＋新增加價項目…</option>
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
            <option>其他</option>
  </optgroup>
        <optgroup label="坪數 / 衛浴數">
          <option>無廚一衛</option>
          <option>一廚一衛</option>
          <option>一廚兩衛</option>
          <option>一廚三衛</option>
          <option>一廚四衛</option>
        </optgroup>
      </select>
      <input type="text" class="form-control option-other-input mt-1" placeholder="請輸入其他說明（可留空）" style="display:none;">
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
      window.QUOTE_LOCKED = true;
      window.QUOTE_STATUS = 'confirmed';
      window.QUOTE_CONFIRMED = true;
      try{ syncFinalizedQuoteActions(); }catch(_){}
      setTimeout(()=>{ location.href = location.pathname + "#cid=" + encodeURIComponent(cid); location.reload(); }, 300);
      markLocallyLocked("locked:cid:"+cid);
    } else if (hash.startsWith("#data=")) {
      markLocallyLocked("locked:data:"+hash);
      window.QUOTE_LOCKED = true;
      window.QUOTE_STATUS = 'confirmed';
      window.QUOTE_CONFIRMED = true;
      try{ syncFinalizedQuoteActions(); }catch(_){}
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
   LINE 基礎版：一鍵產生報價訊息
===================== */
function escapeHtmlLineBasic(str){
  return String(str ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function getQuoteNoFromUrl(url){
  try{
    const u = new URL(url, location.href);
    return u.searchParams.get('cid') || u.hash.replace(/^#cid=/,'') || '';
  }catch(_){ return ''; }
}
function buildLineQuoteMessage(shareUrl){
  const data = collectShareData();
  const customer = (data.customer || '貴賓').trim();
  const quoteNo = getQuoteNoFromUrl(shareUrl);
  const total = Number(data.total || 0).toLocaleString('zh-TW');

  // LINE 智慧版：只有真的有贈送服務時，才顯示贈送價值與贈送項目。
  const giftItems = (data.items || [])
    .filter(it => {
      const serviceName = String(it.service || '').trim();
      const price = Number(it.price || 0);
      return serviceName && price === 0;
    })
    .map(it => {
      const qty = Math.max(1, Number(it.qty || 1));
      const originalUnit = estimateGiftOriginalPrice(it.service || '', it.option || '', qty);
      const name = [it.service, it.option].filter(Boolean).join(' - ');
      return { name, qty, originalValue: originalUnit * qty };
    })
    .filter(it => it.name);

  const calculatedGiftValue = giftItems.reduce((sum, it) => sum + Number(it.originalValue || 0), 0);
  const giftValue = calculatedGiftValue > 0 ? calculatedGiftValue : Number(window.__giftValueTotal || 0);
  let giftLine = '';
  if (giftValue > 0){
    const giftNames = giftItems.length
      ? `\n🎁 加贈：${giftItems.map(it => `${it.name}${it.qty > 1 ? ` x ${it.qty}` : ''}`).join('、')}`
      : '';
    giftLine = `\n🎁 本次優惠贈送價值 $${giftValue.toLocaleString('zh-TW')} 服務${giftNames}`;
  }

  return `${customer} 您好 😊\n這是您的到府清洗報價單，請您確認。\n若一切無誤，請直接點選按鈕「我同意此報價」，以利後續的安排事宜！\n\n💰 本次報價：$${total}${giftLine}\n\n👉 點此查看完整報價內容：\n${shareUrl}\n\n如有任何問題，歡迎直接回覆 LINE，謝謝您！\n— 自然大叔`;
}
async function copyTextLineBasic(text, btn){
  try{
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else { const ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
    if (btn){ const orig=btn.textContent; btn.textContent='✅ 已複製'; setTimeout(()=>btn.textContent=orig,1500); }
  }catch(_){ alert('複製失敗，請手動選取複製'); }
}
function injectLineMessageTools(shareUrl){
  const box = qs('#shareLinkBox');
  if (!box) return;
  const message = buildLineQuoteMessage(shareUrl);
  const encoded = encodeURIComponent(message);
  const wrap = document.createElement('div');
  wrap.className = 'line-message-box mt-3 p-3 rounded-4 border';
  wrap.style.background = '#f6fff6';
  wrap.style.borderColor = '#b7ebc6';
  wrap.innerHTML = `
    <div class="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-2">
      <div class="fw-bold text-success">🟢 LINE 報價單訊息</div>
      <div class="d-flex gap-2 flex-wrap">
        <button class="btn btn-success btn-sm" type="button" id="copyLineMsgBtn">📋 複製 LINE 訊息</button>
        <a class="btn btn-outline-success btn-sm" id="openLineShareBtn" href="https://line.me/R/msg/text/?${encoded}" target="_blank" rel="noopener">開啟 LINE 分享</a>
      </div>
    </div>
    <textarea class="form-control line-message-text" id="lineMessageText" rows="8" readonly>${escapeHtmlLineBasic(message)}</textarea>
    <div class="small text-muted mt-2">手機可直接按「開啟 LINE 分享」；電腦版建議先複製訊息，再貼到 LINE 官方帳號聊天視窗。</div>`;
  box.appendChild(wrap);
  qs('#copyLineMsgBtn')?.addEventListener('click', function(){ copyTextLineBasic(qs('#lineMessageText')?.value || message, this); });
}

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
    try{ injectLineMessageTools(hrefWithTax); }catch(e){ console.warn('LINE 訊息工具產生失敗', e); }
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
      option:  (function(){ const sel=tr.querySelector(".option"); const v=(sel?.value||"").trim(); if(v==="其他"){ const t=(tr.querySelector(".option-other-input")?.value||"").trim(); return t!==""?t:"其他"; } return v; })(),
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
    address:   (function(){ try{ return (qs("#customerAddress").value||"").split(/\r?\n/).map(s=>s.trim()).filter(Boolean); }catch(_){ return []; } })(),
    addressSlots: (function(){ try{ return (qs("#customerAddressSlots")?.value||"").split(/\r?\n/).map(s=>s.trim()); }catch(_){ return []; } })(),
    technician:qs("#technicianName").value,
    techPhone: qs("#technicianPhone").value,
    cleanDate: (qs("#cleanDate")?.value || ""),
    cleanTime: qs("#cleanFull").textContent,
    otherNotes:qs("#otherNotes").value,
    items, total: (function(){ try{ let sum=0; qsa("#quoteTable tbody tr").forEach(tr=>{ const v=parseInt(tr.querySelector(".subtotal")?.textContent||"0",10); sum+=isNaN(v)?0:v; }); return String(sum);}catch(_){return "0";} })()
  };
}

/* =====================
   可見性（考慮取消狀態）
===================== */
function getQuoteFinalState(){
  const status = String(window.QUOTE_STATUS || '').trim().toLowerCase();
  const locked = window.QUOTE_LOCKED === true || window.QUOTE_LOCKED === '1' || window.QUOTE_LOCKED === 1;
  const confirmed = window.QUOTE_CONFIRMED === true || status === 'confirmed' || status === '已確認' || status === '已同意';
  const cancelled = !!window.__QUOTE_CANCELLED__ || status === 'cancelled' || status === 'canceled' || status === '已作廢' || status === '作廢';
  return { locked, confirmed, cancelled, finalized: locked || confirmed || cancelled };
}

function updateMobileFinalStatus(){
  const state = getQuoteFinalState();
  const bar = qs('.mobile-bottom-bar');
  const box = qs('#mobileQuoteFinalStatus');
  if (!bar || !box) return false;

  const iconEl = box.querySelector('.mobile-final-status-icon');
  const titleEl = box.querySelector('.mobile-final-status-title');
  const subEl = box.querySelector('.mobile-final-status-sub');

  bar.classList.remove('is-finalized', 'is-confirmed', 'is-cancelled', 'is-locked');

  if (!state.finalized) {
    box.classList.add('d-none');
    return false;
  }

  let icon = '🔒';
  let title = '已封存';
  let sub = '僅供查看';
  let className = 'is-locked';

  if (state.cancelled) {
    icon = '⛔';
    title = '已作廢';
    sub = '此報價單已作廢';
    className = 'is-cancelled';
  } else if (state.confirmed || state.locked) {
    icon = '✅';
    title = '已確認報價';
    sub = '已封存，無需再次操作';
    className = 'is-confirmed';
  }

  if (iconEl) iconEl.textContent = icon;
  if (titleEl) titleEl.textContent = title;
  if (subEl) subEl.textContent = sub;

  ['#shareLinkBtnMobile', '#cancelBtnMobile', '#confirmBtnMobile'].forEach(sel => {
    setActionHiddenDisabled(qs(sel), true);
  });

  box.classList.remove('d-none');
  bar.classList.add('is-finalized', className);
  bar.classList.remove('d-none');
  bar.style.display = '';
  return true;
}

function setActionHiddenDisabled(el, hidden){
  if (!el) return;
  el.classList.toggle('d-none', !!hidden);
  el.disabled = !!hidden;
  if (hidden) {
    el.setAttribute('aria-disabled', 'true');
    el.style.display = 'none';
  } else {
    el.removeAttribute('aria-disabled');
    el.style.display = '';
  }
}

function syncFinalizedQuoteActions(){
  const state = getQuoteFinalState();
  if (!state.finalized) return false;

  ['#confirmBtnDesktop', '#confirmBtnMobile', '#cancelBtnDesktop', '#cancelBtnMobile', '#shareLinkBtnMobile'].forEach(sel => {
    setActionHiddenDisabled(qs(sel), true);
  });

  const ro = qs('#readonlyActions');
  if (ro) ro.classList.add('d-none');

  // 已確認 / 已作廢 / 已封存後，手機固定底列改為顯示狀態，不再提供任何操作。
  try{ updateMobileFinalStatus(); }catch(_){}

  try{ document.dispatchEvent(new CustomEvent('quote:statechange', { detail: state })); }catch(_){}
  return true;
}

/* 防止其它補丁晚一步把按鈕打開後仍可點擊 */
document.addEventListener('click', function(e){
  const target = e.target && e.target.closest ? e.target.closest('#confirmBtnDesktop,#confirmBtnMobile,#cancelBtnDesktop,#cancelBtnMobile') : null;
  if (!target) return;
  if (getQuoteFinalState().finalized) {
    e.preventDefault();
    e.stopImmediatePropagation();
    syncFinalizedQuoteActions();
  }
}, true);

function setReadonlyButtonsVisibility(canConfirm){
  if (syncFinalizedQuoteActions()) return;

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

  // 先同步預設日期與 slots（讓地址內的排程日期能顯示）
  try{ if (qs("#cleanDate")) qs("#cleanDate").value = String(data.cleanDate || ""); }catch(_){}
  try{
    const slots = data.addressSlots;
    const arr = Array.isArray(slots) ? slots.map(v=>String(v||""))
              : (typeof slots === "string" ? slots.split(/\r?\n/).map(s=>s.trim()) : []);
    const el = qs("#customerAddressSlots");
    if (el) el.value = arr.join("\n");
  }catch(_){}

  // 服務地址：支援舊版（單一字串/多行）與新版（array）
  try{ setAddressesFromData(data.address || "", data.addressSlots || ""); }catch(_){
    // fallback：僅寫入 hidden textarea
    const addr = data.address;
    const hidden = qs("#customerAddress");
    if (hidden) hidden.value = Array.isArray(addr) ? addr.join("\n") : (addr || "");
  }
qs("#technicianName").value = data.technician|| "";
  qs("#technicianPhone").value= data.techPhone || "";
  (function(){
    const cf = qs("#cleanFull");
    if (!cf) return;

    // 新版：cleanDate + addressSlots（方案B）
    if (data.cleanDate || data.addressSlots){
      // 先把地址渲染好，再依 hidden slots 合成
      const dv = String(data.cleanDate || "");
      const slotArr = Array.isArray(data.addressSlots) ? data.addressSlots : [];
      // 同步 hidden（避免後續摘要/寄信用到）
      try{ if(qs("#cleanDate")) qs("#cleanDate").value = dv; }catch(_){}
      try{ if(qs("#customerAddressSlots")) qs("#customerAddressSlots").value = slotArr.map(v=>String(v||"")).join("\n"); }catch(_){}
      // 合成顯示
      try{ updateCleanFull(); }catch(_){
        cf.textContent = (data.cleanTime || "尚未選擇");
      }
      return;
    }

    // 舊版：直接顯示 cleanTime 字串
    const s = data.cleanTime || "尚未選擇";
    cf.textContent = s;
  })();;
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
        ${(it.overridden && Number(it.price||0)===0) ? `<small class="discount-note">${formatGiftPriceNote(estimateGiftOriginalPrice(it.service,it.option,it.qty))}</small>` : (it.overridden ? '<small class="text-warning ms-1">(自訂單價)</small>' : '<small class="discount-note"></small>')}
      </td>
      <td class="subtotal">${it.subtotal||0}</td>
      <td></td>`;
    tbody.appendChild(tr);
  });

  qsa("input, textarea").forEach(el=>el.setAttribute("readonly", true));
  qsa("select").forEach(el=>el.setAttribute("disabled", true));
  try{ setAddressUIReadOnly(true); }catch(_){ }
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
      try{ syncFinalizedQuoteActions(); }catch(_){}
    }
  }catch(e){ console.warn("applyCancelStatus error:", e); }
}

/* =====================
   顯示/綁定取消按鈕（admin）
===================== */
function setupCancelButtonsVisibility(payload){
  const resource = extractResource(payload);
  const ctx = resource?.context?.custom || {};
  const isCancelled =
    (resource?.resource_type === 'raw' && Array.isArray(resource?.tags) && resource.tags.includes('cancelled')) ||
    (ctx.status === 'cancelled') ||
    !!window.__QUOTE_CANCELLED__;
  const isLocked =
    payload?.locked === true || payload?.locked === '1' ||
    ctx.locked === '1' || ctx.locked === 1 || ctx.locked === true ||
    window.QUOTE_LOCKED === true;
  const isConfirmed =
    isLocked || ctx.status === 'confirmed' || window.QUOTE_CONFIRMED === true ||
    String(window.QUOTE_STATUS || '').toLowerCase() === 'confirmed';
  const show = !isCancelled && !isConfirmed;

  console.debug('[quote] cancel visibility', {admin:isAdmin(), want: wantShowCancel(), isCancelled, isLocked, isConfirmed});
  toggle(qs('#cancelBtnDesktop'), show);
  toggle(qs('#cancelBtnMobile'), show);
  if (!show) {
    setActionHiddenDisabled(qs('#cancelBtnDesktop'), true);
    setActionHiddenDisabled(qs('#cancelBtnMobile'), true);
  }

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

  // Initialize multi-address UI
  try{ initAddressUI(); setAddressUIReadOnly(false); }catch(_){ }

  // 不預先打開取消/同意按鈕；等待 view API 回傳狀態後再決定。
  // 這可避免已確認/已封存的報價單在手機載入瞬間仍可點擊作廢或同意。
  addClass(qs('#readonlyActions'), 'd-none');
  addClass(qs('#cancelBtnDesktop'), 'd-none');
  addClass(qs('#cancelBtnMobile'), 'd-none');
  try{ syncFinalizedQuoteActions(); }catch(_){}
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
      try{
        const ctx = payload?.context?.custom || {};
        if (ctx.status) window.QUOTE_STATUS = String(ctx.status);
        if (ctx.status === 'confirmed') window.QUOTE_CONFIRMED = true;
        if (ctx.locked === '1' || ctx.locked === 1 || ctx.locked === true) window.QUOTE_LOCKED = true;
      }catch(_){}

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
        try{ syncFinalizedQuoteActions(); }catch(_){}
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
        window.QUOTE_LOCKED = true;
        window.QUOTE_STATUS = 'confirmed';
        window.QUOTE_CONFIRMED = true;
        addClass(qs("#confirmBtnDesktop"), "d-none");
        addClass(qs("#confirmBtnMobile"), "d-none");
        if (!isAdmin()) addClass(qs("#readonlyActions"), "d-none");
        const notice = document.createElement('div');
        notice.className = 'alert alert-success mt-2';
        notice.innerHTML = '此報價單已<span class="fw-bold">完成確認並封存</span>，僅供查看。';
        qs('.container-quote').prepend(notice);
        try{ syncFinalizedQuoteActions(); }catch(_){}
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
      const giftValue = Number(window.__giftValueTotal || 0);
      const giftHtml = (typeof renderGiftTotalHint === 'function') ? renderGiftTotalHint(giftValue) : '';
      const totalLine = showTax
        ? '<h5 class="mt-2 total-banner text-success">含稅 (5%)：<span id="totalWithTax">'+ grand +'</span> 元</h5>'
        : '<h5 class="mt-2 total-banner">合計：<span id="total">'+ grand +'</span> 元</h5>';
      container.innerHTML = '<div class="d-flex flex-column gap-1">'+ rows.join('') + totalLine + giftHtml + '</div>';
    }

    // 更新手機版合計
    const mobile = document.getElementById('totalMobile');
    if (mobile) mobile.textContent = String(grand);
    if (typeof syncMobileGiftHint === 'function') syncMobileGiftHint(window.__giftValueTotal || 0);

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

    // 同步更新報價摘要區（顯示折扣後金額）
    try {
      if (typeof updateSummaryCard === 'function') {
        updateSummaryCard();
      }
    } catch (_) {}

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
