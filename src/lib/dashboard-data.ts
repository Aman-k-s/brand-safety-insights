import rawSamples from "@/data/samples.json";

export type Sample = {
  order_id: string | null;
  brand: string | null;
  commodity: string | null;
  state: string | null;
  district: string | null;
  variant: string | null;
  status: string | null;
  failed_params: string | null;
  count_unsafe: number | null;
  labeling_issue?: string | null;
  overall_compliance?: string | null;
};

export function normalizeSamples(input: Sample[]): Sample[] {
  return input.map((s) => ({
    ...s,
    brand: s.brand?.trim() || null,
    commodity: s.commodity?.trim() || null,
    state: s.state?.trim() || null,
    district: s.district?.trim() || null,
    variant: s.variant?.trim() || null,
    status: s.status?.trim() || null,
    labeling_issue: s.labeling_issue?.trim() || null,
    overall_compliance: s.overall_compliance?.trim() || null,
  }));
}

// Fallback seed dataset (used until live fetch resolves).
export const samples: Sample[] = normalizeSamples(rawSamples as Sample[]);

export function isLabelingIssue(v: string | null | undefined): boolean {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return s === "yes" || s === "y" || s === "true" || s === "non-compliant" || s === "nc";
}

export function isOverallCompliant(v: string | null | undefined): boolean {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  if (!s) return false;
  if (s.startsWith("non")) return false; // non-compliant
  return s.startsWith("compliant") || s === "yes" || s === "y" || s === "true";
}

/** Normalize "Failed Parameter" strings: split commas, trim, dedupe per-row. */
export function normalizedFailedParameters(raw: string | null): string[] {
  if (!raw) return [];
  const parts = raw
    .split(/[,;\n]/g)
    .map((p) => p.split(":")[0])
    .map((p) =>
      p
        .replace(/\s*\([^)]*\)\s*/g, " ")
        .replace(/,\s*(mg\/kg|µg\/kg|cfu\/g|%|mg\/l|ml\/100g|per 25g)\b.*$/i, "")
        .replace(/\s+compliance$/i, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((p) => p.length > 0 && p.toLowerCase() !== "no failed parameters");
  return Array.from(new Set(parts));
}

export const ALL = "__all__";

export function uniqueSorted(values: (string | null)[]): string[] {
  const set = new Set<string>();
  for (const v of values) if (v) set.add(v);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function parseFailedParams(raw: string | null): string[] {
  if (!raw) return [];
  // Splits on comma, takes label before ":" — e.g. "FSSAI Logo: No" -> "FSSAI Logo"
  return raw
    .split(",")
    .map((p) => p.split(":")[0].trim())
    .filter((p) => p.length > 0);
}

export type Filters = {
  brand: string;
  commodity: string;
  state: string;
};

export function applyFilters(data: Sample[], f: Filters): Sample[] {
  return data.filter((s) => {
    if (f.brand !== ALL && s.brand !== f.brand) return false;
    if (f.commodity !== ALL && s.commodity !== f.commodity) return false;
    if (f.state !== ALL && s.state !== f.state) return false;
    return true;
  });
}

export type ConsistencyTier =
  | "consistent"
  | "frequent"
  | "occasional"
  | "clean"
  | "insufficient";

export const CONSISTENCY_META: Record<
  ConsistencyTier,
  { label: string; short: string; description: string }
> = {
  consistent: {
    label: "Consistent failure",
    short: "Consistent",
    description: "≥ 60% of samples non-compliant",
  },
  frequent: {
    label: "Frequent failure",
    short: "Frequent",
    description: "30–60% of samples non-compliant",
  },
  occasional: {
    label: "Occasional failure",
    short: "Occasional",
    description: "5–30% of samples non-compliant",
  },
  clean: {
    label: "Clean",
    short: "Clean",
    description: "< 5% of samples non-compliant",
  },
  insufficient: {
    label: "Insufficient data",
    short: "Insufficient",
    description: "Fewer than 3 samples",
  },
};

export const MIN_SAMPLES_FOR_TIER = 3;

export function classifyConsistency(total: number, nc: number): ConsistencyTier {
  if (total < MIN_SAMPLES_FOR_TIER) return "insufficient";
  const rate = (nc / total) * 100;
  if (rate >= 60) return "consistent";
  if (rate >= 30) return "frequent";
  if (rate >= 5) return "occasional";
  return "clean";
}

export type BrandConsistency = {
  brand: string;
  total: number;
  nc: number;
  ncRate: number;
  tier: ConsistencyTier;
};

export function buildBrandConsistency(data: Sample[]): BrandConsistency[] {
  const map = new Map<string, { total: number; nc: number }>();
  for (const s of data) {
    if (!s.brand) continue;
    const cur = map.get(s.brand) ?? { total: 0, nc: 0 };
    cur.total += 1;
    if (s.status === "NC") cur.nc += 1;
    map.set(s.brand, cur);
  }
  return Array.from(map, ([brand, v]) => ({
    brand,
    total: v.total,
    nc: v.nc,
    ncRate: v.total ? (v.nc / v.total) * 100 : 0,
    tier: classifyConsistency(v.total, v.nc),
  }));
}
