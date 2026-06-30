import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

function gen(): string {
  const c = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let o = ''; const b = new Uint8Array(14); crypto.getRandomValues(b);
  for (const x of b) o += c[x % c.length];
  return o + '!9';
}

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
    if (!user_id || !shop_id) return json({ error: 'Bad request' }, 400);

    const admin = createClient(url, service);
    const { data: caller } = await admin.from('shop_members')
      .select('role').eq('shop_id', shop_id).eq('user_id', ures.user.id).maybeSingle();
    if (!caller || !['owner','manager'].includes(caller.role)) return json({ error: 'Forbidden' }, 403);

    const { data: target } = await admin.from('shop_members')
      .select('id').eq('shop_id', shop_id).eq('user_id', user_id).maybeSingle();
    if (!target) return json({ error: 'Member not found' }, 404);

    const tempPassword = gen();
    const { error } = await admin.auth.admin.updateUserById(user_id, { password: tempPassword });
    if (error) return json({ error: error.message }, 400);
    await admin.from('profiles').update({ must_change_password: true }).eq('user_id', user_id);

    return json({ temp_password: tempPassword });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
