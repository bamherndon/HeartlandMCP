export function listGroups(): string {
  const groups = {
    item: {
      description: "Group by item/product attributes",
      dimensions: [
        { name: "item.description", description: "Item description/name" },
        { name: "item.sku", description: "Stock keeping unit" },
        { name: "item.upc", description: "Universal product code" },
        { name: "item.department", description: "Item department" },
        { name: "item.class", description: "Item class" },
        { name: "item.subclass", description: "Item subclass" },
        { name: "item.vendor", description: "Vendor/supplier name" },
        { name: "item.season", description: "Season code" },
        { name: "item.style", description: "Style number" },
        { name: "item.custom_field_1", description: "Custom field 1" },
        { name: "item.custom_field_2", description: "Custom field 2" },
        { name: "item.custom_field_3", description: "Custom field 3" },
      ],
    },
    customer: {
      description: "Group by customer attributes",
      dimensions: [
        { name: "customer.name", description: "Customer full name" },
        { name: "customer.email", description: "Customer email address" },
        { name: "customer.city", description: "Customer city" },
        { name: "customer.state", description: "Customer state" },
        { name: "customer.zip", description: "Customer postal code" },
        { name: "customer.customer_type", description: "Customer type/group" },
      ],
    },
    location: {
      description: "Group by store location",
      dimensions: [
        { name: "location.name", description: "Location/store name" },
        { name: "location.code", description: "Location code" },
      ],
    },
    date: {
      description: "Group by time period",
      dimensions: [
        { name: "date.date", description: "Individual date (YYYY-MM-DD)" },
        { name: "date.week", description: "Week number" },
        { name: "date.month", description: "Month (YYYY-MM)" },
        { name: "date.quarter", description: "Quarter (YYYY-Q#)" },
        { name: "date.year", description: "Year" },
        { name: "date.day_of_week", description: "Day of week (0=Sunday)" },
      ],
    },
    time: {
      description: "Group by time of day",
      dimensions: [
        { name: "time.hour", description: "Hour of day (0-23)" },
      ],
    },
    payment: {
      description: "Group by payment method",
      dimensions: [
        { name: "payment.payment_type", description: "Payment type (cash, credit, etc.)" },
        { name: "payment.tender", description: "Tender description" },
      ],
    },
  };

  return JSON.stringify(groups, null, 2);
}
