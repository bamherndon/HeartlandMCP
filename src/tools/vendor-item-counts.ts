import { callAnalyzerApi, HeartlandApiError } from "../heartland-client.js";

function todayIso(): string {
  return new Date().toISOString().split("T")[0]!;
}

export async function handleVendorItemCounts(input: {
  vendor_id: string;
  end_date?: string;
}): Promise<{
  isError?: boolean;
  content: Array<{ type: "text"; text: string }>;
}> {
  const endDate = input.end_date ?? todayIso();

  const itemFilter = JSON.stringify({
    $and: [{ primary_vendor_id: { $in: [input.vendor_id] } }],
  });

  const params = new URLSearchParams();
  params.append("per_page", "200");
  params.append("subtotal", "false");
  params.append("grand_total", "true");
  params.append("exclude_zeroes", "false");
  params.append("include_links", "true");
  params.append("charts", "[]");
  params.append("page", "1");
  params.append("end_date", endDate);
  params.append("group[]", "location.name");
  params.append("group[]", "vendor.name");
  params.append("group[]", "item.public_id");
  params.append("group[]", "item.description");
  params.append("metrics[]", "ending_inventory.qty_owned");
  params.append("sort[]", "ending_inventory.qty_owned,asc");
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
