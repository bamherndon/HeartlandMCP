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
- `date.*` — date, week, month, quarter, year, day of week
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

---

## Development

```bash
npm run build    # compile TypeScript
npm run dev      # watch mode
```

API documentation: https://dev.retail.heartland.us/
