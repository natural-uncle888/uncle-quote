// netlify/functions/share.js
// 接收前端 JSON，存成 Cloudinary raw 檔，回傳日期流水號分享網址（例如 /20260527-001）

import crypto from "crypto";

export async function handler(event){
  try{
    if (event.httpMethod !== "POST") return resp(405, "Method Not Allowed");
    const body = JSON.parse(event.body || "{}");

    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const FOLDER = process.env.CLOUDINARY_FOLDER || "quotes";
    const SITE_BASE_URL = process.env.SITE_BASE_URL || getBaseUrl(event) || "";

    if (!cloud || !apiKey || !apiSecret) return resp(500, "Missing Cloudinary config");

    const dateKey = taipeiDateKey();
    let sequence = await findNextSequence({ cloud, apiKey, apiSecret, folder: FOLDER, dateKey });
    const fileData = Buffer.from(JSON.stringify(body, null, 2)).toString("base64");

    // overwrite=false + retry，避免同時建立兩張報價時覆蓋同一流水號。
    let saved = null;
    let slug = "";
    let public_id = "";
    for (let attempt = 0; attempt < 30; attempt += 1, sequence += 1) {
      slug = `${dateKey}-${String(sequence).padStart(3, "0")}`;
      public_id = `${FOLDER}/q-${slug}`;
      const result = await uploadQuote({ cloud, apiKey, apiSecret, public_id, fileData });
      if (result.collision) continue;
      if (!result.ok) return resp(result.status, JSON.stringify(result.data));
      saved = result.data;
      break;
    }
    if (!saved) return json(409, { error: "Unable to allocate quote sequence. Please retry." });

    const base = String(SITE_BASE_URL || "").replace(/\/+$/, "");
    const share_url = `${base}/${encodeURIComponent(slug)}`;
    return json(200, { ok:true, public_id, short_code: slug, share_url, secure_url: saved.secure_url });

  }catch(e){
    return json(500, { error: String(e?.message || e) });
  }
}

function taipeiDateKey(){
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${values.year}${values.month}${values.day}`;
}

async function findNextSequence({ cloud, apiKey, apiSecret, folder, dateKey }){
  const auth = "Basic " + Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  try{
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/resources/search`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({
        expression: `public_id="${escapeExpr(`${folder}/q-${dateKey}-`)}*" AND resource_type=raw`,
        max_results: 1,
        sort_by: [{ public_id: "desc" }]
      })
    });
    if (!response.ok) return 1;
    const data = await response.json().catch(() => ({}));
    const pid = String(data.resources?.[0]?.public_id || "");
    const match = pid.match(new RegExp(`q-${dateKey}-(\\d+)$`));
    return match ? Number(match[1]) + 1 : 1;
  }catch(_){
    return 1;
  }
}

async function uploadQuote({ cloud, apiKey, apiSecret, public_id, fileData }){
  const timestamp = Math.floor(Date.now()/1000);
  const toSign = `overwrite=false&public_id=${public_id}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash("sha1").update(toSign).digest("hex");
  const form = new URLSearchParams();
  form.append("file", `data:application/json;base64,${fileData}`);
  form.append("overwrite", "false");
  form.append("public_id", public_id);
  form.append("timestamp", String(timestamp));
  form.append("api_key", apiKey);
  form.append("signature", signature);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/raw/upload`, { method:"POST", body: form });
  const data = await response.json().catch(() => ({}));
  const collision = response.status === 409 || data.existing === true;
  return { ok: response.ok && !collision, status: response.status, data, collision };
}

function escapeExpr(s){ return String(s || "").replace(/(["\\])/g, "\\$1"); }
function resp(status, text){ return { statusCode: status, body: text }; }
function json(status, obj){ return { statusCode: status, headers: { "Content-Type":"application/json" }, body: JSON.stringify(obj) }; }
function getBaseUrl(event){
  try{
    const proto = (event.headers["x-forwarded-proto"] || "https");
    const host = event.headers["x-forwarded-host"] || event.headers["host"];
    return host ? `${proto}://${String(host).split(",")[0].trim()}` : "";
  }catch{ return ""; }
}
