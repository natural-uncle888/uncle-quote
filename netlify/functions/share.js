// netlify/functions/share.js
// 接收前端 JSON，存成 Cloudinary raw 檔，回傳分享網址（/q/報價單ID）

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

    // 產生 id：q-YYYYMMDD-xxxxxx
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
    const rid = `q-${ymd}-${Math.random().toString(36).slice(2,8)}`;
    const public_id = `${FOLDER}/${rid}`;

    const fileData = Buffer.from(JSON.stringify(body, null, 2)).toString("base64");
    const timestamp = Math.floor(Date.now()/1000);

    // 簽名（不含 file）
    const toSign = `public_id=${public_id}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash("sha1").update(toSign).digest("hex");

    const form = new URLSearchParams();
    form.append("file", `data:application/json;base64,${fileData}`);
    form.append("public_id", public_id);
    form.append("timestamp", String(timestamp));
    form.append("api_key", apiKey);
    form.append("signature", signature);
    // resource_type 在 URL 指定為 raw

    const upUrl = `https://api.cloudinary.com/v1_1/${cloud}/raw/upload`;
    const r = await fetch(upUrl, { method:"POST", body: form });
    const j = await r.json();
    if (!r.ok) return resp(r.status, JSON.stringify(j));

    const baseUrl = normalizeBaseUrl(SITE_BASE_URL || getBaseUrl(event) || "");
    const quote_id = rid;
    const share_url = baseUrl ? `${baseUrl}/q/${encodeURIComponent(quote_id)}` : `/q/${encodeURIComponent(quote_id)}`;
    return json(200, { ok:true, quote_id, public_id, share_url, secure_url: j.secure_url });

  }catch(e){
    return json(500, { error: String(e?.message || e) });
  }
}

function normalizeBaseUrl(url){
  return String(url || "").replace(/\/+$/, "");
}

function resp(status, text){ return { statusCode: status, body: text }; }
function json(status, obj){ return { statusCode: status, headers: { "Content-Type":"application/json" }, body: JSON.stringify(obj) }; }
function getBaseUrl(event){
  try{
    const proto = (event.headers["x-forwarded-proto"] || "https");
    const host = event.headers["x-forwarded-host"] || event.headers["host"];
    const path = event.path && event.path.endsWith("/") ? event.path : "/";
    return host ? `${proto}://${host}${path}`.replace(/\/+$/,"/") : "";
  }catch{ return ""; }
}
