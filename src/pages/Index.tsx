import { useMemo, useState } from "react";
import { ShieldCheck, AlertTriangle, BarChart3, MapPin, Activity } from "lucide-react";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { FailedParamsChart } from "@/components/dashboard/FailedParamsChart";
import { VariantPie } from "@/components/dashboard/VariantPie";
import { ConsistencyBadge } from "@/components/dashboard/ConsistencyBadge";
import {
  ALL,
  applyFilters,
  buildBrandConsistency,
  classifyConsistency,
  CONSISTENCY_META,
  MIN_SAMPLES_FOR_TIER,
  parseFailedParams,
  samples,
  uniqueSorted,
  type ConsistencyTier,
  type Filters,
} from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";

const HIGH_RISK_THRESHOLD = 20; // %

function pct(part: number, total: number) {
  if (!total) return 0;
  return (part / total) * 100;
}

function fmtPct(v: number) {
  return `${v.toFixed(1)}%`;
}

const Index = () => {
  const [filters, setFilters] = useState<Filters>({
    brand: ALL,
    commodity: ALL,
    state: ALL,
  });

  // Option lists are derived once from the full dataset.
  const allBrands = useMemo(
    () =>
      uniqueSorted(samples.map((s) => s.brand)).map((b) => ({ value: b, label: b })),
    [],
  );
  const allCommodities = useMemo(
    () =>
      uniqueSorted(samples.map((s) => s.commodity)).map((c) => ({
        value: c,
        label: c,
      })),
    [],
  );
  const allStates = useMemo(
    () =>
      uniqueSorted(samples.map((s) => s.state)).map((s) => ({ value: s, label: s })),
    [],
  );

  const filtered = useMemo(() => applyFilters(samples, filters), [filters]);

  const total = filtered.length;
  const ncCount = filtered.filter((s) => s.status === "NC").length;
  const compliantCount = filtered.filter((s) => s.status === "Compliant").length;
  const ncRate = pct(ncCount, total);
  const complianceRate = pct(compliantCount, total);
  const isHighRisk = ncRate > HIGH_RISK_THRESHOLD && total > 0;

  // Failed parameters (from NC samples only).
  const failedParamsData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of filtered) {
      if (s.status !== "NC") continue;
      for (const p of parseFailedParams(s.failed_params)) {
        counts.set(p, (counts.get(p) ?? 0) + 1);
      }
    }
    return Array.from(counts, ([parameter, count]) => ({ parameter, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filtered]);

  // Variant split.
  const variantData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of filtered) {
      const key = s.variant ?? "Unknown";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts, ([name, value]) => ({ name, value })).sort(
      (a, b) => b.value - a.value,
    );
  }, [filtered]);

  // Commodity-wise sample count + NC stats.
  const commodityRows = useMemo(() => {
    const map = new Map<string, { total: number; nc: number }>();
    for (const s of filtered) {
      const key = s.commodity ?? "—";
      const cur = map.get(key) ?? { total: 0, nc: 0 };
      cur.total += 1;
      if (s.status === "NC") cur.nc += 1;
      map.set(key, cur);
    }
    return Array.from(map, ([commodity, v]) => ({
      commodity,
      total: v.total,
      nc: v.nc,
      ncRate: pct(v.nc, v.total),
    })).sort((a, b) => b.total - a.total);
  }, [filtered]);

  // State + district coverage.
  const geoRows = useMemo(() => {
    const map = new Map<string, { districts: Set<string>; total: number; nc: number }>();
    for (const s of filtered) {
      const key = s.state ?? "—";
      const cur = map.get(key) ?? { districts: new Set<string>(), total: 0, nc: 0 };
      cur.total += 1;
      if (s.district) cur.districts.add(s.district);
      if (s.status === "NC") cur.nc += 1;
      map.set(key, cur);
    }
    return Array.from(map, ([state, v]) => ({
      state,
      districts: v.districts.size,
      total: v.total,
      nc: v.nc,
      ncRate: pct(v.nc, v.total),
    })).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const totalDistricts = useMemo(
    () => geoRows.reduce((s, r) => s + r.districts, 0),
    [geoRows],
  );

  const selectedBrand = filters.brand === ALL ? "All brands" : filters.brand;

  const handleFilterChange = (next: Partial<Filters>) =>
    setFilters((f) => ({ ...f, ...next }));

  // Consistency of failure — brand-level. Built from the *commodity/state
  // filtered* slice so the analysis respects the user's scope, but ignores
  // the brand filter so it can rank brands when one is selected too.
  const brandScopedSamples = useMemo(
    () =>
      applyFilters(samples, {
        brand: ALL,
        commodity: filters.commodity,
        state: filters.state,
      }),
    [filters.commodity, filters.state],
  );

  const brandConsistency = useMemo(
    () => buildBrandConsistency(brandScopedSamples),
    [brandScopedSamples],
  );

  const tierOrder: ConsistencyTier[] = [
    "consistent",
    "frequent",
    "occasional",
    "clean",
    "insufficient",
  ];

  const tierCounts = useMemo(() => {
    const counts: Record<ConsistencyTier, number> = {
      consistent: 0,
      frequent: 0,
      occasional: 0,
      clean: 0,
      insufficient: 0,
    };
    for (const b of brandConsistency) counts[b.tier] += 1;
    return counts;
  }, [brandConsistency]);

  const worstBrands = useMemo(
    () =>
      brandConsistency
        .filter((b) => b.tier !== "insufficient")
        .sort((a, b) => b.ncRate - a.ncRate || b.total - a.total)
        .slice(0, 8),
    [brandConsistency],
  );

  const selectedBrandStats = useMemo(() => {
    if (filters.brand === ALL) return null;
    return (
      brandConsistency.find((b) => b.brand === filters.brand) ?? {
        brand: filters.brand,
        total: 0,
        nc: 0,
        ncRate: 0,
        tier: classifyConsistency(0, 0),
      }
    );
  }, [brandConsistency, filters.brand]);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gradient-header text-primary-foreground">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-1 px-6 py-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary-foreground/70">
            <ShieldCheck className="h-4 w-4" />
            Food Safety Compliance
          </div>
          <h1 className="text-2xl font-semibold">Brand Insights Dashboard</h1>
          <p className="text-sm text-primary-foreground/80">
            Brand-wise sample, compliance, and risk overview across commodities,
            states, and districts.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-6">
        <FilterBar
          brand={filters.brand}
          commodity={filters.commodity}
          state={filters.state}
          brands={allBrands}
          commodities={allCommodities}
          states={allStates}
          onChange={handleFilterChange}
          onReset={() =>
            setFilters({ brand: ALL, commodity: ALL, state: ALL })
          }
        />

        {isHighRisk ? (
          <div className="flex items-start gap-3 rounded-lg border border-risk-border bg-risk-bg p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-risk" />
            <div className="text-sm">
              <p className="font-semibold text-risk">High-risk selection</p>
              <p className="text-foreground/80">
                <span className="font-medium">{selectedBrand}</span> shows a
                non-compliance rate of{" "}
                <span className="font-semibold">{fmtPct(ncRate)}</span>, above the{" "}
                {HIGH_RISK_THRESHOLD}% threshold. Review failed parameters and
                commodity breakdown below.
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total Samples"
            value={total.toLocaleString()}
            hint={selectedBrand}
            icon={<BarChart3 className="h-4 w-4" />}
          />
          <KpiCard
            label="Non-Compliant Samples"
            value={ncCount.toLocaleString()}
            hint={total ? `${fmtPct(ncRate)} of total` : "—"}
            tone={isHighRisk ? "risk" : "warning"}
            icon={<AlertTriangle className="h-4 w-4" />}
          />
          <KpiCard
            label="Compliance Rate"
            value={total ? fmtPct(complianceRate) : "—"}
            hint={`${compliantCount.toLocaleString()} compliant samples`}
            tone={total && complianceRate >= 80 ? "success" : "default"}
            icon={<ShieldCheck className="h-4 w-4" />}
          />
          <KpiCard
            label="Geographical Coverage"
            value={`${geoRows.length} states`}
            hint={`${totalDistricts} districts`}
            icon={<MapPin className="h-4 w-4" />}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <SectionCard
            className="lg:col-span-2"
            title="Key Risk Parameters"
            description="Top failure reasons across non-compliant samples."
          >
            <FailedParamsChart data={failedParamsData} />
          </SectionCard>
          <SectionCard
            title="Variant Split"
            description="Normal vs Organic vs Loose samples in the current selection."
          >
            <VariantPie data={variantData} />
          </SectionCard>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SectionCard
            title="Commodity-wise Samples"
            description="Sample volume and non-compliance rate by commodity."
          >
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-secondary-foreground">
                  <tr className="text-left">
                    <th className="px-4 py-2.5 font-medium">Commodity</th>
                    <th className="px-4 py-2.5 text-right font-medium">Samples</th>
                    <th className="px-4 py-2.5 text-right font-medium">NC</th>
                    <th className="px-4 py-2.5 text-right font-medium">NC %</th>
                  </tr>
                </thead>
                <tbody>
                  {commodityRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-6 text-center text-muted-foreground"
                      >
                        No data for the current selection.
                      </td>
                    </tr>
                  ) : (
                    commodityRows.map((r) => {
                      const risky = r.ncRate > HIGH_RISK_THRESHOLD;
                      return (
                        <tr
                          key={r.commodity}
                          className={cn(
                            "border-t border-border",
                            risky && "bg-risk-bg/60",
                          )}
                        >
                          <td className="px-4 py-2.5 font-medium text-foreground">
                            {r.commodity}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {r.total.toLocaleString()}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {r.nc.toLocaleString()}
                          </td>
                          <td
                            className={cn(
                              "px-4 py-2.5 text-right font-semibold tabular-nums",
                              risky ? "text-risk" : "text-muted-foreground",
                            )}
                          >
                            {fmtPct(r.ncRate)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard
            title="Geographical Coverage"
            description="States and districts covered, with non-compliance rate."
          >
            <div className="max-h-[420px] overflow-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-secondary text-secondary-foreground">
                  <tr className="text-left">
                    <th className="px-4 py-2.5 font-medium">State</th>
                    <th className="px-4 py-2.5 text-right font-medium">Districts</th>
                    <th className="px-4 py-2.5 text-right font-medium">Samples</th>
                    <th className="px-4 py-2.5 text-right font-medium">NC %</th>
                  </tr>
                </thead>
                <tbody>
                  {geoRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-6 text-center text-muted-foreground"
                      >
                        No data for the current selection.
                      </td>
                    </tr>
                  ) : (
                    geoRows.map((r) => {
                      const risky = r.ncRate > HIGH_RISK_THRESHOLD;
                      return (
                        <tr
                          key={r.state}
                          className={cn(
                            "border-t border-border",
                            risky && "bg-risk-bg/60",
                          )}
                        >
                          <td className="px-4 py-2.5 font-medium text-foreground">
                            {r.state}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {r.districts}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {r.total.toLocaleString()}
                          </td>
                          <td
                            className={cn(
                              "px-4 py-2.5 text-right font-semibold tabular-nums",
                              risky ? "text-risk" : "text-muted-foreground",
                            )}
                          >
                            {fmtPct(r.ncRate)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Showing {total.toLocaleString()} samples from a master dataset of{" "}
          {samples.length.toLocaleString()}. High-risk threshold: NC &gt;{" "}
          {HIGH_RISK_THRESHOLD}%.
        </p>
      </main>
    </div>
  );
};

export default Index;
