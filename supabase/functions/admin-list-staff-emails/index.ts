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
    const auth = req.headers.get('Authorization') ?? '';
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: ures } = await userClient.auth.getUser();
    if (!ures.user) return json({ error: 'Unauthorized' }, 401);

    const { shop_id } = await req.json();
    if (!shop_id) return json({ error: 'shop_id required' }, 400);

    const admin = createClient(url, service);
    const { data: caller } = await admin.from('shop_members')
      .select('role').eq('shop_id', shop_id).eq('user_id', ures.user.id).maybeSingle();
    if (!caller || !['owner', 'manager'].includes(caller.role)) {
      return json({ error: 'Forbidden' }, 403);
    }

    const { data: members } = await admin.from('shop_members').select('user_id').eq('shop_id', shop_id);
    const ids = (members ?? []).map((m: any) => m.user_id);
    const out: Record<string, string> = {};
    // listUsers paginates; small shops fit easily on first page
    let page = 1;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) break;
      for (const u of data.users) if (ids.includes(u.id)) out[u.id] = u.email ?? '';
      if (data.users.length < 200) break;
      page++;
      if (page > 20) break;
    }
    return json({ emails: out });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
