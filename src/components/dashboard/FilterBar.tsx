import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALL } from "@/lib/dashboard-data";

type Option = { value: string; label: string };

type Props = {
  brand: string;
  commodity: string;
  state: string;
  brands: Option[];
  commodities: Option[];
  states: Option[];
  onChange: (next: { brand?: string; commodity?: string; state?: string }) => void;
  onReset: () => void;
};

function FilterSelect({
  label,
  value,
  options,
  onChange,
  allLabel,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  allLabel: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10 min-w-[200px] bg-card">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[320px]">
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function FilterBar({
  brand,
  commodity,
  state,
  brands,
  commodities,
  states,
  onChange,
  onReset,
}: Props) {
  const hasFilters = brand !== ALL || commodity !== ALL || state !== ALL;
  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4 shadow-card">
      <FilterSelect
        label="Brand"
        value={brand}
        options={brands}
        onChange={(v) => onChange({ brand: v })}
        allLabel={`All brands (${brands.length})`}
      />
      <FilterSelect
        label="Commodity"
        value={commodity}
        options={commodities}
        onChange={(v) => onChange({ commodity: v })}
        allLabel={`All commodities (${commodities.length})`}
      />
      <FilterSelect
        label="State"
        value={state}
        options={states}
        onChange={(v) => onChange({ state: v })}
        allLabel={`All states (${states.length})`}
      />
      {hasFilters ? (
        <button
          type="button"
          onClick={onReset}
          className="h-10 rounded-md border border-border bg-secondary px-4 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/70"
        >
          Reset filters
        </button>
      ) : null}
    </div>
  );
}
