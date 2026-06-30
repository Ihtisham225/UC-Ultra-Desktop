import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, Theme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolved } = useTheme();
  const items: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("h-9 w-9", className)} aria-label="Toggle theme">
          {resolved === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {items.map((it) => (
          <DropdownMenuItem
            key={it.value}
            onClick={() => setTheme(it.value)}
            className={cn("gap-2", theme === it.value && "bg-accent/30 font-semibold")}
          >
            <it.icon className="size-4" /> {it.label}
            {theme === it.value && <span className="ml-auto text-[10px] text-primary">●</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
