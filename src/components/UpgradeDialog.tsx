import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, X, BarChart3, ShieldCheck, PackageOpen, Wallet, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";

const PRO_FEATURES = [
  { icon: BarChart3, label: "Advanced analytics & insights" },
  { icon: ShieldCheck, label: "Staff & permissions management" },
  { icon: Wallet, label: "Debts & credit tracking" },
  { icon: Wallet, label: "Expense tracking & reports" },
  { icon: MessageCircle, label: "WhatsApp receipts to customers" },
];

const FREE_FEATURES = ["Point of Sale", "Product management", "Sales history", "Customer database"];

export function UpgradeDialog({
  open, onOpenChange, feature,
}: { open: boolean; onOpenChange: (o: boolean) => void; feature?: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <div className="bg-gradient-primary text-primary-foreground p-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="size-5" />
            <span className="text-xs font-bold uppercase tracking-wider opacity-90">UCU Pro</span>
          </div>
          <DialogHeader>
            <DialogTitle className="text-primary-foreground text-2xl">
              {feature ? `${feature} is a Pro feature` : "Unlock the full power of UCU"}
            </DialogTitle>
            <DialogDescription className="text-primary-foreground/85">
              Grow faster with advanced tools built for serious shop owners.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 grid sm:grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Free includes</div>
            <ul className="space-y-2 text-sm">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2"><Check className="size-4 text-success shrink-0" />{f}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary mb-3">
              <Sparkles className="size-3.5" /> Pro unlocks
            </div>
            <ul className="space-y-2 text-sm">
              {PRO_FEATURES.map((f) => (
                <li key={f.label} className="flex items-center gap-2">
                  <f.icon className="size-4 text-primary shrink-0" />{f.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="px-6 pb-6 flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="sm:flex-1">
            <X className="size-4 mr-1.5" /> Maybe later
          </Button>
          <Button asChild className="sm:flex-1 bg-gradient-primary hover:opacity-90 text-primary-foreground">
            <Link to="/billing" onClick={() => onOpenChange(false)}>
              <Sparkles className="size-4 mr-1.5" /> See plans
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
