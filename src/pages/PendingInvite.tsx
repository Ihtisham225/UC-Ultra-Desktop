import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mailbox, RefreshCw, LogOut, Store } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useShop } from "@/contexts/ShopContext";

export default function PendingInvite() {
  const { user, signOut } = useAuth();
  const { refresh } = useShop();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = "Waiting for invite — UCU"; }, []);

  const handleRefresh = async () => {
    setBusy(true);
    await refresh();
    setBusy(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-gradient-surface"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="w-full max-w-md bg-card border rounded-2xl shadow-elevated p-8 text-center">
        <div className="size-16 mx-auto rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow mb-4">
          <Mailbox className="size-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Waiting for an invite</h1>
        <p className="text-muted-foreground text-sm mb-6">
          You're signed in as <span className="font-medium text-foreground">{user?.email}</span>.
          Ask your store owner to add this email from their Staff page. Once added, refresh to enter the shop.
        </p>

        <div className="space-y-2">
          <Button onClick={handleRefresh} disabled={busy} className="w-full bg-gradient-primary text-primary-foreground" size="lg">
            <RefreshCw className={`size-4 mr-2 ${busy ? "animate-spin" : ""}`} />
            {busy ? "Checking…" : "I've been invited — refresh"}
          </Button>
          <Button variant="outline" className="w-full" onClick={() => navigate("/onboarding?force=1")}>
            <Store className="size-4 mr-2" /> Actually, I want to create my own shop
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => signOut().then(() => navigate("/auth"))}>
            <LogOut className="size-4 mr-2" /> Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
