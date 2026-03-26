# Heartland Retail MCP Server

An MCP (Model Context Protocol) server that connects Claude to the [Heartland Retail](https://dev.retail.heartland.us/) API. Ask Claude natural-language questions about your sales, inventory, and vendors — Claude will call the right tools and summarize the results.

---

## Setup

### Prerequisites

- Node.js 18+
- A Heartland Retail API token ([how to get one](https://dev.retail.heartland.us/#authentication))
- Claude Code CLI (`npm install -g @anthropic-ai/claude-code`)

### Step 1 — Get a Heartland API Token

1. Log in to your Heartland Retail dashboard
2. Click your name in the top right → **My Account**
3. Click **API** to open the API Tokens page
4. Click **Generate new token**, enter a description, then click **Generate Token**
5. Copy the token immediately — it won't be shown again

Full details: https://dev.retail.heartland.us/#authentication

### Step 2 — Install & Build

```bash
git clone https://github.com/bamherndon/HeartlandMCP.git
cd HeartlandMCP
npm install
npm run build
```

### Step 3 — Register with Claude Code

Run this command once to register the server. Replace `your_token` and `yourstore` with your actual values:

```bash
claude mcp add heartland-retail \
  --transport stdio \
  --scope user \
  -e HEARTLAND_API_TOKEN=your_token \
  -e HEARTLAND_BASE_URL=https://yourstore.retail.heartland.us \
  -- node /path/to/HeartlandMCP/dist/index.js
```

> **Note:** `--scope user` registers the server for all your Claude Code sessions. Use `--scope local` to limit it to the current project only.

### Step 4 — Verify the Connection

Start a new Claude Code session and run:

```
/mcp
```

You should see `heartland-retail` listed with a green connected status. You can now ask Claude questions about your Heartland data.

---

## Available Tools

### `get_vendors`
Search for vendors by name. Use this to find a vendor's numeric ID before running inventory reports.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `name` | No | Vendor name to search (fuzzy match). Omit to list all. |
| `per_page` | No | Results to return (default 50, max 200). |

**Example prompts:**
- "Find vendors named Levi"
- "List all vendors"
- "Search for vendors matching Nike and show 100 results"

---

### `get_vendor_item_counts`
Returns ending inventory quantity owned, grouped by location, vendor, item ID, and item description — for a specific vendor.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `vendor_id` | Yes | Vendor's numeric ID (use `get_vendors` to look it up). |
| `end_date` | No | As-of date in `YYYY-MM-DD` format. Defaults to today. |

**Example prompts:**
- "How many units do we have from vendor 100026?"
- "Show item counts for vendor 100026 as of January 31st"
- "Find the vendor ID for Levi's, then show their item counts"

---

### `get_vendor_sales`
Returns items sold by a specific vendor within a date range, grouped by location, vendor, item ID, and description.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `vendor_id` | Yes | Vendor's numeric ID (use `get_vendors` to look it up). |
| `start_date` | No | Start date in `YYYY-MM-DD` format. |
| `end_date` | No | End date in `YYYY-MM-DD` format. Defaults to today. |

**Returns:** qty sold, total cost, open PO qty, on-hand qty, last sold date — per item per location.

**Example prompts:**
- "What did vendor 100026 sell last month?"
- "Show me sales from Columbia Sportswear for Q1 2026"

---

### `get_item_history`
Returns the full inventory history for a single item — all quantity changes (transactions) and transfers between locations.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `item_id` | One of | Internal Heartland item ID. |
| `public_id` | One of | Item SKU or barcode (looked up automatically). |
| `start_date` | No | Filter on or after this date (`YYYY-MM-DD`). |
| `end_date` | No | Filter on or before this date (`YYYY-MM-DD`). |
| `per_page` | No | Number of transaction records to return (default 50, max 200). |

**Example prompts:**
- "Show me the inventory history for SKU ABC123"
- "What happened to item 987654 in January?"

---

### `get_item_sales_velocity`
Calculates units sold per month, broken down by item. Returns per-item averages and monthly totals.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `vendor_id` | One of | Returns velocity for all items from this vendor. |
| `item_id` | One of | Internal Heartland item ID for a single item. |
| `public_id` | One of | Item SKU/barcode for a single item. |
| `start_date` | No | Start of date range (`YYYY-MM-DD`). Defaults to one year ago. |
| `end_date` | No | End of date range (`YYYY-MM-DD`). Defaults to today. |
| `group_by_location` | No | Break down monthly sales by location. Default `false`. |

**Returns:** avg qty/month, avg net sales/month, monthly breakdown — per item and overall.

**Example prompts:**
- "What's the sales velocity for vendor 100026 over the past year?"
- "How fast is SKU ABC123 selling?"
- "Show monthly sales by location for item 987654"

---

### `get_inventory_by_vendor`
Returns ending inventory qty, cost, and retail price grouped by location and vendor as of a given date.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `date` | No | As-of date in `YYYY-MM-DD` format. Defaults to today. |

**Example prompts:**
- "Show me inventory levels by vendor as of today"
- "What inventory did each vendor have on February 28th?"

---

### `get_sales_grouped_by_vendor`
Returns net sales and net qty sold grouped by location and vendor for a given date range.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `start_date` | No | Start date in `YYYY-MM-DD` format. |
| `end_date` | No | End date in `YYYY-MM-DD` format. Defaults to today. |

**Example prompts:**
- "Show me sales by vendor for March 2026"
- "What did each vendor sell last week?"
- "Give me a vendor sales summary for Q1 2026"

---

### `create_inventory_adjustment`
Create an inventory adjustment set and add item lines to it. Used to record quantity corrections at a specific location.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `location_id` | Yes | The location ID where the adjustment applies. |
| `adjustment_reason_id` | Yes | The ID of the adjustment reason (e.g. shrinkage, count correction). |
| `lines` | Yes | Array of lines to add. Each line requires `item_id`, `qty` (positive to add, negative to remove), and `unit_cost`. |

**Returns:** The created adjustment set ID, the full adjustment set response, and the result of each added line.

**Example prompts:**
- "Create an inventory adjustment at location 5 with reason 3, adding 10 units of item 12345 at cost 9.99"
- "Adjust down 2 units of item 99887 at location 1 for shrinkage (reason 2), unit cost 5.00"

---

### `run_report`
Run a flexible reporting analyzer query against any combination of metrics, groupings, and date ranges.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `metrics` | Yes | One or more metric names (use `list_metrics` to see options). |
| `groups` | No | Dimensions to group results by (use `list_groups` to see options). |
| `start_date` | No | Start date in `YYYY-MM-DD` format. |
| `end_date` | No | End date in `YYYY-MM-DD` format. |
| `subtotal` | No | Include subtotal rows (`true`/`false`). |
| `sales_filters` | No | JSON-encoded filter expression for sales. |
| `item_filters` | No | JSON-encoded filter expression for items. |
| `location_filters` | No | JSON-encoded filter expression for locations. |

**Example prompts:**
- "Show me net sales by location for last month"
- "What were total transactions and gross sales by day this week?"
- "Run a report on gross margin and cost grouped by vendor for Q1"
- "Show ending inventory quantity and retail value by department"

---

### `list_metrics`
Returns the full catalog of available metric names to use in `run_report`.

**Categories:**
- `source_sales.*` — net sales, gross sales, discounts, returns, tax, transactions, items sold, average sale, cost, gross profit, gross margin
- `location_sales.*` — same as above plus sellthrough and inventory turn
- `beginning_inventory.*` / `ending_inventory.*` — quantity, cost, retail, items, SKUs, styles, departments, classes, vendors, seasons, locations, reorder/restock/overstock flags, averages
- `shipping.*` — shipped, received, cost
- `payment.*` — amount, count

**Example prompts:**
- "What metrics are available?"
- "List all inventory metrics I can report on"

---

### `list_groups`
Returns all available grouping dimensions to use in `run_report`.

**Categories:**
- `item.*` — description, SKU, UPC, department, class, subclass, vendor, season, style, custom fields
- `customer.*` — name, email, city, state, zip, customer type
- `location.*` — name, code
- `date.*` — date, week, month_of_year, quarter, year, day of week
- `time.*` — hour
- `payment.*` — payment type, tender

**Example prompts:**
- "What can I group a report by?"
- "Show me all available date groupings"

---

## Example Workflows

**Monthly sales summary by location:**
> "Show me net sales, transactions, and gross margin by location for February 2026"

**Vendor inventory lookup:**
> "Find the vendor ID for 'Columbia Sportswear', then show me how many units we have from them as of today"

**Slow-moving inventory:**
> "Run a report on ending inventory quantity grouped by department and vendor — I want to see what's sitting"

**Daily sales trend:**
> "What were our net sales by day for the past 30 days?"

**Vendor sell-through:**
> "Find the vendor ID for Columbia Sportswear, then show me what they sold last quarter and how many units we still have on hand"

**Item velocity and reorder planning:**
> "What's the sales velocity for vendor 100026 over the past year? Which items are selling fastest?"

**Item audit:**
> "Show me the full inventory history for SKU ABC123 — all transactions and transfers"

---

## Development

```bash
npm run build    # compile TypeScript
npm run dev      # watch mode
```

API documentation: https://dev.retail.heartland.us/
