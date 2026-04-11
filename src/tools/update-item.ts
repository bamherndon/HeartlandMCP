import { callApiWrite, callApi, HeartlandApiError } from "../heartland-client.js";

export async function handleUpdateItem(input: {
  item_id?: string;
  public_id?: string;
  price?: number;
  cost?: number;
  description?: string;
  custom?: Record<string, string> | string;
}): Promise<{
  isError?: boolean;
  content: Array<{ type: "text"; text: string }>;
}> {
  if (!input.item_id && !input.public_id) {
    return {
      isError: true,
      content: [{ type: "text", text: "Either item_id or public_id is required." }],
    };
  }

  try {
    let itemId = input.item_id;

    if (!itemId) {
      const params = new URLSearchParams();
      params.append("~[public_id]", input.public_id!);
      params.append("per_page", "1");
      const result = await callApi("/api/items", params) as { results: Array<{ id: number }> };
      if (!result.results || result.results.length === 0) {
        return { isError: true, content: [{ type: "text", text: `No item found with public_id: ${input.public_id}` }] };
      }
      itemId = String(result.results[0].id);
    }

    const body: Record<string, unknown> = {};
    if (input.price !== undefined) body.price = input.price;
    if (input.cost !== undefined) body.cost = input.cost;
    if (input.description !== undefined) body.description = input.description;
    if (input.custom !== undefined) {
      body.custom = typeof input.custom === "string" ? JSON.parse(input.custom) : input.custom;
    }

    const result = await callApiWrite("PUT", `/api/items/${itemId}`, body);

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
