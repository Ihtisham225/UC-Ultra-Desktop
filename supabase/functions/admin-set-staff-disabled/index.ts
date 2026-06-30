import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: ures } = await userClient.auth.getUser();
    if (!ures.user) return json({ error: 'Unauthorized' }, 401);

    const { user_id, shop_id, disabled } = await req.json();
    if (!user_id || !shop_id || typeof disabled !== 'boolean') return json({ error: 'Bad request' }, 400);
    if (user_id === ures.user.id) return json({ error: "You can't block yourself" }, 400);

    const admin = createClient(url, service);
    const { data: caller } = await admin.from('shop_members')
      .select('role').eq('shop_id', shop_id).eq('user_id', ures.user.id).maybeSingle();
    if (!caller || !['owner','manager'].includes(caller.role)) return json({ error: 'Forbidden' }, 403);

    const { data: target } = await admin.from('shop_members')
      .select('id, role').eq('shop_id', shop_id).eq('user_id', user_id).maybeSingle();
    if (!target) return json({ error: 'Member not found' }, 404);
    if (target.role === 'owner') return json({ error: 'Cannot block owner' }, 400);

    const { error: uErr } = await admin.from('shop_members').update({ disabled }).eq('id', target.id);
    if (uErr) return json({ error: uErr.message }, 400);

    // Ban / unban auth user only if they are not active in any other shop
    const { data: otherActive } = await admin.from('shop_members')
      .select('id').eq('user_id', user_id).neq('shop_id', shop_id).eq('disabled', false).limit(1);
    if (!otherActive || otherActive.length === 0) {
      await admin.auth.admin.updateUserById(user_id, {
        ban_duration: disabled ? '876000h' : 'none',
      } as any);
    }
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
