import { callAnalyzerApi, HeartlandApiError } from "../heartland-client.js";

function todayIso(): string {
  return new Date().toISOString().split("T")[0]!;
}

export async function handleInventoryByDepartment(input: {
  end_date?: string;
  location_id?: string;
}): Promise<{
  isError?: boolean;
  content: Array<{ type: "text"; text: string }>;
}> {
  const end_date = input.end_date ?? todayIso();
  const location_id = input.location_id ?? "100005";

  const params = new URLSearchParams();
  params.append("per_page", "200");
  params.append("subtotal", "false");
  params.append("grand_total", "false");
  params.append("exclude_zeroes", "true");
  params.append("include_links", "true");
  params.append("charts", "[]");
  params.append("page", "1");
  params.append("end_date", end_date);
  params.append("group[]", "location.name");
  params.append("group[]", "item.custom@department");
  params.append("metrics[]", "ending_inventory.qty_owned");
  params.append("metrics[]", "ending_inventory.cost_owned");
  params.append(
    "location.filters",
    JSON.stringify({ $and: [{ id: { $in: [location_id] } }] })
  );
  params.append(
    "item.filters",
    JSON.stringify({ $and: [{ "custom@sub_department": { $nin: ["Minifig Maker"] } }] })
  );

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
