
-- API keys minted by a shop for external apps
CREATE TABLE public.shop_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'External sync',
  key_prefix text NOT NULL,            -- first 8 chars, shown in UI for identification
  key_hash text NOT NULL,              -- sha256 hex of full key
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE INDEX shop_api_keys_shop_idx ON public.shop_api_keys(shop_id);
CREATE INDEX shop_api_keys_hash_idx ON public.shop_api_keys(key_hash);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_api_keys TO authenticated;
GRANT ALL ON public.shop_api_keys TO service_role;
ALTER TABLE public.shop_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their shop api keys" ON public.shop_api_keys
FOR SELECT TO authenticated
USING (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role]));

CREATE POLICY "Owners create their shop api keys" ON public.shop_api_keys
FOR INSERT TO authenticated
WITH CHECK (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role]));

CREATE POLICY "Owners delete their shop api keys" ON public.shop_api_keys
FOR DELETE TO authenticated
USING (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role]));

-- Sync settings (remote endpoint + remote api key) per shop
CREATE TABLE public.shop_sync_settings (
  shop_id uuid PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  remote_base_url text,
  remote_api_key text,
  last_sync_at timestamptz,
  last_sync_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_sync_settings TO authenticated;
GRANT ALL ON public.shop_sync_settings TO service_role;
ALTER TABLE public.shop_sync_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view sync settings" ON public.shop_sync_settings
FOR SELECT TO authenticated
USING (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role]));

CREATE POLICY "Owners upsert sync settings" ON public.shop_sync_settings
FOR INSERT TO authenticated
WITH CHECK (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role]));

CREATE POLICY "Owners update sync settings" ON public.shop_sync_settings
FOR UPDATE TO authenticated
USING (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role]))
WITH CHECK (public.has_shop_role(auth.uid(), shop_id, ARRAY['owner'::shop_role]));

CREATE TRIGGER shop_sync_settings_updated
BEFORE UPDATE ON public.shop_sync_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
