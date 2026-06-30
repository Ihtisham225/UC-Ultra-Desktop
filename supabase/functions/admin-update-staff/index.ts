import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STAFF_EMAIL_DOMAIN = 'staff.ucu.local';

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

function normalizeUsername(u: string): string {
  return u.toLowerCase().replace(/[^a-z0-9_]+/g, '').slice(0, 32);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const auth = req.headers.get('Authorization') ?? '';
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: ures } = await userClient.auth.getUser();
    if (!ures.user) return json({ error: 'Unauthorized' }, 401);

    const { user_id, shop_id, full_name, username } = await req.json();
    if (!user_id || !shop_id) return json({ error: 'user_id and shop_id are required' }, 400);

    const admin = createClient(url, service);
    const { data: caller } = await admin.from('shop_members')
      .select('role').eq('shop_id', shop_id).eq('user_id', ures.user.id).maybeSingle();
    if (!caller || !['owner', 'manager'].includes(caller.role)) {
      return json({ error: 'Only the shop owner or manager can edit staff' }, 403);
    }

    const { data: target } = await admin.from('shop_members')
      .select('role').eq('shop_id', shop_id).eq('user_id', user_id).maybeSingle();
    if (!target) return json({ error: 'Member not in this shop' }, 404);
    if (target.role === 'owner' && ures.user.id !== user_id) {
      return json({ error: 'Cannot edit shop owner' }, 403);
    }

    if (typeof full_name === 'string' && full_name.trim()) {
      await admin.from('profiles').update({ display_name: full_name.trim() }).eq('user_id', user_id);
      await admin.auth.admin.updateUserById(user_id, { user_metadata: { display_name: full_name.trim() } });
    }

    if (typeof username === 'string' && username.trim()) {
      const u = normalizeUsername(username);
      if (!u) return json({ error: 'Invalid username' }, 400);
      const { data: clash } = await admin.from('profiles')
        .select('user_id').eq('username', u).neq('user_id', user_id).maybeSingle();
      if (clash) return json({ error: 'Username already taken' }, 409);
      await admin.from('profiles').update({ username: u }).eq('user_id', user_id);
      const newEmail = `${u}@${STAFF_EMAIL_DOMAIN}`;
      const { error } = await admin.auth.admin.updateUserById(user_id, { email: newEmail, email_confirm: true });
      if (error) return json({ error: error.message }, 400);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
