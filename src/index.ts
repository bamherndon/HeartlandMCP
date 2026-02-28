import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { RunReportSchema } from "./types.js";
import { handleRunReport } from "./tools/run-report.js";
import { listMetrics } from "./tools/list-metrics.js";
import { listGroups } from "./tools/list-groups.js";
import { handleVendorItemCounts } from "./tools/vendor-item-counts.js";
import { handleGetVendors } from "./tools/get-vendors.js";

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

const transport = new StdioServerTransport();
await server.connect(transport);

process.stderr.write("[heartland-mcp] Server started and listening on stdio.\n");
