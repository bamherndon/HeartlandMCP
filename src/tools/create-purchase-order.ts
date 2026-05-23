import { callApi, callApiPost, HeartlandApiError } from "../heartland-client.js";

interface PurchaseOrderLine {
  public_id: string;
  qty: number;
  unit_cost?: number;
  description?: string;
  price?: number;
  upc?: string;
  custom?: Record<string, string>;
}

function extractIdFromLocation(locationHeader: string): string | null {
  const match = locationHeader.match(/\/(\d+)\s*$/);
  return match ? match[1] : null;
}

async function upsertItem(
  line: PurchaseOrderLine,
  vendorId: number
): Promise<{ item_id: string; created: boolean }> {
  const params = new URLSearchParams();
  params.append("~[public_id]", line.public_id);
  params.append("per_page", "1");
  const result = await callApi("/api/items", params) as { results: Array<{ id: number }> };

  if (result.results && result.results.length > 0) {
    return { item_id: String(result.results[0].id), created: false };
  }

  const body: Record<string, unknown> = {
    public_id: line.public_id,
    primary_vendor_id: vendorId,
  };
  if (line.description !== undefined) body.description = line.description;
  if (line.price !== undefined) body.price = line.price;
  if (line.unit_cost !== undefined) body.cost = line.unit_cost;
  // UPC lives in custom.upc, not as a top-level field
  const custom: Record<string, string> = { ...(line.custom ?? {}) };
  if (line.upc !== undefined) custom.upc = line.upc;
  if (Object.keys(custom).length > 0) body.custom = custom;

  const { data: itemData, locationHeader } = await callApiPost("/api/items", body);

  let itemId: string | null = null;
  if (itemData && typeof itemData === "object" && "id" in (itemData as object)) {
    itemId = String((itemData as { id: unknown }).id);
  } else if (locationHeader) {
    itemId = extractIdFromLocation(locationHeader);
  }

  if (!itemId) {
    throw new Error(
      `Item ${line.public_id} created but ID not found. Response: ${JSON.stringify(itemData)}, Location: ${locationHeader}`
    );
  }

  return { item_id: itemId, created: true };
}

export async function handleCreatePurchaseOrder(input: {
  vendor_id: string;
  location_id: string;
  start_shipments_at?: string;
  end_shipments_at?: string;
  lines?: PurchaseOrderLine[];
}): Promise<{
  isError?: boolean;
  content: Array<{ type: "text"; text: string }>;
}> {
  const vendorIdInt = parseInt(input.vendor_id, 10);

  try {
    // Step 1: Upsert all items before touching the PO
    const upsertResults: Array<{
      public_id: string;
      item_id: string;
      item_created: boolean;
      line: PurchaseOrderLine;
      error?: string;
    }> = [];

    for (const line of input.lines ?? []) {
      try {
        const upserted = await upsertItem(line, vendorIdInt);
        upsertResults.push({ public_id: line.public_id, item_id: upserted.item_id, item_created: upserted.created, line });
      } catch (err) {
        upsertResults.push({
          public_id: line.public_id,
          item_id: "",
          item_created: false,
          line,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const upsertErrors = upsertResults.filter((r) => r.error);
    if (upsertErrors.length > 0) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Failed to upsert ${upsertErrors.length} item(s) before PO creation:\n${JSON.stringify(upsertErrors, null, 2)}`,
        }],
      };
    }

    // Step 2: Create the purchase order
    const today = new Date().toISOString().slice(0, 10);
    const thirtyDaysOut = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const { data: poData, locationHeader } = await callApiPost(
      "/api/purchasing/orders",
      {
        vendor_id: vendorIdInt,
        receive_at_location_id: parseInt(input.location_id, 10),
        start_shipments_at: input.start_shipments_at ?? today,
        end_shipments_at: input.end_shipments_at ?? thirtyDaysOut,
      }
    );

    let purchaseOrderId: string | null = null;
    if (poData && typeof poData === "object" && "id" in (poData as object)) {
      purchaseOrderId = String((poData as { id: unknown }).id);
    } else if (locationHeader) {
      purchaseOrderId = extractIdFromLocation(locationHeader);
    }

    if (!purchaseOrderId) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Purchase order created but could not determine its ID.\nResponse: ${JSON.stringify(poData)}\nLocation: ${locationHeader}`,
        }],
      };
    }

    // Step 3: Add lines using resolved item IDs
    const lineResults: Array<{
      public_id: string;
      item_id: string;
      item_created: boolean;
      po_line: unknown;
      error?: string;
    }> = [];

    for (const upserted of upsertResults) {
      try {
        const lineBody: Record<string, unknown> = { item_id: upserted.item_id, qty: upserted.line.qty };
        if (upserted.line.unit_cost !== undefined) lineBody.unit_cost = upserted.line.unit_cost;
        const { data: poLineData } = await callApiPost(
          `/api/purchasing/orders/${purchaseOrderId}/lines`,
          lineBody
        );
        lineResults.push({ public_id: upserted.public_id, item_id: upserted.item_id, item_created: upserted.item_created, po_line: poLineData });
      } catch (lineErr) {
        lineResults.push({
          public_id: upserted.public_id,
          item_id: upserted.item_id,
          item_created: upserted.item_created,
          po_line: null,
          error: lineErr instanceof Error ? lineErr.message : String(lineErr),
        });
      }
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          purchase_order_id: purchaseOrderId,
          purchase_order: poData,
          lines_added: lineResults.filter((l) => !l.error).length,
          items_created: lineResults.filter((l) => l.item_created).length,
          lines: lineResults,
        }, null, 2),
      }],
    };
  } catch (err) {
    if (err instanceof HeartlandApiError) {
      const message = err.statusCode > 0
        ? `API error ${err.statusCode}: ${err.message}\nResponse body: ${err.responseBody}`
        : err.message;
      return { isError: true, content: [{ type: "text", text: message }] };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { isError: true, content: [{ type: "text", text: `Unexpected error: ${message}` }] };
  }
}
