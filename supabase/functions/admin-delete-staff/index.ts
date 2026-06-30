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

    const { user_id, shop_id } = await req.json();
    if (!user_id || !shop_id) return json({ error: 'user_id and shop_id required' }, 400);
    if (user_id === ures.user.id) return json({ error: "You can't remove yourself" }, 400);

    const admin = createClient(url, service);
    const { data: caller } = await admin.from('shop_members')
      .select('role').eq('shop_id', shop_id).eq('user_id', ures.user.id).maybeSingle();
    if (!caller || caller.role !== 'owner') return json({ error: 'Only the shop owner can remove staff' }, 403);

    const { data: target } = await admin.from('shop_members')
      .select('role').eq('shop_id', shop_id).eq('user_id', user_id).maybeSingle();
    if (!target) return json({ error: 'Member not found' }, 404);
    if (target.role === 'owner') return json({ error: 'Cannot remove owner' }, 400);

    await admin.from('shop_user_role_assignments').delete().eq('shop_id', shop_id).eq('user_id', user_id);
    await admin.from('shop_members').delete().eq('shop_id', shop_id).eq('user_id', user_id);

    // If the user has no other shop membership, delete the auth user too
    const { data: remaining } = await admin.from('shop_members').select('id').eq('user_id', user_id).limit(1);
    if (!remaining || remaining.length === 0) {
      await admin.from('profiles').delete().eq('user_id', user_id);
      await admin.auth.admin.deleteUser(user_id);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
