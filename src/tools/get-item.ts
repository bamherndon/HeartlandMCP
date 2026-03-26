import { callApi, HeartlandApiError } from "../heartland-client.js";

export async function handleGetItem(input: {
  item_id?: string;
  public_id?: string;
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
    let result: unknown;

    if (input.item_id) {
      result = await callApi(`/api/items/${input.item_id}`, new URLSearchParams());
    } else {
      const params = new URLSearchParams();
      params.append("~[public_id]", input.public_id!);
      params.append("per_page", "1");
      result = await callApi("/api/items", params);
    }

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
