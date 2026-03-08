import { callAnalyzerApi, HeartlandApiError } from "../heartland-client.js";

function todayIso(): string {
  return new Date().toISOString().split("T")[0]!;
}

export async function handleInventoryByVendor(input: {
  date?: string;
}): Promise<{
  isError?: boolean;
  content: Array<{ type: "text"; text: string }>;
}> {
  const date = input.date ?? todayIso();

  const params = new URLSearchParams();
  params.append("per_page", "200");
  params.append("subtotal", "false");
  params.append("grand_total", "false");
  params.append("exclude_zeroes", "true");
  params.append("include_links", "true");
  params.append("charts", "[]");
  params.append("page", "1");
  params.append("end_date", date);
  params.append("group[]", "location.name");
  params.append("group[]", "vendor.name");
  params.append("metrics[]", "ending_inventory.qty_owned");
  params.append("metrics[]", "ending_inventory.cost_owned");
  params.append("metrics[]", "ending_inventory.price_owned");

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
