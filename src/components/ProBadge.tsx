import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProBadge({ className }: { className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
      "bg-gradient-to-r from-amber-400 to-amber-600 text-white shadow-sm",
      className
    )}>
      <Sparkles className="size-2.5" /> Pro
    </span>
  );
}
