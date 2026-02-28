import { z } from "zod";

export const RunReportSchema = z.object({
  metrics: z.array(z.string()).min(1, "At least one metric is required"),
  groups: z.array(z.string()).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  subtotal: z.boolean().optional(),
  sales_filters: z.string().optional(),
  item_filters: z.string().optional(),
  location_filters: z.string().optional(),
});

export type RunReportInput = z.infer<typeof RunReportSchema>;

export interface ReportResponse {
  [key: string]: unknown;
}
