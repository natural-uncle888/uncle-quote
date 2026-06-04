// netlify/functions/list.js
// Optimized for this project: quote JSON is uploaded as Cloudinary raw/upload under quotes/q-*
// This avoids scanning raw/image/video × upload/authenticated/private, which can trigger Cloudinary 420 rate limits.

export async function handler(event) {
  try {
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const FOLDER = process.env.CLOUDINARY_FOLDER || "quotes";
    const PREFIX = process.env.QUOTE_PREFIX || "q-";
    if (!cloud || !apiKey || !apiSecret) return json(500, { error: "Missing Cloudinary config" });

    const qp = event.queryStringParameters || {};
    const per = Math.min(parseInt(qp.per || "50", 10) || 50, 100);
    const cursor = parseCursor(qp.next || "");
    const disablePrefix = qp.noprefix === "1";
    const auth = "Basic " + Buffer.from(apiKey + ":" + apiSecret).toString("base64");
    const fullPrefix = disablePrefix ? `${FOLDER}/` : `${FOLDER}/${PREFIX}`;

    let resources = [];
    let nextCur = "";
    let total = 0;
    let totalKnown = false;

    // 1) Prefer Cloudinary Search API, but only for raw/upload quote JSON files.
    try {
      const expr = disablePrefix
        ? `folder="${escapeExpr(FOLDER)}" AND resource_type=raw AND type=upload`
        : `public_id="${escapeExpr(fullPrefix)}*" AND resource_type=raw AND type=upload`;

      const sres = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/resources/search`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({
          expression: expr,
          max_results: per,
          next_cursor: cursor.raw_upload || undefined,
          sort_by: [{ public_id: "desc" }]
        })
      });

      if (sres.ok) {
        const data = await sres.json().catch(() => ({}));
        resources = data.resources || [];
        nextCur = data.next_cursor || "";
        if (typeof data.total_count === "number") { total = data.total_count; totalKnown = true; }
      } else if (sres.status === 420 || sres.status === 429) {
        return json(429, {
          error: "Cloudinary API rate limited",
          detail: "Cloudinary 暫時限制查詢次數。請稍後再重新整理，或確認 Cloudinary 方案/用量。",
          status: sres.status
        });
      }
    } catch (_) {
      // Fall back below.
    }

    // 2) Fallback: Admin API prefix, still raw/upload only.
    if (!resources.length) {
      const url = new URL(`https://api.cloudinary.com/v1_1/${cloud}/resources/raw/upload`);
      url.searchParams.set("prefix", fullPrefix);
      url.searchParams.set("max_results", String(per));
      if (cursor.raw_upload) url.searchParams.set("next_cursor", cursor.raw_upload);

      const ares = await fetch(url.toString(), { headers: { Authorization: auth, "Cache-Control": "no-store" } });
      if (!ares.ok) {
        const detail = await safeText(ares);
        const status = (ares.status === 420 || ares.status === 429) ? 429 : ares.status;
        return json(status, {
          error: status === 429 ? "Cloudinary API rate limited" : "Cloudinary Admin API failed",
          detail,
          resource_type: "raw",
          type: "upload"
        });
      }
      const data = await ares.json().catch(() => ({}));
      resources = data.resources || [];
      nextCur = data.next_cursor || "";
      totalKnown = false;
    }

    const items = resources.map((rsc) => {
      const pid = String(rsc.public_id || "").replace(/^\/+/, "");
      const id = pid.replace(new RegExp(`^${escapeRe(FOLDER)}/?`), "") || pid;
      return {
        id,
        public_id: rsc.public_id,
        created_at: rsc.created_at,
        bytes: rsc.bytes,
        format: rsc.format,
        filename: rsc.filename,
        resource_type: "raw",
        type: "upload",
        link: buildSiteLink(event, id)
      };
    }).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const next = nextCur ? serializeCursor({ raw_upload: nextCur }) : serializeCursor({ raw_upload: "__END__" });
    return json(200, { items, next, _total: total, _total_known: totalKnown });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
}

function buildSiteLink(event, id){
  const base = getBaseUrl(event) || (process.env.SITE_BASE_URL || "");
  const u = (base || "").replace(/\/+$/, "");
  const shortCode = String(id || "").replace(/^q-/i, "");
  if (/^\d{8}-\d{3,}$/.test(shortCode)) return `${u}/${encodeURIComponent(shortCode)}`;
  return `${u}/q/${encodeURIComponent(shortCode)}`;
}
function json(statusCode, obj){ return { statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(obj) }; }
async function safeText(res){ try{ return await res.text(); }catch{ return "(no body)"; } }
function parseCursor(s){ try { const obj = JSON.parse(Buffer.from(String(s||""), "base64").toString("utf8")) || {}; return obj.raw_upload === "__END__" ? {} : obj; } catch { return {}; } }
function serializeCursor(obj){ try { return Buffer.from(JSON.stringify(obj||{}), "utf8").toString("base64"); } catch { return ""; } }
function escapeExpr(s){ return String(s||"").replace(/"/g,'\\\"'); }
function escapeRe(s){ return String(s||"").replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function getBaseUrl(event){
  try{
    const proto = (event.headers["x-forwarded-proto"] || "https");
    const host = (event.headers["x-forwarded-host"] || event.headers["host"] || "").split(",")[0].trim();
    return host ? `${proto}://${host}` : "";
  }catch{ return ""; }
}
