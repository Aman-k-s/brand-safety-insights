import { cn } from "@/lib/utils";
import { CONSISTENCY_META, type ConsistencyTier } from "@/lib/dashboard-data";

const tierStyles: Record<ConsistencyTier, string> = {
  consistent: "bg-risk/15 text-risk border-risk/30",
  frequent: "bg-warning/20 text-foreground border-warning/40",
  occasional: "bg-chart-4/15 text-foreground border-chart-4/30",
  clean: "bg-success/15 text-success border-success/30",
  insufficient: "bg-muted text-muted-foreground border-border",
};

export function ConsistencyBadge({
  tier,
  className,
}: {
  tier: ConsistencyTier;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tierStyles[tier],
        className,
      )}
    >
      {CONSISTENCY_META[tier].short}
    </span>
  );
}