// Public endpoint authenticated via x-api-key header.
// Upserts products by SKU within the shop owning that key.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const headers = { ...corsHeaders, "Content-Type": "application/json" };

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomBarcode() {
  return "B" + Math.floor(Math.random() * 1e12).toString().padStart(12, "0");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  try {
    const apiKey = req.headers.get("x-api-key") || req.headers.get("X-Api-Key");
    if (!apiKey) return new Response(JSON.stringify({ error: "Missing x-api-key" }), { status: 401, headers });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const keyHash = await sha256Hex(apiKey);
    const { data: keyRow } = await supabase
      .from("shop_api_keys").select("id, shop_id").eq("key_hash", keyHash).maybeSingle();
    if (!keyRow) return new Response(JSON.stringify({ error: "Invalid api key" }), { status: 401, headers });

    await supabase.from("shop_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id);

    const body = await req.json().catch(() => ({}));
    const items: any[] = Array.isArray(body?.products) ? body.products : [];
    if (items.length === 0) return new Response(JSON.stringify({ created: 0, updated: 0 }), { headers });

    let created = 0, updated = 0, failed = 0;

    for (const it of items) {
      const sku = String(it?.sku ?? "").trim();
      const name = String(it?.name ?? "").trim();
      if (!sku || !name) { failed++; continue; }

      const payload: Record<string, any> = {
        shop_id: keyRow.shop_id,
        name,
        sku,
        price: Number(it.price ?? 0) || 0,
        stock: Number(it.stock ?? 0) || 0,
        low_stock_threshold: Number(it.low_stock_threshold ?? 5) || 5,
        unit: String(it.unit ?? "pcs") || "pcs",
        category: it.category ? String(it.category) : null,
        barcode: it.barcode ? String(it.barcode) : randomBarcode(),
      };

      const { data: existing } = await supabase
        .from("products").select("id").eq("shop_id", keyRow.shop_id).eq("sku", sku).maybeSingle();

      if (existing) {
        const { error } = await supabase.from("products").update({
          name: payload.name, price: payload.price, stock: payload.stock,
          low_stock_threshold: payload.low_stock_threshold, unit: payload.unit,
          category: payload.category,
        }).eq("id", existing.id);
        if (error) failed++; else updated++;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) failed++; else created++;
      }
    }

    return new Response(JSON.stringify({ created, updated, failed }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers });
  }
});
