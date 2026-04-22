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
};

export const samples: Sample[] = (rawSamples as Sample[]).map((s) => ({
  ...s,
  brand: s.brand?.trim() || null,
  commodity: s.commodity?.trim() || null,
  state: s.state?.trim() || null,
  district: s.district?.trim() || null,
  variant: s.variant?.trim() || null,
  status: s.status?.trim() || null,
}));

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
