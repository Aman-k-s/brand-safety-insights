import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type Props = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "success" | "risk" | "warning";
  icon?: ReactNode;
};

const toneStyles: Record<NonNullable<Props["tone"]>, string> = {
  default: "border-border bg-card",
  success: "border-success/30 bg-success/5",
  risk: "border-risk-border bg-risk-bg",
  warning: "border-warning/40 bg-warning/10",
};

const valueTone: Record<NonNullable<Props["tone"]>, string> = {
  default: "text-foreground",
  success: "text-success",
  risk: "text-risk",
  warning: "text-foreground",
};

export function KpiCard({ label, value, hint, tone = "default", icon }: Props) {
  return (
    <div
      className={cn(
        "rounded-lg border p-5 shadow-card transition-shadow hover:shadow-elevated",
        toneStyles[tone],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      </div>
      <p className={cn("mt-3 text-3xl font-semibold tabular-nums", valueTone[tone])}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
