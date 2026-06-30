// Public endpoint authenticated via x-api-key header.
// Returns products + stock for the shop owning that key.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const headers = { ...corsHeaders, "Content-Type": "application/json" };

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
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

    const { data: products, error } = await supabase
      .from("products")
      .select("name, sku, barcode, category, unit, price, stock, low_stock_threshold")
      .eq("shop_id", keyRow.shop_id);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });

    return new Response(JSON.stringify({ products: products ?? [] }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers });
  }
});
