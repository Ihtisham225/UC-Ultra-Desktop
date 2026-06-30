import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calculator as CalcIcon, Minus, GripHorizontal } from "lucide-react";

const KEYS = [
  ["C", "←", "%", "÷"],
  ["7", "8", "9", "×"],
  ["4", "5", "6", "−"],
  ["1", "2", "3", "+"],
  ["±", "0", ".", "="],
];

const op = (s: string) => s.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");

// Convert business-style percentages: "A + B%" -> "A + (A*B/100)", "A - B%" -> "A - (A*B/100)",
// "A * B%" / "A / B%" -> "A * (B/100)", standalone "B%" -> "(B/100)".
const expandPercent = (s: string): string => {
  let prev = "";
  let cur = s;
  while (prev !== cur) {
    prev = cur;
    cur = cur.replace(
      /(\d+(?:\.\d+)?)\s*([+\-])\s*(\d+(?:\.\d+)?)%/,
      (_m, a, opSign, b) => `${a}${opSign}(${a}*${b}/100)`,
    );
    cur = cur.replace(
      /(\d+(?:\.\d+)?)\s*([*/])\s*(\d+(?:\.\d+)?)%/,
      (_m, a, opSign, b) => `${a}${opSign}(${b}/100)`,
    );
  }
  cur = cur.replace(/(\d+(?:\.\d+)?)%/g, "($1/100)");
  return cur;
};

export interface CalculatorState {
  expr: string;
  display: string;
}

export const FloatingCalculator = ({
  open,
  onMinimize,
  state,
  setState,
}: {
  open: boolean;
  onMinimize: () => void;
  state: CalculatorState;
  setState: (s: CalculatorState) => void;
}) => {
  const [pos, setPos] = useState(() => {
    if (typeof window === "undefined") return { x: 100, y: 100 };
    return { x: Math.max(20, window.innerWidth - 320), y: 100 };
  });
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const x = Math.max(0, Math.min(window.innerWidth - 280, e.clientX - dragRef.current.dx));
      const y = Math.max(0, Math.min(window.innerHeight - 60, e.clientY - dragRef.current.dy));
      setPos({ x, y });
    };
    const up = () => (dragRef.current = null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  const press = (k: string) => {
    if (k === "C") return setState({ expr: "", display: "0" });
    if (k === "←") {
      const next = state.expr.slice(0, -1);
      return setState({ expr: next, display: next || "0" });
    }
    if (k === "±") {
      if (!state.display || state.display === "0") return;
      const neg = state.display.startsWith("-") ? state.display.slice(1) : "-" + state.display;
      return setState({ expr: neg, display: neg });
    }
    if (k === "=") {
      try {
        const sanitized = expandPercent(op(state.expr)).replace(/[^0-9+\-*/.() ]/g, "");
        if (!sanitized) return;
        // eslint-disable-next-line no-new-func
        const result = Function(`"use strict"; return (${sanitized})`)();
        const out = Number.isFinite(result) ? String(+parseFloat(result).toFixed(8)) : "Error";
        return setState({ expr: out === "Error" ? "" : out, display: out });
      } catch {
        return setState({ expr: "", display: "Error" });
      }
    }
    const next = (state.expr === "0" || state.display === "Error" ? "" : state.expr) + k;
    setState({ expr: next, display: next });
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      const tag = tgt?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tgt?.isContentEditable) return;
      const k = e.key;
      const map: Record<string, string> = {
        "*": "×", x: "×", X: "×",
        "/": "÷",
        "-": "−",
        "+": "+",
        "=": "=", Enter: "=",
        "%": "%",
        ".": ".", ",": ".",
        Backspace: "←",
        Delete: "C", Escape: "C",
      };
      let mapped: string | undefined;
      if (/^[0-9]$/.test(k)) mapped = k;
      else mapped = map[k];
      if (!mapped) return;
      e.preventDefault();
      press(mapped);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  if (!open) return null;

  return (
    <div
      className="fixed z-50 w-[260px] rounded-xl border bg-card shadow-elevated select-none"
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 border-b bg-muted/40 rounded-t-xl cursor-move touch-none"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
        }}
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <GripHorizontal className="size-4 text-muted-foreground" />
          <CalcIcon className="size-4" /> Calculator
        </div>
        <Button variant="ghost" size="icon" className="size-7" onClick={onMinimize} title="Minimize">
          <Minus className="size-4" />
        </Button>
      </div>

      <div className="p-3 space-y-2">
        <div className="rounded-lg bg-muted/50 px-3 py-3 text-end font-mono text-xl tabular-nums truncate min-h-[44px]">
          {state.display || "0"}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {KEYS.flat().map((k) => {
            const isOp = ["÷", "×", "−", "+", "="].includes(k);
            const isFn = ["C", "←", "%", "±"].includes(k);
            return (
              <Button
                key={k}
                variant={k === "=" ? "default" : isOp ? "secondary" : isFn ? "outline" : "ghost"}
                className={`h-10 text-base ${k === "=" ? "bg-primary text-primary-foreground hover:opacity-90" : ""}`}
                onClick={() => press(k)}
              >
                {k}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
