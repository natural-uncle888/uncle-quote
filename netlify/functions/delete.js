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

    return resp(200, { ok:true, id });
  }catch(e){
    return resp(500, { error: String(e?.message || e) });
  }
}

function resp(statusCode, json){
  return { statusCode, headers:{ "Content-Type":"application/json", "Cache-Control":"no-store", "Pragma":"no-cache" }, body: JSON.stringify(json) };
}
