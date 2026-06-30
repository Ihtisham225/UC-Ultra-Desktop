import { ScanBarcode } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
  /** Tailwind size class for the icon container, e.g. "size-9" */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: { box: "size-8 rounded-lg", icon: "size-4" },
  md: { box: "size-9 rounded-xl", icon: "size-5" },
  lg: { box: "size-11 rounded-xl", icon: "size-6" },
};

/**
 * The unified UC Ultra brand mark used across the app
 * (sidebar, mobile nav, auth screens, landing, etc.).
 * Keep it in sync everywhere by using this component.
 */
export const Logo = ({ size = "md", className }: LogoProps) => {
  const s = sizeMap[size];
  return (
    <div
      className={cn(
        "bg-gradient-primary flex items-center justify-center shadow-glow",
        s.box,
        className
      )}
      aria-hidden="true"
    >
      <ScanBarcode className={cn("text-primary-foreground", s.icon)} />
    </div>
  );
};

interface LogoLockupProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  name?: string;
  tagline?: string;
}

/** Logo + brand text lockup (used in sidebar/auth headers). */
export const LogoLockup = ({
  size = "md",
  className,
  name = "UC Ultra",
  tagline = "Unified Commerce Ultra",
}: LogoLockupProps) => {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Logo size={size} />
      <div>
        <div className="font-bold text-base leading-tight">{name}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {tagline}
        </div>
      </div>
    </div>
  );
};
