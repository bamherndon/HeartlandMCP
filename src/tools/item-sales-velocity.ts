import { callAnalyzerApi, HeartlandApiError } from "../heartland-client.js";

type Row = Record<string, string | number | null>;
type ReportResult = { results?: Row[]; grand_total?: Row };

function buildItemFilter(input: { item_id?: string; public_id?: string; vendor_id?: string }): string {
  if (input.vendor_id) {
    return JSON.stringify({ $and: [{ primary_vendor_id: { $in: [input.vendor_id] } }] });
  }
  if (input.item_id) {
    return JSON.stringify({ $and: [{ id: { $in: [input.item_id] } }] });
  }
  return JSON.stringify({ $and: [{ public_id: { $in: [input.public_id!] } }] });
}

interface ItemEntry {
  description: string;
  qtyByMonth: Map<string, number>;
  salesByMonth: Map<string, number>;
}

function computeSummary(rows: Row[]) {
  const qtyByMonth = new Map<string, number>();
  const salesByMonth = new Map<string, number>();
  const byItem = new Map<string, ItemEntry>();

  for (const row of rows) {
    const month = String(row["date.month_of_year"] ?? "");
    const itemKey = String(row["item.public_id"] ?? "");
    const description = String(row["item.description"] ?? "");
    const qty = Number(row["source_sales.net_qty_sold"] ?? 0);
    const sales = Number(row["source_sales.net_sales"] ?? 0);

    qtyByMonth.set(month, (qtyByMonth.get(month) ?? 0) + qty);
    salesByMonth.set(month, (salesByMonth.get(month) ?? 0) + sales);

    if (!byItem.has(itemKey)) {
      byItem.set(itemKey, { description, qtyByMonth: new Map(), salesByMonth: new Map() });
    }
    const entry = byItem.get(itemKey)!;
    entry.qtyByMonth.set(month, (entry.qtyByMonth.get(month) ?? 0) + qty);
    entry.salesByMonth.set(month, (entry.salesByMonth.get(month) ?? 0) + sales);
  }

  const numMonths = qtyByMonth.size;
  const totalQty = [...qtyByMonth.values()].reduce((a, b) => a + b, 0);
  const totalSales = [...salesByMonth.values()].reduce((a, b) => a + b, 0);

  const items = Object.fromEntries(
    [...byItem.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([publicId, entry]) => {
        const itemQtys = [...entry.qtyByMonth.values()];
        const itemSales = [...entry.salesByMonth.values()];
        const itemNumMonths = entry.qtyByMonth.size;
        const itemTotalQty = itemQtys.reduce((a, b) => a + b, 0);
        const itemTotalSales = itemSales.reduce((a, b) => a + b, 0);
        return [
          publicId,
          {
            description: entry.description,
            total_qty_sold: itemTotalQty,
            avg_qty_per_month: itemNumMonths > 0 ? Math.round((itemTotalQty / itemNumMonths) * 100) / 100 : 0,
            total_net_sales: Math.round(itemTotalSales * 100) / 100,
            avg_net_sales_per_month: itemNumMonths > 0 ? Math.round((itemTotalSales / itemNumMonths) * 100) / 100 : 0,
            monthly_qty: Object.fromEntries([...entry.qtyByMonth.entries()].sort()),
            monthly_net_sales: Object.fromEntries(
              [...entry.salesByMonth.entries()]
                .sort()
                .map(([m, v]) => [m, Math.round(v * 100) / 100])
            ),
          },
        ];
      })
  );

  return {
    total_months: numMonths,
    total_qty_sold: totalQty,
    avg_qty_per_month: numMonths > 0 ? Math.round((totalQty / numMonths) * 100) / 100 : 0,
    total_net_sales: Math.round(totalSales * 100) / 100,
    avg_net_sales_per_month: numMonths > 0 ? Math.round((totalSales / numMonths) * 100) / 100 : 0,
    monthly_qty: Object.fromEntries([...qtyByMonth.entries()].sort()),
    monthly_net_sales: Object.fromEntries(
      [...salesByMonth.entries()]
        .sort()
        .map(([m, v]) => [m, Math.round(v * 100) / 100])
    ),
    items,
  };
}

export async function handleItemSalesVelocity(input: {
  item_id?: string;
  public_id?: string;
  vendor_id?: string;
  start_date?: string;
  end_date?: string;
  group_by_location?: boolean;
}): Promise<{
  isError?: boolean;
  content: Array<{ type: "text"; text: string }>;
}> {
  if (!input.item_id && !input.public_id && !input.vendor_id) {
    return {
      isError: true,
      content: [{ type: "text", text: "One of item_id, public_id, or vendor_id is required." }],
    };
  }

  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(today.getFullYear() - 1);
  const startDate = input.start_date ?? oneYearAgo.toISOString().split("T")[0]!;
  const endDate = input.end_date ?? today.toISOString().split("T")[0]!;

  const params = new URLSearchParams();
  params.append("per_page", "200");
  params.append("subtotal", "false");
  params.append("grand_total", "false");
  params.append("exclude_zeroes", "true");
  params.append("include_links", "true");
  params.append("charts", "[]");
  params.append("page", "1");
  params.append("group[]", "location.name");
  params.append("group[]", "date.month_of_year");
  params.append("group[]", "item.public_id");
  params.append("group[]", "item.description");
  params.append("metrics[]", "source_sales.net_sales");
  params.append("metrics[]", "source_sales.net_qty_sold");
  params.append("start_date", startDate);
  params.append("end_date", endDate);
  params.append("item.filters", buildItemFilter(input));

  try {
    const result = (await callAnalyzerApi(params)) as ReportResult;
    const rows = result.results ?? [];

    const output = {
      summary: computeSummary(rows),
      detail: result,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
    };
  } catch (err) {
    if (err instanceof HeartlandApiError) {
      const message =
        err.statusCode > 0
          ? `API error ${err.statusCode}: ${err.message}\nResponse body: ${err.responseBody}`
          : err.message;
      return { isError: true, content: [{ type: "text", text: message }] };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { isError: true, content: [{ type: "text", text: `Unexpected error: ${message}` }] };
  }
}
