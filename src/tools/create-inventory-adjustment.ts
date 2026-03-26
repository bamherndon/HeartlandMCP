import { callApiPost, HeartlandApiError } from "../heartland-client.js";

interface AdjustmentLine {
  item_id: string;
  qty: number;
  unit_cost: number;
}

function extractIdFromLocation(locationHeader: string): string | null {
  // Location header is like: https://store.retail.heartland.us/api/inventory/adjustment_sets/12345
  const match = locationHeader.match(/\/(\d+)\s*$/);
  return match ? match[1] : null;
}

export async function handleCreateInventoryAdjustment(input: {
  location_id: string;
  adjustment_reason_id: string;
  lines: AdjustmentLine[];
}): Promise<{
  isError?: boolean;
  content: Array<{ type: "text"; text: string }>;
}> {
  try {
    // Step 1: Create the adjustment set
    const { data: setData, locationHeader } = await callApiPost(
      "/api/inventory/adjustment_sets",
      {
        location_id: input.location_id,
        adjustment_reason_id: input.adjustment_reason_id,
      }
    );

    // Extract adjustment set ID from response body or Location header
    let adjustmentSetId: string | null = null;
    if (setData && typeof setData === "object" && "id" in (setData as object)) {
      adjustmentSetId = String((setData as { id: unknown }).id);
    } else if (locationHeader) {
      adjustmentSetId = extractIdFromLocation(locationHeader);
    }

    if (!adjustmentSetId) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Adjustment set created but could not determine its ID.\nResponse: ${JSON.stringify(setData)}\nLocation: ${locationHeader}`,
          },
        ],
      };
    }

    // Step 2: Add each line sequentially to avoid rate limiting
    const lineResults: unknown[] = [];
    for (const line of input.lines) {
      const { data } = await callApiPost(
        `/api/inventory/adjustment_sets/${adjustmentSetId}/lines`,
        {
          item_id: line.item_id,
          qty: line.qty,
          unit_cost: line.unit_cost,
        }
      );
      lineResults.push(data);
    }

    const output = {
      adjustment_set_id: adjustmentSetId,
      adjustment_set: setData,
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
