const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";
const SPREADSHEET_ID = "12ZBl8zbbC_7oQJCwgUGhw08hhi3wGDzSregPdiiFENA";
const SHEET_NAME = "MASTER LIST";
// Sheet name has a space → must be single-quoted in A1 notation.
const RANGE = `'${SHEET_NAME}'!A1:ZZ20000`;

type Row = Record<string, string>;

type Sample = {
  order_id: string | null;
  brand: string | null;
  commodity: string | null;
  state: string | null;
  district: string | null;
  variant: string | null;
  status: string | null;
  failed_params: string | null;
  count_unsafe: number | null;
  labeling_issue: string | null;
  overall_compliance: string | null;
};

function pickHeader(headers: string[], candidates: string[]): string | null {
  const norm = (s: string) =>
    s.toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9 %/]/g, "").trim();
  const map = new Map(headers.map((h) => [norm(h), h]));
  for (const c of candidates) {
    const hit = map.get(norm(c));
    if (hit) return hit;
  }
  // partial fallback
  for (const c of candidates) {
    const target = norm(c);
    for (const [k, original] of map) {
      if (k.includes(target)) return original;
    }
  }
  return null;
}

function toRows(values: string[][]): Row[] {
  if (!values || values.length === 0) return [];
  const headers = values[0].map((h) => h?.toString().trim() ?? "");
  return values.slice(1).map((arr) => {
    const r: Row = {};
    headers.forEach((h, i) => {
      r[h] = (arr[i] ?? "").toString().trim();
    });
    return r;
  });
}

function mapToSample(rows: Row[]): Sample[] {
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  const H = {
    order_id: pickHeader(headers, ["Order ID"]),
    brand: pickHeader(headers, ["CORRECT BRAND NAME", "Brand Name", "Brand"]),
    commodity: pickHeader(headers, ["Commodity"]),
    state: pickHeader(headers, ["State"]),
    district: pickHeader(headers, ["District"]),
    variant: pickHeader(headers, ["Variant", "Type"]),
    status: pickHeader(headers, ["Final Status"]),
    failed_params: pickHeader(headers, ["Failed Parameter", "Failed Parameters"]),
    count_unsafe: pickHeader(headers, ["Count Unsafe"]),
    labeling_issue: pickHeader(headers, [
      "Labeling Issue",
      "Labelling Issue",
      "Overall Labelling Complaince",
      "Overall Labelling Compliance",
    ]),
    overall_compliance: pickHeader(headers, [
      "Overall Compliance",
      "Overall Complaince",
    ]),
  };

  return rows
    .map<Sample>((r) => ({
      order_id: H.order_id ? r[H.order_id] || null : null,
      brand: H.brand ? r[H.brand] || null : null,
      commodity: H.commodity ? r[H.commodity] || null : null,
      state: H.state ? r[H.state] || null : null,
      district: H.district ? r[H.district] || null : null,
      variant: H.variant ? r[H.variant] || null : null,
      status: H.status ? r[H.status] || null : null,
      failed_params: H.failed_params ? r[H.failed_params] || null : null,
      count_unsafe: H.count_unsafe
        ? Number.parseInt(r[H.count_unsafe], 10) || 0
        : null,
      labeling_issue: H.labeling_issue ? r[H.labeling_issue] || null : null,
      overall_compliance: H.overall_compliance
        ? r[H.overall_compliance] || null
        : null,
    }))
    .filter((s) => s.order_id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    const GS_KEY = Deno.env.get("GOOGLE_SHEETS_API_KEY");
    if (!GS_KEY) throw new Error("GOOGLE_SHEETS_API_KEY is not configured");

    // Use batchGet with `ranges` query param so the range is properly decoded by Sheets.
    const url =
      `${GATEWAY_URL}/spreadsheets/${SPREADSHEET_ID}/values:batchGet` +
      `?ranges=${encodeURIComponent(RANGE)}&valueRenderOption=FORMATTED_VALUE`;
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GS_KEY,
      },
    });
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(
        `Google Sheets API failed [${resp.status}]: ${JSON.stringify(data)}`,
      );
    }

    const values: string[][] = data.valueRanges?.[0]?.values ?? [];
    const rows = toRows(values);
    const samples = mapToSample(rows);

    return new Response(
      JSON.stringify({
        samples,
        fetchedAt: new Date().toISOString(),
        rowCount: samples.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("fetch-sheet error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});