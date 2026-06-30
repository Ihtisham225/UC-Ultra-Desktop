import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

interface Body { sale_id: string; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ---- auth ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    // ---- input ----
    const body = (await req.json()) as Body;
    if (!body?.sale_id) return json({ error: "sale_id required" }, 400);

    // ---- secrets ----
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    const TWILIO_WHATSAPP_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM");
    if (!LOVABLE_API_KEY || !TWILIO_API_KEY || !TWILIO_WHATSAPP_FROM) {
      return json({
        error: "Twilio is not configured yet. Connect Twilio and set TWILIO_WHATSAPP_FROM secret.",
        configured: false,
      }, 503);
    }

    // ---- fetch sale (RLS enforces shop membership) ----
    const { data: sale, error: saleErr } = await supabase
      .from("sales")
      .select("id, shop_id, total, subtotal, tax, receipt_number, customer_id, created_at, shops(name, currency, receipt_footer, is_pro, pro_until), customers(name, phone)")
      .eq("id", body.sale_id)
      .maybeSingle();
    if (saleErr || !sale) return json({ error: "Sale not found" }, 404);

    // ---- gate by Pro plan ----
    const shopRow = (sale as any).shops;
    const proActive = shopRow?.is_pro && (!shopRow?.pro_until || new Date(shopRow.pro_until) > new Date());
    if (!proActive) {
      return json({
        error: "Sending receipts on WhatsApp is a Pro feature. Upgrade your shop to send WhatsApp messages.",
        upgrade_required: true,
      }, 402);
    }

    const customer = (sale as any).customers;
    if (!customer?.phone) return json({ error: "Customer has no phone number" }, 400);

    const { data: items } = await supabase
      .from("sale_items")
      .select("product_name, quantity, unit_price, line_total")
      .eq("sale_id", sale.id);

    const shop = (sale as any).shops;
    const currency = shop?.currency ?? "USD";
    const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(n));

    const itemLines = (items ?? []).map((i: any) => `• ${i.product_name} x${i.quantity} — ${fmt(i.line_total)}`).join("\n");
    const receiptText = [
      `🧾 *${shop?.name ?? "Receipt"}*`,
      `Receipt: ${sale.receipt_number ?? sale.id.slice(0, 8)}`,
      ``,
      itemLines,
      ``,
      `Subtotal: ${fmt(Number(sale.subtotal))}`,
      Number(sale.tax) > 0 ? `Tax: ${fmt(Number(sale.tax))}` : "",
      `*Total: ${fmt(Number(sale.total))}*`,
      shop?.receipt_footer ? `\n${shop.receipt_footer}` : "",
    ].filter(Boolean).join("\n");

    const thankYou = `Thanks for shopping at ${shop?.name ?? "us"}, ${customer.name}! 🙏 We hope to see you again.`;

    // normalize phone to E.164-ish: keep '+' and digits
    const toNumber = customer.phone.toString().replace(/[^\d+]/g, "");
    if (!toNumber) return json({ error: "Invalid phone" }, 400);

    const sendMessage = async (text: string, kind: "receipt" | "thank_you") => {
      const params = new URLSearchParams({
        To: `whatsapp:${toNumber.startsWith("+") ? toNumber : "+" + toNumber}`,
        From: `whatsapp:${TWILIO_WHATSAPP_FROM}`,
        Body: text,
      });
      const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": TWILIO_API_KEY,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      });
      const data = await res.json();
      const ok = res.ok;
      await supabase.from("sale_notifications").insert({
        sale_id: sale.id,
        shop_id: sale.shop_id,
        channel: "whatsapp",
        kind,
        to_address: toNumber,
        provider_sid: data?.sid ?? null,
        status: ok ? (data?.status ?? "sent") : "failed",
        error: ok ? null : (data?.message ?? `HTTP ${res.status}`),
      });
      if (!ok) throw new Error(data?.message ?? `Twilio ${res.status}`);
      return data;
    };

    await sendMessage(receiptText, "receipt");
    await sendMessage(thankYou, "thank_you");

    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
