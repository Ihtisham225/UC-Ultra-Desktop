import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { resetPasswordWithToken } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { ArrowLeft, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";

/** Pull `token` and `email` from the reset link (works with the hash router). */
function readResetParams(): { token: string; email: string } {
  const search = window.location.search.replace(/^\?/, "");
  const hashQuery = window.location.hash.includes("?") ? window.location.hash.split("?")[1] : "";
  const params = new URLSearchParams(search || hashQuery);
  return { token: params.get("token") ?? "", email: params.get("email") ?? "" };
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [{ token, email }, setParams] = useState({ token: "", email: "" });
  const ready = Boolean(token && email);

  useEffect(() => {
    document.title = "Set new password — UCU";
    setParams(readResetParams());
  }, []);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password"));
    const confirm = String(fd.get("confirm"));
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setBusy(true);
    try {
      const res = await resetPasswordWithToken({ email, token, password });
      if (res.ok) {
        toast.success("Password updated. Please sign in.");
        navigate("/auth", { replace: true });
      } else {
        toast.error(res.error ?? "Reset failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
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
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <Logo size="lg" />
          <div>
            <div className="font-bold text-xl leading-tight">UC Ultra</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Unified Commerce Ultra</div>
          </div>
        </div>

        <div className="bg-card border rounded-2xl shadow-elevated p-6">
          <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
            <KeyRound className="size-6" />
          </div>
          <h1 className="text-xl font-bold mb-1">Set a new password</h1>
          <p className="text-sm text-muted-foreground mb-5">
            {ready ? "Choose a strong password you haven't used before." : "Open the reset link from your email to continue."}
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="rp-password">New password</Label>
              <PasswordInput id="rp-password" name="password" required minLength={8} autoComplete="new-password" disabled={!ready} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rp-confirm">Confirm password</Label>
              <PasswordInput id="rp-confirm" name="confirm" required minLength={8} autoComplete="new-password" disabled={!ready} />
            </div>
            <Button disabled={busy || !ready} className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground" size="lg">
              {busy ? "Updating…" : "Update password"}
            </Button>
            <Button asChild variant="ghost" className="w-full" size="sm">
              <Link to="/auth"><ArrowLeft className="size-4 mr-2" /> Back to sign in</Link>
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
