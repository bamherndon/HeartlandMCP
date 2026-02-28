import { callApi, HeartlandApiError } from "../heartland-client.js";

export async function handleGetVendors(input: {
  name?: string;
  per_page?: number;
}): Promise<{
  isError?: boolean;
  content: Array<{ type: "text"; text: string }>;
}> {
  const params = new URLSearchParams();

  if (input.name) {
    params.append("query", input.name);
  }

  params.append("per_page", String(input.per_page ?? 50));

  try {
    const result = await callApi("/api/purchasing/vendors", params);
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
