// netlify/functions/notification-settings.js
// 讀寫報價管理後台的通知開關設定，儲存在 Cloudinary raw JSON。

import crypto from "crypto";

const DEFAULT_SETTINGS = {
  emailMaster: true,
  lineMaster: true,
  newBookingEmail: true,
  newBookingLine: true,
  caseDeleteEmail: true,
  lineQuietMode: false,
  quietStart: "22:00",
  quietEnd: "08:00"
};

export async function handler(event){
  try{
    if (event.httpMethod === "GET") {
      const settings = await readSettings();
      return json(200, { ok:true, settings });
    }
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const settings = normalizeSettings(body.settings || body);
      await saveSettings(settings);
      return json(200, { ok:true, settings });
    }
    return json(405, { ok:false, error:"Method Not Allowed" });
  }catch(e){
    return json(500, { ok:false, error:String(e?.message || e) });
  }
}

export function normalizeSettings(input){
  const out = { ...DEFAULT_SETTINGS };
  const boolKeys = ["emailMaster","lineMaster","newBookingEmail","newBookingLine","caseDeleteEmail","lineQuietMode"];
  for (const key of boolKeys){
    if (Object.prototype.hasOwnProperty.call(input || {}, key)) out[key] = Boolean(input[key]);
  }
  out.quietStart = normalizeTime(input?.quietStart, DEFAULT_SETTINGS.quietStart);
  out.quietEnd = normalizeTime(input?.quietEnd, DEFAULT_SETTINGS.quietEnd);
  out.updatedAt = new Date().toISOString();
  return out;
}

async function readSettings(){
  const cfg = cloudinaryConfig();
  if (!cfg.ok) return { ...DEFAULT_SETTINGS, storageReady:false, storageMessage:cfg.error };

  const auth = "Basic " + Buffer.from(`${cfg.apiKey}:${cfg.apiSecret}`).toString("base64");
  const publicId = settingsPublicId(cfg.folder);

  try{
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloud}/resources/search`, {
      method:"POST",
      headers:{ Authorization:auth, "Content-Type":"application/json", "Cache-Control":"no-store" },
      body:JSON.stringify({
        expression:`public_id="${escapeExpr(publicId)}" AND resource_type=raw`,
        max_results:1
      })
    });
    if (!response.ok) return { ...DEFAULT_SETTINGS, storageReady:false, storageMessage:await safeText(response) };
    const data = await response.json().catch(()=>({}));
    const item = data.resources?.[0];
    if (!item?.secure_url) return { ...DEFAULT_SETTINGS, storageReady:true };
    const file = await fetch(item.secure_url, { cache:"no-store" });
    if (!file.ok) return { ...DEFAULT_SETTINGS, storageReady:false, storageMessage:await safeText(file) };
    const loaded = await file.json().catch(()=>({}));
    return { ...normalizeSettings(loaded), storageReady:true };
  }catch(e){
    return { ...DEFAULT_SETTINGS, storageReady:false, storageMessage:String(e?.message || e) };
  }
}

async function saveSettings(settings){
  const cfg = cloudinaryConfig();
  if (!cfg.ok) throw new Error(cfg.error);

  const publicId = settingsPublicId(cfg.folder);
  const timestamp = Math.floor(Date.now()/1000);
  const toSign = `overwrite=true&public_id=${publicId}&timestamp=${timestamp}${cfg.apiSecret}`;
  const signature = crypto.createHash("sha1").update(toSign).digest("hex");
  const fileData = Buffer.from(JSON.stringify(settings, null, 2)).toString("base64");

  const form = new URLSearchParams();
  form.append("file", `data:application/json;base64,${fileData}`);
  form.append("overwrite", "true");
  form.append("public_id", publicId);
  form.append("timestamp", String(timestamp));
  form.append("api_key", cfg.apiKey);
  form.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloud}/raw/upload`, { method:"POST", body:form });
  if (!response.ok) throw new Error(await safeText(response));
}

function cloudinaryConfig(){
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const folder = process.env.CLOUDINARY_FOLDER || "quotes";
  if (!cloud || !apiKey || !apiSecret) return { ok:false, error:"Missing Cloudinary config" };
  return { ok:true, cloud, apiKey, apiSecret, folder };
}
function settingsPublicId(folder){ return `${folder}/notification-settings`; }
function normalizeTime(value, fallback){
  const s = String(value || "").trim();
  return /^\d{2}:\d{2}$/.test(s) ? s : fallback;
}
function escapeExpr(s){ return String(s || "").replace(/(["\\])/g, "\\$1"); }
async function safeText(res){ try{ return await res.text(); }catch{ return "(no body)"; } }
function json(statusCode, obj){
  return { statusCode, headers:{ "Content-Type":"application/json", "Cache-Control":"no-store", "Pragma":"no-cache" }, body:JSON.stringify(obj) };
}
