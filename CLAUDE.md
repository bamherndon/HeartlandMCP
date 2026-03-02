# HeartlandMCP

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
