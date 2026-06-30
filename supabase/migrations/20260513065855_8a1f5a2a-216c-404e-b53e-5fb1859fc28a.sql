-- Add username to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS profiles_username_lower_idx ON public.profiles ((lower(username)));

-- Resolve a username to its auth email (used for staff login)
CREATE OR REPLACE FUNCTION public.find_email_by_username(_username TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.email::text
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE lower(p.username) = lower(_username)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.find_email_by_username(TEXT) TO anon, authenticated;