import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { RunReportSchema } from "./types.js";
import { handleRunReport } from "./tools/run-report.js";
import { listMetrics } from "./tools/list-metrics.js";
import { listGroups } from "./tools/list-groups.js";
import { handleVendorItemCounts } from "./tools/vendor-item-counts.js";
import { handleGetVendors } from "./tools/get-vendors.js";
import { handleVendorSales } from "./tools/vendor-sales.js";
import { handleItemHistory } from "./tools/item-history.js";
import { handleItemSalesVelocity } from "./tools/item-sales-velocity.js";
import { handleSalesGroupedByVendor } from "./tools/sales-grouped-by-vendor.js";
import { handleInventoryByVendor } from "./tools/inventory-by-vendor.js";
import { handleCreateInventoryAdjustment } from "./tools/create-inventory-adjustment.js";

// Warn if env vars are missing — static tools still work without them
if (!process.env.HEARTLAND_API_TOKEN) {
  process.stderr.write("[heartland-mcp] WARNING: HEARTLAND_API_TOKEN is not set. run_report will fail.\n");
}
if (!process.env.HEARTLAND_BASE_URL) {
  process.stderr.write("[heartland-mcp] WARNING: HEARTLAND_BASE_URL is not set. run_report will fail.\n");
}

const server = new McpServer({
  name: "heartland-retail",
  version: "1.0.0",
});

server.tool(
  "run_report",
  "Run a Heartland Retail reporting analyzer query. Returns sales, inventory, and other metrics for the specified date range and groupings.",
  {
    metrics: z.array(z.string()).min(1).describe(
      'Required. Metrics to include, e.g. ["source_sales.net_sales", "source_sales.transactions"]. Use list_metrics to see all options.'
    ),
    groups: z.array(z.string()).optional().describe(
      'Optional. Dimensions to group by, e.g. ["date.date", "location.name"]. Use list_groups to see all options.'
    ),
    start_date: z.string().optional().describe("Optional. Start date in ISO 8601 format (YYYY-MM-DD)."),
    end_date: z.string().optional().describe("Optional. End date in ISO 8601 format (YYYY-MM-DD)."),
    subtotal: z.boolean().optional().describe("Optional. Include subtotal rows in results."),
    sales_filters: z.string().optional().describe("Optional. JSON-encoded filter expression for sales."),
    item_filters: z.string().optional().describe("Optional. JSON-encoded filter expression for items."),
    location_filters: z.string().optional().describe("Optional. JSON-encoded filter expression for locations."),
  },
  async (input) => {
    return handleRunReport(input);
  }
);

server.tool(
  "list_metrics",
  "List all available Heartland Retail reporting metrics organized by category. Use these dotted names in the metrics parameter of run_report.",
  {},
  async () => {
    return {
      content: [{ type: "text" as const, text: listMetrics() }],
    };
  }
);

server.tool(
  "list_groups",
  "List all available Heartland Retail grouping dimensions with descriptions. Use these dotted names in the groups parameter of run_report.",
  {},
  async () => {
    return {
      content: [{ type: "text" as const, text: listGroups() }],
    };
  }
);

server.tool(
  "get_vendors",
  "Search for Heartland Retail vendors by name. Returns vendor id, name, code, status, and contact info. Use this to look up a vendor's id before using it in other tools like get_vendor_item_counts.",
  {
    name: z.string().optional().describe("Optional. Vendor name to search for (fuzzy match). Omit to list all vendors."),
    per_page: z.number().int().min(1).max(200).optional().describe("Optional. Number of results to return (default 50, max 200)."),
  },
  async (input) => {
    return handleGetVendors(input);
  }
);

server.tool(
  "get_vendor_item_counts",
  "Get item counts (ending inventory quantity owned) by vendor, grouped by location, vendor name, item ID, and item description. Useful for checking how many units of each item a vendor has across locations.",
  {
    vendor_id: z.string().describe("Required. The primary vendor ID to filter by, e.g. \"100026\"."),
    end_date: z.string().optional().describe("Optional. Report as-of date in YYYY-MM-DD format. Defaults to today."),
  },
  async (input) => {
    return handleVendorItemCounts(input);
  }
);

server.tool(
  "get_vendor_sales",
  "Get items sold by a specific vendor within a date range, grouped by location, vendor, item ID, and description. Returns qty sold, total cost, open PO qty, on-hand qty, and last sold date.",
  {
    vendor_id: z.string().describe('Required. The primary vendor ID to filter by, e.g. "100026".'),
    start_date: z.string().optional().describe("Optional. Start date in ISO 8601 format (YYYY-MM-DD)."),
    end_date: z.string().optional().describe("Optional. End date in ISO 8601 format (YYYY-MM-DD). Defaults to today."),
  },
  async (input) => {
    return handleVendorSales(input);
  }
);

server.tool(
  "get_item_history",
  "Get the inventory history of a specific item by querying both Inventory Transactions (all qty changes) and Inventory Transfers (movements between locations). Accepts either the internal item_id or the public_id (SKU). Optionally filter by date range.",
  {
    item_id: z.string().optional().describe("The internal Heartland item ID. Either item_id or public_id is required."),
    public_id: z.string().optional().describe("The item's public identifier (SKU/barcode). Used to look up the internal item_id. Either item_id or public_id is required."),
    start_date: z.string().optional().describe("Optional. Filter records on or after this date (YYYY-MM-DD)."),
    end_date: z.string().optional().describe("Optional. Filter records on or before this date (YYYY-MM-DD)."),
    per_page: z.number().int().min(1).max(200).optional().describe("Optional. Number of transaction records to return (default 50, max 200)."),
  },
  async (input) => {
    return handleItemHistory(input);
  }
);

server.tool(
  "get_item_sales_velocity",
  "Calculate how many units are sold per month, broken down by item. Supply a vendor_id to get velocity for every item belonging to that vendor, or supply item_id/public_id for a single item. Returns per-item averages and monthly totals plus the full raw detail rows.",
  {
    vendor_id: z.string().optional().describe("Optional. Primary vendor ID — returns sales velocity for all items belonging to this vendor."),
    item_id: z.string().optional().describe("Optional. Internal Heartland item ID for a single-item query."),
    public_id: z.string().optional().describe("Optional. Item public identifier (SKU/barcode) for a single-item query."),
    start_date: z.string().optional().describe("Optional. Start of date range (YYYY-MM-DD). Defaults to one year ago."),
    end_date: z.string().optional().describe("Optional. End of date range (YYYY-MM-DD). Defaults to today."),
    group_by_location: z.boolean().optional().describe("Optional. When true, break down monthly sales by location in addition to month. Default false."),
  },
  async (input) => {
    return handleItemSalesVelocity(input);
  }
);

server.tool(
  "get_sales_grouped_by_vendor",
  "Get net sales and net qty sold grouped by location and vendor for a given date range.",
  {
    start_date: z.string().optional().describe("Optional. Start date in ISO 8601 format (YYYY-MM-DD)."),
    end_date: z.string().optional().describe("Optional. End date in ISO 8601 format (YYYY-MM-DD). Defaults to today."),
  },
  async (input) => {
    return handleSalesGroupedByVendor(input);
  }
);

server.tool(
  "get_inventory_by_vendor",
  "Get ending inventory levels (qty, cost, and retail price) grouped by location and vendor as of a given date. Defaults to today.",
  {
    date: z.string().optional().describe("Optional. As-of date in YYYY-MM-DD format. Defaults to today."),
  },
  async (input) => {
    return handleInventoryByVendor(input);
  }
);

server.tool(
  "create_inventory_adjustment",
  "Create an inventory adjustment set and add item lines to it. Used to record quantity corrections for items at a specific location. Each line specifies an item, quantity adjusted, and unit cost.",
  {
    location_id: z.string().describe("Required. The location ID where the adjustment applies."),
    adjustment_reason_id: z.string().describe("Required. The ID of the adjustment reason (e.g. shrinkage, count correction)."),
    lines: z.array(
      z.object({
        item_id: z.string().describe("The internal Heartland item ID."),
        qty: z.number().int().describe("Quantity being adjusted (positive to add, negative to remove)."),
        unit_cost: z.number().describe("Cost per unit for this adjustment."),
      })
    ).min(1).describe("Required. One or more item lines to add to the adjustment."),
  },
  async (input) => {
    return handleCreateInventoryAdjustment(input);
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);

process.stderr.write("[heartland-mcp] Server started and listening on stdio.\n");
