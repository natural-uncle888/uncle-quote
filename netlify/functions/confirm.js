// netlify/functions/confirm.js (CommonJS 版)
// 寄送「報價單確認」郵件（優先 Resend，其次 Brevo）。
// ✅ 強制使用精緻 HTML（行動裝置優化）
// ✅ 金額一律顯示折扣後 (promo.computed.grandTotal)；無則回退 total

exports.handler = async (event) => {
  try{
    if (event.httpMethod !== "POST") return resp(405, "Method Not Allowed");
    const payload = JSON.parse(event.body || "{}");
    const SITE_BASE_URL = process.env.SITE_BASE_URL || "";
    const mailResult = await maybeSendEmail(payload, SITE_BASE_URL);
    return json(200, { ok:true, ...mailResult });
  }catch(e){
    return json(500, { ok:false, error: String(e && e.message || e) });
  }
};

/* ======================= Email ======================= */
async function maybeSendEmail(payload, siteBase){
  const FROM = (process.env.FROM_EMAIL || process.env.EMAIL_FROM || "").trim();
  const TO = (process.env.TO_EMAIL || process.env.EMAIL_TO || "").trim();
  const SENDER_NAME = process.env.SENDER_NAME || process.env.EMAIL_SENDER_NAME || "";
  const SUBJECT_PREFIX = process.env.EMAIL_SUBJECT_PREFIX || "";
  if (!FROM || !TO) {
    return { mail_ok:false, mail_provider:null, mail_response:"FROM_EMAIL/EMAIL_FROM 或 TO_EMAIL/EMAIL_TO 未設定" };
  }

  const GRAND = toNum(payload && payload.promo && payload.promo.computed && payload.promo.computed.grandTotal, payload && payload.total);
  const subject = `${SUBJECT_PREFIX ? SUBJECT_PREFIX + " " : ""}客戶同意報價｜${(payload.customer||"未填")}｜合計 ${fmt(GRAND)} 元`;

  const html = buildConfirmHtml(payload, siteBase);
  const text = stripHtml(html);
  const replyTo = (payload && payload.email && String(payload.email).includes("@")) ? String(payload.email).trim() : undefined;

  // Resend
  if (process.env.RESEND_API_KEY) {
    try{
      const bodyPayload = { from: senderHeader(FROM, SENDER_NAME), to: [TO], subject, html, text };
      if (replyTo) bodyPayload.reply_to = replyTo;
      const r = await fetch("https://api.resend.com/emails", {
        method:"POST",
        headers:{ "Authorization": `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type":"application/json" },
        body: JSON.stringify(bodyPayload)
      });
      const body = await safeText(r);
      if (!r.ok) return { mail_ok:false, mail_provider:"resend", mail_response: body };
      return { mail_ok:true, mail_provider:"resend", mail_response: body };
    }catch(e){ /* fallback to Brevo */ }
  }

  // Brevo
  if (process.env.BREVO_API_KEY) {
    try{
      const sender = { email: FROM }; if (SENDER_NAME) sender.name = SENDER_NAME;
      const to = [ parseAddr(TO) ];
      const payloadJson = { sender, to, subject, htmlContent: html, textContent: text };
      if (replyTo) payloadJson.replyTo = parseAddr(replyTo);
      const r = await fetch("https://api.brevo.com/v3/smtp/email", {
        method:"POST",
        headers:{ "api-key": process.env.BREVO_API_KEY, "Content-Type":"application/json" },
        body: JSON.stringify(payloadJson)
      });
      const body = await safeText(r);
      if (!r.ok) return { mail_ok:false, mail_provider:"brevo", mail_response: body };
      return { mail_ok:true, mail_provider:"brevo", mail_response: body };
    }catch(e){
      return { mail_ok:false, mail_provider:"brevo", mail_response: String(e && e.message || e) };
    }
  }

  return { mail_ok:false, mail_provider:null, mail_response:"未設定 RESEND_API_KEY 或 BREVO_API_KEY" };
}

/* ======================= HTML Template（行動裝置優化） ======================= */
function formatScheduleHtml(s){
  const raw = String(s || '').trim();
  if (!raw) return '（尚未排定）';
  return raw.split(/\r?\n/).map(esc).join('<br>');
}

function esc(s){ return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

function formatAddress(addr){
  if (Array.isArray(addr)){
    return addr.map(s=>String(s||"").trim()).filter(Boolean).map(esc).join("<br>");
  }
  const raw = String(addr == null ? "" : addr).trim();
  if (!raw) return "";
  return raw.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(esc).join("<br>");
}

function toNum(primary, fallback){ const n = Number(primary ?? fallback ?? 0); return Number.isFinite(n) ? n : 0; }
function fmt(n){ return toNum(n).toLocaleString(); }

function buildConfirmHtml(p, siteBase){
  const items = Array.isArray(p.items) ? p.items : [];
  const rows = items.map((it, i) => {
    const qty = toNum(it.qty), price = toNum(it.price), sub = toNum(it.subtotal ?? qty*price);
    return `
      <tr>
        <td style="padding:10px;border:1px solid #e5e7eb;text-align:center;">${i+1}</td>
        <td style="padding:10px;border:1px solid #e5e7eb;">${esc(it.service)}</td>
        <td style="padding:10px;border:1px solid #e5e7eb;">${esc(it.option)}</td>
        <td style="padding:10px;border:1px solid #e5e7eb;text-align:right;">${fmt(qty)}</td>
        <td style="padding:10px;border:1px solid #e5e7eb;text-align:right;">${fmt(price)}</td>
        <td style="padding:10px;border:1px solid #e5e7eb;text-align:right;">${fmt(sub)}</td>
      </tr>`;
  }).join("");

  const comp = (p && p.promo && p.promo.computed) || {};
  const subtotal = toNum(comp.subtotal, p && p.subtotal);
  const discount = toNum(comp.discount, 0);
  const tax = (comp.tax == null ? null : toNum(comp.tax));
  const grand = toNum(comp.grandTotal, p && p.total);

  const website = siteBase ? `<p style="margin:16px 0;"><a href="${siteBase}" target="_blank" style="text-decoration:none;color:#2563eb;">開啟網站</a></p>` : "";

  const promoBlock = (p && p.promo && p.promo.computed)
    ? (`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 0;border-collapse:collapse;font-size:15px;">
         <tr><td style="padding:8px 0;">小計</td><td style="padding:8px 0;text-align:right;">${fmt(subtotal)}</td></tr>
         ${discount>0?`<tr><td style="padding:8px 0;">${esc(p.promo.displayName || '活動優惠')}</td><td style="padding:8px 0;text-align:right;">- ${fmt(discount)}</td></tr>`:''}
         ${tax!=null?`<tr><td style="padding:8px 0;">稅額</td><td style="padding:8px 0;text-align:right;">${fmt(tax)}</td></tr>`:''}
         <tr><td style="padding:8px 0;font-weight:700;border-top:1px dashed #e5e7eb;">總計</td><td style="padding:8px 0;text-align:right;font-weight:700;border-top:1px dashed #e5e7eb;">${fmt(grand)}</td></tr>
       </table>`)
    : "";

  return `<!doctype html>
  <html>
  <body style="-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;margin:0;padding:0;background:#f8fafc;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:18px 0;">
      <tr><td align="center">
        <!-- container：100% + max-width:600px -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;font-family: ui-sans-serif, -apple-system, Segoe UI, Roboto, Noto Sans, Arial;">
          <tr>
            <td style="padding:18px 20px;background:#0ea5e9;color:#fff;font-size:20px;font-weight:700;">線上報價單確認</td>
          </tr>
          <tr>
            <td style="padding:18px 20px;color:#0f172a;font-size:16px;line-height:1.7;">
              <p style="margin:0 0 6px;"><strong>客戶名稱：</strong>${esc(p.customer)}</p>
              <p style="margin:0 0 6px;"><strong>電話：</strong>${esc(p.phone)}</p>
              <p style="margin:0 0 6px;"><strong>地址：</strong>${formatAddress(p.address)}</p>
              <p style="margin:0 0 6px;"><strong>預約時間：</strong>${formatScheduleHtml(p.cleanTime)}</p>
              <p style="margin:0 0 14px;"><strong>技師：</strong>${esc(p.technician)}（${esc(p.techPhone)}）</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;font-size:15px;">
                <thead>
                  <tr style="background:#f1f5f9;">
                    <th style="padding:10px;border:1px solid #e5e7eb;">#</th>
                    <th style="padding:10px;border:1px solid #e5e7eb;text-align:left;">項目名稱</th>
                    <th style="padding:10px;border:1px solid #e5e7eb;text-align:left;">補充說明</th>
                    <th style="padding:10px;border:1px solid #e5e7eb;text-align:right;">數量</th>
                    <th style="padding:10px;border:1px solid #e5e7eb;text-align:right;">單價</th>
                    <th style="padding:10px;border:1px solid #e5e7eb;text-align:right;">小計</th>
                  </tr>
                </thead>
                <tbody>${rows || `<tr><td colspan="6" style="padding:12px;text-align:center;color:#64748b;">（無明細）</td></tr>`}</tbody>
              </table>

              ${promoBlock}

              <p style="margin:14px 0 0;font-size:18px;"><strong>合計：${fmt(grand)} 元</strong></p>
              <p style="margin:8px 0 0;color:#475569;">承辦 / 報價：${esc(p.quoteInfo)}</p>

              ${website}
            </td>
          </tr>
          <tr>
            <td style="padding:12px 20px;color:#94a3b8;font-size:12px;border-top:1px solid #e5e7eb;">此信件由系統自動寄發，請勿直接回覆。</td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

/* ======================= Utils ======================= */
function stripHtml(h){ return (h||"").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""); }
function senderHeader(email, name){ return name ? `${name} <${email}>` : email; }
function parseAddr(str){
  const m = String(str).match(/^\s*(?:"?([^"]*)"?\s*)?<([^>]+)>\s*$/);
  if (m) return { name: m[1] || undefined, email: m[2].trim() };
  return { email: String(str).trim() };
}

function resp(status, text){ return { statusCode: status, body: text }; }
function json(status, obj){ return { statusCode: status, headers:{ "Content-Type":"application/json" }, body: JSON.stringify(obj) }; }
async function safeText(res){ try{ return await res.text(); }catch{ return "(no body)"; } }
