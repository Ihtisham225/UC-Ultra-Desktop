import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STAFF_EMAIL_DOMAIN = 'staff.ucu.local';

function genPassword(): string {
  const c = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let o = ''; const b = new Uint8Array(14); crypto.getRandomValues(b);
  for (const x of b) o += c[x % c.length];
  return o + '!9';
}

function slugifyName(name: string): string {
  const s = name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '').slice(0, 16);
  return s || 'user';
}

function randSuffix(n = 4): string {
  const c = '0123456789'; let o = ''; const b = new Uint8Array(n);
  crypto.getRandomValues(b); for (const x of b) o += c[x % c.length]; return o;
}

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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

    const { full_name, role_id, shop_id } = await req.json();
    if (!full_name || !String(full_name).trim()) return json({ error: 'Name is required' }, 400);
    if (!role_id || !shop_id) return json({ error: 'role_id and shop_id are required' }, 400);

    const admin = createClient(url, service);

    const { data: callerMember } = await admin.from('shop_members')
      .select('role').eq('shop_id', shop_id).eq('user_id', ures.user.id).maybeSingle();
    if (!callerMember || !['owner', 'manager'].includes(callerMember.role)) {
      return json({ error: 'Only the shop owner or manager can create staff' }, 403);
    }

    const { data: role } = await admin.from('shop_custom_roles')
      .select('id, shop_id').eq('id', role_id).maybeSingle();
    if (!role || role.shop_id !== shop_id) return json({ error: 'Invalid role' }, 400);

    // Generate a unique username
    const base = slugifyName(full_name);
    let username = base;
    for (let i = 0; i < 8; i++) {
      const { data: exists } = await admin.from('profiles').select('user_id').eq('username', username).maybeSingle();
      if (!exists) break;
      username = `${base}${randSuffix(4)}`;
    }
    const email = `${username}@${STAFF_EMAIL_DOMAIN}`;
    const tempPassword = genPassword();

    const created = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { display_name: full_name, created_by_admin: true, username },
    });
    if (created.error) return json({ error: created.error.message }, 400);
    const userId = created.data.user!.id;

    await admin.from('profiles').upsert({
      user_id: userId,
      display_name: full_name,
      username,
      must_change_password: true,
    }, { onConflict: 'user_id' });

    const { error: mErr } = await admin.from('shop_members').insert({
      shop_id, user_id: userId, role: 'cashier',
    });
    if (mErr) return json({ error: mErr.message }, 400);

    const { error: aErr } = await admin.from('shop_user_role_assignments').insert({
      shop_id, user_id: userId, role_id,
    });
    if (aErr) return json({ error: aErr.message }, 400);

    return json({ user_id: userId, username, temp_password: tempPassword });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
