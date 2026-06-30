// User-initiated two-way sync. Pulls products from the remote app and upserts
// locally, then pushes local products to the remote app.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const headers = { ...corsHeaders, "Content-Type": "application/json" };

function randomBarcode() {
  return "B" + Math.floor(Math.random() * 1e12).toString().padStart(12, "0");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const token = auth.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }
    const userId = claimsData.claims.sub;

    const body = await req.json().catch(() => ({}));
    const shopId = String(body?.shop_id ?? "");
    let remoteBaseUrl = String(body?.remote_base_url ?? "").replace(/\/+$/, "");
    const remoteApiKey = String(body?.remote_api_key ?? "");
    if (!shopId || !remoteBaseUrl || !remoteApiKey) {
      return new Response(JSON.stringify({ error: "shop_id, remote_base_url and remote_api_key are required" }), { status: 400, headers });
    }

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // authorize user as owner/manager of the shop
    const { data: roleOk } = await service.rpc("has_shop_role", {
      _user_id: userId, _shop_id: shopId, _roles: ["owner", "manager"],
    });
    if (!roleOk) return new Response(JSON.stringify({ error: "Not authorized for this shop" }), { status: 403, headers });

    // Normalize remote base: accept either "https://x.functions.supabase.co" or full ref host.
    // Endpoints: GET {base}/catalog-export, POST {base}/catalog-upsert
    const exportUrl = `${remoteBaseUrl}/catalog-export`;
    const upsertUrl = `${remoteBaseUrl}/catalog-upsert`;

    // 1. PULL from remote
    let pulled = 0, pullCreated = 0, pullUpdated = 0, pullFailed = 0;
    const pullRes = await fetch(exportUrl, { headers: { "x-api-key": remoteApiKey } });
    if (!pullRes.ok) {
      const txt = await pullRes.text();
      return new Response(JSON.stringify({ error: `Pull failed (${pullRes.status}): ${txt}` }), { status: 502, headers });
    }
    const pullJson = await pullRes.json();
    const remoteProducts: any[] = Array.isArray(pullJson?.products) ? pullJson.products : [];
    pulled = remoteProducts.length;

    for (const it of remoteProducts) {
      const sku = String(it?.sku ?? "").trim();
      const name = String(it?.name ?? "").trim();
      if (!sku || !name) { pullFailed++; continue; }
      const { data: existing } = await service
        .from("products").select("id").eq("shop_id", shopId).eq("sku", sku).maybeSingle();
      const payload: Record<string, any> = {
        shop_id: shopId, name, sku,
        price: Number(it.price ?? 0) || 0,
        stock: Number(it.stock ?? 0) || 0,
        low_stock_threshold: Number(it.low_stock_threshold ?? 5) || 5,
        unit: String(it.unit ?? "pcs") || "pcs",
        category: it.category ? String(it.category) : null,
        barcode: it.barcode ? String(it.barcode) : randomBarcode(),
      };
      if (existing) {
        const { error } = await service.from("products").update({
          name: payload.name, price: payload.price, stock: payload.stock,
          low_stock_threshold: payload.low_stock_threshold, unit: payload.unit,
          category: payload.category,
        }).eq("id", existing.id);
        if (error) pullFailed++; else pullUpdated++;
      } else {
        const { error } = await service.from("products").insert(payload);
        if (error) pullFailed++; else pullCreated++;
      }
    }

    // 2. PUSH to remote
    const { data: localProducts, error: lpErr } = await service
      .from("products")
      .select("name, sku, barcode, category, unit, price, stock, low_stock_threshold")
      .eq("shop_id", shopId);
    if (lpErr) {
      return new Response(JSON.stringify({ error: `Local read failed: ${lpErr.message}` }), { status: 500, headers });
    }

    let pushed = 0, pushCreated = 0, pushUpdated = 0, pushFailed = 0;
    pushed = localProducts?.length ?? 0;
    if (pushed > 0) {
      const pushRes = await fetch(upsertUrl, {
        method: "POST",
        headers: { "x-api-key": remoteApiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ products: localProducts }),
      });
      const pushTxt = await pushRes.text();
      if (!pushRes.ok) {
        return new Response(JSON.stringify({ error: `Push failed (${pushRes.status}): ${pushTxt}` }), { status: 502, headers });
      }
      try {
        const pushJson = JSON.parse(pushTxt);
        pushCreated = pushJson.created ?? 0;
        pushUpdated = pushJson.updated ?? 0;
        pushFailed = pushJson.failed ?? 0;
      } catch { /* ignore */ }
    }

    const status = `pulled ${pulled} (${pullCreated} new, ${pullUpdated} updated), pushed ${pushed} (${pushCreated} new, ${pushUpdated} updated)`;
    await service.from("shop_sync_settings").upsert({
      shop_id: shopId,
      remote_base_url: remoteBaseUrl,
      remote_api_key: remoteApiKey,
      last_sync_at: new Date().toISOString(),
      last_sync_status: status,
    });

    return new Response(JSON.stringify({
      ok: true,
      pull: { received: pulled, created: pullCreated, updated: pullUpdated, failed: pullFailed },
      push: { sent: pushed, created: pushCreated, updated: pushUpdated, failed: pushFailed },
      summary: status,
    }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers });
  }
});
