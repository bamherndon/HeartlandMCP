import { callApiPost, HeartlandApiError } from "../heartland-client.js";

interface PurchaseOrderLine {
  item_id: string;
  qty: number;
  unit_cost?: number;
}

export async function handleAddPurchaseOrderLines(input: {
  purchase_order_id: string;
  lines: PurchaseOrderLine[];
}): Promise<{
  isError?: boolean;
  content: Array<{ type: "text"; text: string }>;
}> {
  try {
    const lineResults: unknown[] = [];
    for (const line of input.lines) {
      const body: Record<string, unknown> = { item_id: line.item_id, qty: line.qty };
      if (line.unit_cost !== undefined) body.unit_cost = line.unit_cost;
      const { data } = await callApiPost(
        `/api/purchasing/orders/${input.purchase_order_id}/lines`,
        body
      );
      lineResults.push(data);
    }

    const output = {
      purchase_order_id: input.purchase_order_id,
      lines_added: lineResults.length,
      lines: lineResults,
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
