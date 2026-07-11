import { useEffect, useRef, useState } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Store, UserCircle2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { getRememberedLogin, saveRememberedLogin } from "@/lib/rememberedAuth";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function Auth() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [rememberedLogin, setRememberedLogin] = useState(() => getRememberedLogin());
  const [signInEmail, setSignInEmail] = useState(() => getRememberedLogin()?.email ?? "");
  const passwordRef = useRef<HTMLInputElement | null>(null);

  usePageMeta({
    title: "Sign in to UCU — Run your shop from one platform",
    description: "Sign in or create your UCU account to manage products, sales, customers and staff from any device.",
    path: "/auth",
  });

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const raw = String(fd.get("email")).trim();
    const password = String(fd.get("password"));
    setBusy(true);
    try {
      // The backend accepts email OR staff username directly.
      await signIn(raw, password);
      saveRememberedLogin(raw, "password");
      setRememberedLogin(getRememberedLogin());
      navigate("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid username or password");
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // New shops are created on the web (onboarding). The desktop signs in
    // existing accounts and syncs.
    toast.message("Create your shop at ucultra.com, then sign in here.");
  };

  const handleGoogle = async () => {
    // Google OAuth runs in the browser flow on the web app.
    toast.message("Sign in with Google on ucultra.com, then use your email + password here.");
  };


  const useRememberedLogin = async () => {
    if (!rememberedLogin) return;

    if (rememberedLogin.provider === "google") {
      await handleGoogle();
      return;
    }

    setSignInEmail(rememberedLogin.email);
    requestAnimationFrame(() => passwordRef.current?.focus());
    toast.message(t("auth.useDifferentAccount"));
  };

  return (
    <main
      className="min-h-screen bg-gradient-surface relative"
      style={{
        paddingTop: "max(0px, env(safe-area-inset-top))",
        paddingBottom: "max(0px, env(safe-area-inset-bottom))",
      }}
    >
      <div className="absolute end-4 top-4 z-10 flex items-center gap-1.5">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 size-[500px] rounded-full bg-gradient-primary opacity-20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 size-[500px] rounded-full bg-gradient-accent opacity-20 blur-3xl" />
      </div>

      <div className="min-h-screen container mx-auto px-4 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center py-10">
        {/* Left: Brand lockup (hidden on small screens) */}
        <section className="hidden lg:flex flex-col justify-between min-h-[600px] pe-4">
          <div className="flex items-center gap-3">
            <Logo size="lg" />
            <div>
              <div className="font-bold text-2xl leading-tight">{t("app.name")}</div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {t("app.tagline")}
              </div>
            </div>
          </div>

          {/* Floating cartoon collage */}
          <div className="relative h-[420px] w-full">
            {/* Big phone-style card with cashier */}
            <div className="absolute left-1/2 top-2 -translate-x-1/2 w-56 h-80 rounded-3xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 shadow-elevated p-3 rotate-[-4deg] text-primary">
              <div className="h-1.5 w-12 rounded-full bg-primary/30 mx-auto mb-3" />
              <CartoonCashier />
              <div className="absolute top-3 right-3 px-2 py-1 rounded-md bg-primary text-primary-foreground text-[10px] font-bold">POS</div>
            </div>

            {/* Smaller card with owner */}
            <div className="absolute left-2 top-24 w-40 h-44 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/30 shadow-elevated p-2 rotate-[-10deg] text-accent-foreground">
              <CartoonOwner />
            </div>

            {/* Receipt card with customer */}
            <div className="absolute left-6 bottom-0 w-44 h-36 rounded-2xl bg-gradient-to-br from-success/15 to-success/5 border border-success/20 shadow-elevated p-2 rotate-[6deg] text-success">
              <div className="flex items-center gap-2 px-1 pb-1">
                <div className="size-5 rounded-md bg-success/20 grid place-items-center">
                  <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div className="h-1.5 flex-1 rounded-full bg-success/20" />
              </div>
              <CartoonCustomer />
            </div>

            {/* Floating smile bubble */}
            <div className="absolute right-6 top-4 size-14 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 shadow-elevated grid place-items-center rotate-12">
              <svg viewBox="0 0 24 24" className="size-9 text-amber-900" fill="currentColor"><circle cx="9" cy="10" r="1.5"/><circle cx="15" cy="10" r="1.5"/><path d="M7 14c1.5 2 3 3 5 3s3.5-1 5-3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
            </div>

            {/* Floating heart bubble */}
            <div className="absolute right-2 bottom-10 size-14 rounded-full bg-gradient-to-br from-rose-500 to-rose-600 shadow-elevated grid place-items-center -rotate-6">
              <svg viewBox="0 0 24 24" className="size-7 text-white" fill="currentColor"><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0112 5a5.5 5.5 0 019.5 7c-2.5 4.5-9.5 9-9.5 9z"/></svg>
            </div>

            {/* Floating tag */}
            <div className="absolute right-10 top-44 px-3 py-1.5 rounded-xl bg-card border shadow-elevated text-[11px] font-bold rotate-[8deg]">
              <span className="text-primary">★</span> 50% OFF
            </div>

            {/* Soft background blobs */}
            <div className="absolute -z-10 inset-0">
              <div className="absolute top-10 left-10 size-40 rounded-full bg-primary/10 blur-2xl" />
              <div className="absolute bottom-0 right-10 size-48 rounded-full bg-accent/10 blur-2xl" />
            </div>
          </div>

          <div>
            <h1 className="text-5xl xl:text-6xl font-bold tracking-tight leading-[1.05] max-w-xl">
              Run your <br />
              entire shop <br />
              <span className="text-primary">from one platform.</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-4 max-w-md">
              Loved by shop owners, cashiers and customers across Pakistan.
            </p>
          </div>
        </section>

        {/* Right: Auth card */}
        <section className="w-full max-w-md mx-auto lg:mx-0 lg:ms-auto">
          <Link to="/auth" className="flex items-center gap-2.5 justify-center mb-6 lg:hidden">
            <Logo size="lg" />
            <div>
              <div className="font-bold text-xl leading-tight">{t("app.name")}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("app.tagline")}</div>
            </div>
          </Link>


        <div className="bg-card border rounded-2xl shadow-elevated p-6">
          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 w-full mb-6">
              <TabsTrigger value="signin">{t("auth.signInTab")}</TabsTrigger>
              <TabsTrigger value="signup">{t("auth.signUpTab")}</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-4">
              {rememberedLogin && (
                <Button type="button" variant="outline" className="w-full justify-start" size="lg" onClick={useRememberedLogin} disabled={busy}>
                  <UserCircle2 className="size-4 me-2" />
                  {t("auth.rememberedAs", { email: rememberedLogin.email })}
                </Button>
              )}
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="si-email">Email or username</Label>
                  <Input id="si-email" name="email" type="text" required autoComplete="username" placeholder="you@example.com or username" value={signInEmail} onChange={(e) => setSignInEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="si-password">{t("common.password")}</Label>
                    <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                      {t("auth.forgotPassword")}
                    </Link>
                  </div>
                  <PasswordInput ref={passwordRef} id="si-password" name="password" required autoComplete="current-password" />
                </div>
                <Button disabled={busy} className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground" size="lg">
                  {busy ? t("common.loading") : t("common.signIn")}
                </Button>
              </form>

              <GoogleDivider label={t("auth.or")} />
              <Button type="button" variant="outline" className="w-full" size="lg" onClick={handleGoogle} disabled={busy}>
                <GoogleIcon /> {t("auth.googleSignIn")}
              </Button>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 flex items-start gap-2 text-xs text-muted-foreground">
                <Store className="size-4 mt-0.5 text-primary shrink-0" />
                <p>{t("auth.ownerOnlyHint")}</p>
              </div>

              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="su-name">{t("auth.nameLabel")}</Label>
                  <Input id="su-name" name="name" required placeholder={t("auth.namePlaceholder")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="su-email">{t("common.email")}</Label>
                  <Input id="su-email" name="email" type="email" required autoComplete="email" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="su-password">{t("common.password")}</Label>
                  <PasswordInput id="su-password" name="password" required minLength={8} autoComplete="new-password" />
                </div>
                <Button disabled={busy} className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground" size="lg">
                  {busy ? t("common.loading") : t("auth.createAccount")}
                </Button>
              </form>

              <GoogleDivider label={t("auth.or")} />
              <Button type="button" variant="outline" className="w-full" size="lg" onClick={handleGoogle} disabled={busy}>
                <GoogleIcon /> {t("auth.googleSignUp")}
              </Button>
            </TabsContent>
          </Tabs>
        </div>

          <p className="text-xs text-center text-muted-foreground mt-6">
            By continuing you agree to our{" "}
            <Link to="/terms" className="underline hover:text-foreground">Terms</Link>,{" "}
            <Link to="/privacy" className="underline hover:text-foreground">Privacy Notice</Link>, and{" "}
            <Link to="/refunds" className="underline hover:text-foreground">Refund Policy</Link>.
          </p>
          <p className="text-[11px] text-center text-muted-foreground mt-2">
            See <Link to="/pricing" className="underline hover:text-foreground">pricing</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}

const GoogleDivider = ({ label = "or" }: { label?: string }) => (
  <div className="relative flex items-center my-2">
    <div className="flex-1 border-t" />
    <span className="px-2 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
    <div className="flex-1 border-t" />
  </div>
);

const GoogleIcon = () => (
  <svg className="size-4 me-2" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
  </svg>
);

const accentMap = {
  primary: "from-primary/15 to-primary/5 text-primary border-primary/20",
  accent: "from-accent/20 to-accent/5 text-accent-foreground border-accent/30",
  success: "from-success/15 to-success/5 text-success border-success/20",
} as const;

const CartoonCard = ({ children, label, accent }: { children: React.ReactNode; label: string; accent: keyof typeof accentMap }) => (
  <div className={`relative rounded-2xl border bg-gradient-to-br ${accentMap[accent]} aspect-square p-3 flex flex-col items-center justify-center gap-2 transition-transform hover:-translate-y-1 hover:shadow-elevated`}>
    <div className="flex-1 w-full flex items-center justify-center">{children}</div>
    <span className="text-[11px] font-semibold tracking-wide text-foreground/80">{label}</span>
  </div>
);

// Cartoons use currentColor + semantic tokens so they swap with theme
const CartoonOwner = () => (
  <svg viewBox="0 0 120 120" className="w-full h-full" aria-hidden="true">
    <circle cx="60" cy="62" r="48" className="fill-background/60" />
    {/* head */}
    <circle cx="60" cy="48" r="16" fill="currentColor" opacity="0.9" />
    {/* glasses */}
    <circle cx="54" cy="47" r="3.5" className="fill-background" />
    <circle cx="66" cy="47" r="3.5" className="fill-background" />
    {/* smile */}
    <path d="M53 54 Q60 60 67 54" stroke="hsl(var(--background))" strokeWidth="2" fill="none" strokeLinecap="round" />
    {/* apron / body */}
    <path d="M30 100 Q30 75 60 75 Q90 75 90 100 Z" fill="currentColor" opacity="0.7" />
    {/* tablet */}
    <rect x="48" y="82" width="24" height="16" rx="2" className="fill-background" />
    <rect x="51" y="85" width="18" height="2" className="fill-current opacity-60" />
    <rect x="51" y="89" width="12" height="2" className="fill-current opacity-40" />
  </svg>
);

const CartoonCashier = () => (
  <svg viewBox="0 0 120 120" className="w-full h-full" aria-hidden="true">
    <circle cx="60" cy="62" r="48" className="fill-background/60" />
    {/* head with ponytail */}
    <circle cx="60" cy="46" r="15" fill="currentColor" opacity="0.9" />
    <circle cx="74" cy="50" r="5" fill="currentColor" opacity="0.7" />
    {/* eyes */}
    <circle cx="55" cy="45" r="1.6" className="fill-background" />
    <circle cx="65" cy="45" r="1.6" className="fill-background" />
    {/* smile */}
    <path d="M54 52 Q60 57 66 52" stroke="hsl(var(--background))" strokeWidth="2" fill="none" strokeLinecap="round" />
    {/* body */}
    <path d="M34 100 Q34 74 60 74 Q86 74 86 100 Z" fill="currentColor" opacity="0.7" />
    {/* register */}
    <rect x="44" y="86" width="32" height="14" rx="2" className="fill-background" />
    <rect x="48" y="90" width="6" height="3" className="fill-current opacity-60" />
    <rect x="56" y="90" width="6" height="3" className="fill-current opacity-60" />
    <rect x="64" y="90" width="6" height="3" className="fill-current opacity-60" />
  </svg>
);

const CartoonCustomer = () => (
  <svg viewBox="0 0 120 120" className="w-full h-full" aria-hidden="true">
    <circle cx="60" cy="62" r="48" className="fill-background/60" />
    {/* head */}
    <circle cx="60" cy="44" r="14" fill="currentColor" opacity="0.9" />
    {/* eyes */}
    <circle cx="55" cy="43" r="1.6" className="fill-background" />
    <circle cx="65" cy="43" r="1.6" className="fill-background" />
    {/* big smile */}
    <path d="M53 49 Q60 57 67 49" stroke="hsl(var(--background))" strokeWidth="2" fill="none" strokeLinecap="round" />
    {/* body */}
    <path d="M36 100 Q36 72 60 72 Q84 72 84 100 Z" fill="currentColor" opacity="0.7" />
    {/* shopping bag */}
    <rect x="48" y="84" width="24" height="20" rx="2" className="fill-background" />
    <path d="M53 84 V80 Q53 76 60 76 Q67 76 67 80 V84" stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M54 92 H66" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
  </svg>
);
