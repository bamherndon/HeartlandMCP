import { callAnalyzerApi, HeartlandApiError } from "../heartland-client.js";

function todayIso(): string {
  return new Date().toISOString().split("T")[0]!;
}

export async function handleVendorSales(input: {
  vendor_id: string;
  start_date?: string;
  end_date?: string;
}): Promise<{
  isError?: boolean;
  content: Array<{ type: "text"; text: string }>;
}> {
  const endDate = input.end_date ?? todayIso();

  const itemFilter = JSON.stringify({
    $and: [{ primary_vendor_id: { $in: [input.vendor_id] } }],
  });

  const metricFilter = JSON.stringify({
    $and: [{ "source_sales.net_qty_sold": { $gt: ["0"] } }],
  });

  const params = new URLSearchParams();
  params.append("per_page", "200");
  params.append("subtotal", "false");
  params.append("grand_total", "true");
  params.append("exclude_zeroes", "true");
  params.append("include_links", "true");
  params.append("charts", "[]");
  params.append("page", "1");
  params.append("metric.filters", metricFilter);
  if (input.start_date) params.append("start_date", input.start_date);
  params.append("end_date", endDate);
  params.append("group[]", "location.name");
  params.append("group[]", "vendor.name");
  params.append("group[]", "item.public_id");
  params.append("group[]", "item.description");
  params.append("metrics[]", "source_sales.total_cost");
  params.append("metrics[]", "source_sales.net_qty_sold");
  params.append("metrics[]", "purchasing_order.total_qty_open");
  params.append("metrics[]", "current_inventory.qty_on_hand");
  params.append("metrics[]", "current_inventory.last_sold_date");
  params.append("sort[]", "vendor.name,desc");
  params.append("item.filters", itemFilter);

  try {
    const result = await callAnalyzerApi(params);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
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
