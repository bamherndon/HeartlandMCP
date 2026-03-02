import { callApi, HeartlandApiError } from "../heartland-client.js";

async function resolveItemId(input: { item_id?: string; public_id?: string }): Promise<string> {
  if (input.item_id) return input.item_id;

  // Look up by public_id
  const params = new URLSearchParams();
  params.append("~[public_id]", input.public_id!);
  params.append("per_page", "1");
  const result = (await callApi("/api/items", params)) as { results?: Array<{ id: number | string }> };
  const item = result.results?.[0];
  if (!item) {
    throw new HeartlandApiError(`No item found with public_id "${input.public_id}"`, 0, "");
  }
  return String(item.id);
}

async function getTransactions(
  itemId: string,
  startDate: string | undefined,
  endDate: string | undefined,
  perPage: number
): Promise<unknown> {
  const params = new URLSearchParams();
  params.append("per_page", String(perPage));
  params.append("~[item_id]", itemId);
  if (startDate) params.append("~[created_at][$gte]", startDate);
  if (endDate) params.append("~[created_at][$lte]", endDate);
  params.append("sort[]", "created_at,desc");
  return callApi("/api/inventory/transactions", params);
}

async function getTransfersForItem(
  itemId: string,
  startDate: string | undefined,
  endDate: string | undefined
): Promise<unknown[]> {
  // Fetch recent transfers (cannot filter by item at header level)
  const xferParams = new URLSearchParams();
  xferParams.append("per_page", "50");
  xferParams.append("page", "1");
  if (startDate) xferParams.append("~[created_at][$gte]", startDate);
  if (endDate) xferParams.append("~[created_at][$lte]", endDate);
  xferParams.append("sort[]", "created_at,desc");

  const xferResult = (await callApi("/api/inventory/transfers", xferParams)) as {
    results?: Array<{ id: number | string }>;
  };
  const transfers = xferResult.results ?? [];

  // Fan out: get lines for each transfer filtered by item_id, in parallel
  const lineResults = await Promise.all(
    transfers.map(async (transfer) => {
      const lineParams = new URLSearchParams();
      lineParams.append("per_page", "200");
      lineParams.append("~[item_id]", itemId);
      try {
        const lines = (await callApi(
          `/api/inventory/transfers/${transfer.id}/lines`,
          lineParams
        )) as { results?: unknown[] };
        const lineItems = lines.results ?? [];
        if (lineItems.length > 0) {
          return { transfer, lines: lineItems };
        }
      } catch {
        // Skip transfers where line fetch fails
      }
      return null;
    })
  );

  return lineResults.filter((r): r is NonNullable<typeof r> => r !== null);
}

export async function handleItemHistory(input: {
  item_id?: string;
  public_id?: string;
  start_date?: string;
  end_date?: string;
  per_page?: number;
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
    const itemId = await resolveItemId(input);
    const perPage = input.per_page ?? 50;

    const [transactions, transfersWithItem] = await Promise.all([
      getTransactions(itemId, input.start_date, input.end_date, perPage),
      getTransfersForItem(itemId, input.start_date, input.end_date),
    ]);

    const output = {
      item_id: itemId,
      transactions,
      transfers: {
        matched_count: (transfersWithItem as unknown[]).length,
        results: transfersWithItem,
      },
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
