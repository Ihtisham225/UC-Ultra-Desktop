import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";

export default function ForgotPassword() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => { document.title = "Reset password — UCU"; }, []);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setSent(true);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-gradient-surface relative"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="absolute right-4 z-10" style={{ top: "max(1rem, env(safe-area-inset-top))" }}>
        <ThemeToggle />
      </div>
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 size-[500px] rounded-full bg-gradient-primary opacity-20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 size-[500px] rounded-full bg-gradient-accent opacity-20 blur-3xl" />
      </div>

      <div className="w-full max-w-md">
        <Link to="/auth" className="flex items-center gap-2.5 justify-center mb-8">
          <Logo size="lg" />
          <div>
            <div className="font-bold text-xl leading-tight">UC Ultra</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Unified Commerce Ultra</div>
          </div>
        </Link>

        <div className="bg-card border rounded-2xl shadow-elevated p-6">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="size-14 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto">
                <MailCheck className="size-7" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Check your inbox</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  We sent a password reset link to <span className="font-medium text-foreground">{email}</span>.
                </p>
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link to="/auth"><ArrowLeft className="size-4 mr-2" /> Back to sign in</Link>
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold mb-1">Forgot your password?</h1>
              <p className="text-sm text-muted-foreground mb-5">
                Enter your email and we'll send you a link to reset it.
              </p>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fp-email">Email</Label>
                  <Input
                    id="fp-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button disabled={busy} className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground" size="lg">
                  {busy ? "Sending…" : "Send reset link"}
                </Button>
                <Button asChild variant="ghost" className="w-full" size="sm">
                  <Link to="/auth"><ArrowLeft className="size-4 mr-2" /> Back to sign in</Link>
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
