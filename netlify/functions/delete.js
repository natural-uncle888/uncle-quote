// netlify/functions/delete.js
const RTYPES = ["raw", "image", "video"];

export async function handler(event){
  try{
    if (event.httpMethod !== "POST") return resp(405, { error: "Method Not Allowed" });
    const { id } = JSON.parse(event.body || "{}");
    if (!id) return resp(400, { error: "Missing id" });

    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const FOLDER = process.env.CLOUDINARY_FOLDER || "quotes";
    if (!cloud || !apiKey || !apiSecret) return resp(500, { error: "Cloudinary env missing" });

    const auth = "Basic " + Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const publicId = `${FOLDER}/${id}`;

    let ok = false, last = null;
    for (const rt of RTYPES){
      try{
        const base = `https://api.cloudinary.com/v1_1/${cloud}/resources/${rt}/upload`;
        const qs = new URLSearchParams({ "public_ids[]": publicId });
        const res = await fetch(`${base}?${qs.toString()}`, { method:"DELETE", headers:{ Authorization: auth }});
        if (res.ok){ ok = true; break; }
        last = await res.text().catch(()=>"(no body)");
      }catch(e){ last = String(e); }
    }
    if (!ok) return resp(500, { error: "delete failed", detail: last });

    const notifySettings = await readNotificationSettings();
    const deleteMail = await maybeSendDeleteEmail({ id }, notifySettings);
    return resp(200, { ok:true, id, delete_mail: deleteMail });
  }catch(e){
    return resp(500, { error: String(e?.message || e) });
  }
}

function resp(statusCode, json){
  return { statusCode, headers:{ "Content-Type":"application/json", "Cache-Control":"no-store", "Pragma":"no-cache" }, body: JSON.stringify(json) };
}


/* ======================= Delete Email Notification ======================= */
const DEFAULT_NOTIFY_SETTINGS = {
  emailMaster: true,
  lineMaster: true,
  newBookingEmail: true,
  newBookingLine: true,
  caseDeleteEmail: true,
  lineQuietMode: false,
  quietStart: "22:00",
  quietEnd: "08:00"
};

async function maybeSendDeleteEmail(meta, settings){
  if (settings.emailMaster === false || settings.caseDeleteEmail === false) {
    return { ok:false, provider:null, response:"案件刪除 Email 通知已關閉" };
  }
  const FROM = (process.env.FROM_EMAIL || process.env.EMAIL_FROM || "").trim();
  const TO = (process.env.TO_EMAIL || process.env.EMAIL_TO || "").trim();
  const SENDER_NAME = process.env.SENDER_NAME || process.env.EMAIL_SENDER_NAME || "";
  const SUBJECT_PREFIX = process.env.EMAIL_SUBJECT_PREFIX || "";
  if (!FROM || !TO) return { ok:false, provider:null, response:"FROM_EMAIL/EMAIL_FROM 或 TO_EMAIL/EMAIL_TO 未設定" };

  const subject = `${SUBJECT_PREFIX ? SUBJECT_PREFIX + " " : ""}案件刪除通知｜${meta.id}`;
  const when = new Intl.DateTimeFormat("zh-TW", {
    timeZone:"Asia/Taipei", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false
  }).format(new Date());
  const html = `<!doctype html><meta charset="utf-8"><div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.7;color:#0f172a;"><h2 style="margin:0 0 12px;">案件刪除通知</h2><p>報價單已從後台刪除。</p><ul><li><strong>ID：</strong>${escHtml(meta.id)}</li><li><strong>刪除時間：</strong>${escHtml(when)}（台北時間）</li></ul></div>`;
  const text = `案件刪除通知\nID：${meta.id}\n刪除時間：${when}（台北時間）`;

  if (process.env.RESEND_API_KEY) {
    try{
      const r = await fetch("https://api.resend.com/emails", {
        method:"POST",
        headers:{ "Authorization":`Bearer ${process.env.RESEND_API_KEY}`, "Content-Type":"application/json" },
        body:JSON.stringify({ from:senderHeader(FROM, SENDER_NAME), to:[TO], subject, html, text })
      });
      const body = await safeText(r);
      if (r.ok) return { ok:true, provider:"resend", response:body };
    }catch(_){ /* fallback to Brevo */ }
  }
  if (process.env.BREVO_API_KEY) {
    try{
      const sender = { email:FROM }; if (SENDER_NAME) sender.name = SENDER_NAME;
      const r = await fetch("https://api.brevo.com/v3/smtp/email", {
        method:"POST",
        headers:{ "api-key":process.env.BREVO_API_KEY, "Content-Type":"application/json" },
        body:JSON.stringify({ sender, to:[parseAddr(TO)], subject, htmlContent:html, textContent:text })
      });
      const body = await safeText(r);
      return { ok:r.ok, provider:"brevo", response:body };
    }catch(e){
      return { ok:false, provider:"brevo", response:String(e?.message || e) };
    }
  }
  return { ok:false, provider:null, response:"未設定 RESEND_API_KEY 或 BREVO_API_KEY" };
}

async function readNotificationSettings(){
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const folder = process.env.CLOUDINARY_FOLDER || "quotes";
  if (!cloud || !apiKey || !apiSecret) return { ...DEFAULT_NOTIFY_SETTINGS };
  const publicId = `${folder}/notification-settings`;
  const auth = "Basic " + Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  try{
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/resources/search`, {
      method:"POST",
      headers:{ Authorization:auth, "Content-Type":"application/json", "Cache-Control":"no-store" },
      body:JSON.stringify({ expression:`public_id="${escapeCloudinaryExpr(publicId)}" AND resource_type=raw`, max_results:1 })
    });
    if (!response.ok) return { ...DEFAULT_NOTIFY_SETTINGS };
    const data = await response.json().catch(()=>({}));
    const url = data.resources?.[0]?.secure_url;
    if (!url) return { ...DEFAULT_NOTIFY_SETTINGS };
    const file = await fetch(url, { cache:"no-store" });
    if (!file.ok) return { ...DEFAULT_NOTIFY_SETTINGS };
    return normalizeNotifySettings(await file.json().catch(()=>({})));
  }catch(_){
    return { ...DEFAULT_NOTIFY_SETTINGS };
  }
}
function normalizeNotifySettings(input){
  const out = { ...DEFAULT_NOTIFY_SETTINGS };
  const boolKeys = ["emailMaster","lineMaster","newBookingEmail","newBookingLine","caseDeleteEmail","lineQuietMode"];
  for (const key of boolKeys){
    if (Object.prototype.hasOwnProperty.call(input || {}, key)) out[key] = Boolean(input[key]);
  }
  out.quietStart = /^\d{2}:\d{2}$/.test(String(input?.quietStart || "")) ? String(input.quietStart) : DEFAULT_NOTIFY_SETTINGS.quietStart;
  out.quietEnd = /^\d{2}:\d{2}$/.test(String(input?.quietEnd || "")) ? String(input.quietEnd) : DEFAULT_NOTIFY_SETTINGS.quietEnd;
  return out;
}
function escHtml(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m])); }
function senderHeader(email, name){ return name ? `${name} <${email}>` : email; }
function parseAddr(str){
  const m = String(str).match(/^\s*(?:"?([^"]*)"?\s*)?<([^>]+)>\s*$/);
  if (m) return { name:m[1] || undefined, email:m[2].trim() };
  return { email:String(str).trim() };
}
function escapeCloudinaryExpr(s){ return String(s || "").replace(/(["\\])/g, "\\$1"); }
