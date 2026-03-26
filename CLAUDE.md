# HeartlandMCP

## Documentation Maintenance
After any code change, always update both files before committing:
- **CLAUDE.md** — keep the Tools section and API conventions accurate and concise
- **README.md** — keep the Available Tools section in sync (parameters, descriptions, example prompts); update example workflows if relevant

## API Documentation
Heartland Retail API docs: https://dev.retail.heartland.us/

## API Parameter Conventions (heartland-client.ts)
- Group dimensions use `group[]` (not `groups[]`)
- Filter params use dot notation: `sale.filters`, `item.filters`, `location.filters`
- Date group dimension for month is `date.month_of_year` (not `date.month`)

## Tools

### Analyzer (run_report)
Calls the Heartland analyzer API. Filters are JSON-encoded strings passed as `sale.filters`, `item.filters`, `location.filters`.

### get_vendors
Search vendors by name. Returns id, name, code, status, contact info.

### get_vendor_item_counts
Ending inventory qty owned by vendor, grouped by location/vendor/item. Uses `callAnalyzerApi`.

### get_vendor_sales (vendor-sales.ts)
Items sold by a vendor in a date range. Filters by `primary_vendor_id` via `item.filters`. Groups by location, vendor, item public_id, item description. Metrics: total_cost, net_qty_sold, open PO qty, on-hand qty, last sold date.

### get_item_history (item-history.ts)
Inventory history for a single item. Accepts `item_id` or `public_id` (SKU — resolved via `/api/items`). Fetches:
- `/api/inventory/transactions` filtered by `item_id`
- `/api/inventory/transfers` (recent 50), then fans out to fetch lines per transfer filtered by `item_id`

### get_item_sales_velocity (item-sales-velocity.ts)
Monthly sales velocity per item. Accepts `vendor_id`, `item_id`, or `public_id`. Uses analyzer with groups: `location.name`, `date.month_of_year`, `item.public_id`, `item.description`. Computes per-item and overall averages (avg qty/month, avg net sales/month) from the raw rows.

### get_inventory_by_vendor (inventory-by-vendor.ts)
Ending inventory as of a given date, grouped by `location.name` and `vendor.name`. Only sets `end_date`. Metrics: `ending_inventory.qty_owned`, `ending_inventory.cost_owned`, `ending_inventory.price_owned`.

### get_sales_grouped_by_vendor (sales-grouped-by-vendor.ts)
Net sales and net qty sold for a date range, grouped by `location.name` and `vendor.name`. Metrics: `source_sales.net_sales`, `source_sales.net_qty_sold`. No vendor filter — returns all vendors.

### list_locations (list-locations.ts)
Lists all locations. GET `/api/locations`. Returns id, name, code, status.

### get_item (get-item.ts)
Fetches a single item by `item_id` (GET `/api/items/{id}`) or by `public_id` (GET `/api/items?~[public_id]=...`). Returns full item record.

### create_inventory_adjustment (create-inventory-adjustment.ts)
Creates an inventory adjustment set and adds item lines to it. Uses `callApiPost` (POST with JSON body).
- Step 1: `POST /api/inventory/adjustment_sets` with `location_id` and `adjustment_reason_id`. Extracts adjustment set ID from response body `id` field or `Location` header.
- Step 2: `POST /api/inventory/adjustment_sets/{id}/lines` for each line with `item_id`, `qty`, `unit_cost`. Lines are POSTed sequentially.
