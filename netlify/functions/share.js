// netlify/functions/share.js
// 接收前端 JSON，存成 Cloudinary raw 檔，回傳分享網址（/q/q-YYYYMMDD-流水號）

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

    // 產生 id：q-YYYYMMDD-001、q-YYYYMMDD-002、q-YYYYMMDD-003 ...
    // 日期預設使用台灣時區，避免 Netlify 伺服器 UTC 跨日時產生錯誤日期。
    const timeZone = process.env.QUOTE_TIME_ZONE || "Asia/Taipei";
    const ymd = getYmd(timeZone);
    const baseRid = `q-${ymd}`;

    const auth = "Basic " + Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    let nextSerial = await getNextSerial({ cloud, auth, folder: FOLDER, baseRid });

    let uploadJson = null;
    let rid = "";
    let public_id = "";

    // 避免剛好多人同時建立報價單時撞號：用 overwrite=false，若撞號就往下一號重試。
    for (let attempt = 0; attempt < 20; attempt++){
      rid = `${baseRid}-${String(nextSerial + attempt).padStart(3,"0")}`;
      public_id = `${FOLDER}/${rid}`;
      const result = await uploadQuoteJson({ cloud, apiKey, apiSecret, public_id, body });
      if (result.ok){
        uploadJson = result.json;
        break;
      }

      const msg = String(result.text || result.json?.error?.message || result.json?.message || "");
      const alreadyExists = result.status === 409 || /already exists|exists/i.test(msg);
      if (!alreadyExists) return resp(result.status || 502, JSON.stringify(result.json || { error: msg || "Cloudinary upload failed" }));
    }

    if (!uploadJson) return resp(409, JSON.stringify({ error:"Unable to create a unique quote id. Please try again." }));

    const baseUrl = normalizeBaseUrl(SITE_BASE_URL || getBaseUrl(event) || "");
    const quote_id = rid;
    const share_url = baseUrl ? `${baseUrl}/q/${encodeURIComponent(quote_id)}` : `/q/${encodeURIComponent(quote_id)}`;
    return json(200, { ok:true, quote_id, public_id, share_url, secure_url: uploadJson.secure_url });

  }catch(e){
    return json(500, { error: String(e?.message || e) });
  }
}

async function uploadQuoteJson({ cloud, apiKey, apiSecret, public_id, body }){
  const fileData = Buffer.from(JSON.stringify(body, null, 2)).toString("base64");
  const timestamp = Math.floor(Date.now()/1000);

  // 簽名（不含 file / api_key；有帶 overwrite=false 就必須簽入）
  const params = { overwrite:"false", public_id, timestamp:String(timestamp) };
  const signature = signParams(params, apiSecret);

  const form = new URLSearchParams();
  form.append("file", `data:application/json;base64,${fileData}`);
  form.append("public_id", public_id);
  form.append("overwrite", "false");
  form.append("timestamp", String(timestamp));
  form.append("api_key", apiKey);
  form.append("signature", signature);

  const upUrl = `https://api.cloudinary.com/v1_1/${cloud}/raw/upload`;
  const r = await fetch(upUrl, { method:"POST", body: form });
  const text = await r.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch {}
  return { ok:r.ok, status:r.status, json:parsed, text };
}

async function getNextSerial({ cloud, auth, folder, baseRid }){
  let max = 0;
  let nextCursor = undefined;

  // 一般一天筆數不會超過 500；保留分頁，避免大量資料時抓不完整。
  do{
    const expr = `public_id="${escapeExpr(`${folder}/${baseRid}-`)}*" AND resource_type=raw AND type=upload`;
    const r = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/resources/search`, {
      method:"POST",
      headers:{ Authorization:auth, "Content-Type":"application/json", "Cache-Control":"no-store" },
      body: JSON.stringify({
        expression: expr,
        max_results: 500,
        next_cursor: nextCursor,
        sort_by: [{ public_id:"desc" }]
      })
    });

    if (!r.ok) break;
    const data = await r.json().catch(()=>({}));
    for (const item of (data.resources || [])){
      const id = String(item.public_id || "").split("/").pop();
      const m = id.match(new RegExp(`^${escapeRe(baseRid)}-(\\d{3,})$`));
      if (m) max = Math.max(max, parseInt(m[1], 10) || 0);
    }
    nextCursor = data.next_cursor || undefined;
  }while(nextCursor);

  return max + 1;
}

function getYmd(timeZone){
  try{
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year:"numeric",
      month:"2-digit",
      day:"2-digit"
    }).formatToParts(new Date());
    const get = (type)=>parts.find(p=>p.type===type)?.value || "";
    return `${get("year")}${get("month")}${get("day")}`;
  }catch{
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  }
}

function signParams(params, apiSecret){
  const entries = Object.entries(params)
    .filter(([,v])=>v!==undefined && v!==null && v!=="")
    .sort((a,b)=>a[0].localeCompare(b[0]))
    .map(([k,v])=>`${k}=${v}`)
    .join("&");
  return crypto.createHash("sha1").update(entries + apiSecret).digest("hex");
}

function escapeExpr(s){ return String(s||"").replace(/(["\\])/g,"\\$1"); }
function escapeRe(s){ return String(s||"").replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }
function normalizeBaseUrl(url){ return String(url || "").replace(/\/+$/, ""); }
function resp(status, text){ return { statusCode: status, body: text }; }
function json(status, obj){ return { statusCode: status, headers: { "Content-Type":"application/json" }, body: JSON.stringify(obj) }; }
function getBaseUrl(event){
  try{
    const proto = (event.headers["x-forwarded-proto"] || "https");
    const host = event.headers["x-forwarded-host"] || event.headers["host"];
    return host ? `${proto}://${host}` : "";
  }catch{ return ""; }
}
