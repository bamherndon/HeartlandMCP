import type { RunReportInput, ReportResponse } from "./types.js";

export class HeartlandApiError extends Error {
  statusCode: number;
  responseBody: string;

  constructor(message: string, statusCode: number, responseBody: string) {
    super(message);
    this.name = "HeartlandApiError";
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

function getCredentials(): { token: string; baseUrl: string } {
  const token = process.env.HEARTLAND_API_TOKEN;
  const baseUrl = process.env.HEARTLAND_BASE_URL;
  if (!token) {
    throw new HeartlandApiError("HEARTLAND_API_TOKEN environment variable is not set", 0, "");
  }
  if (!baseUrl) {
    throw new HeartlandApiError("HEARTLAND_BASE_URL environment variable is not set", 0, "");
  }
  return { token, baseUrl: baseUrl.replace(/\/$/, "") };
}

export async function callApi(path: string, params: URLSearchParams): Promise<unknown> {
  const { token, baseUrl } = getCredentials();
  const url = new URL(`${baseUrl}${path}`);
  url.search = params.toString();

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const rawBody = await response.text();

  if (!response.ok) {
    throw new HeartlandApiError(
      `Heartland API error: ${response.status} ${response.statusText}`,
      response.status,
      rawBody
    );
  }

  return JSON.parse(rawBody);
}

export async function callAnalyzerApi(params: URLSearchParams): Promise<ReportResponse> {
  return callApi("/api/reporting/analyzer", params) as Promise<ReportResponse>;
}

export async function runReport(input: RunReportInput): Promise<ReportResponse> {
  const params = new URLSearchParams();

  for (const metric of input.metrics) {
    params.append("metrics[]", metric);
  }
  if (input.groups) {
    for (const group of input.groups) {
      params.append("groups[]", group);
    }
  }
  if (input.start_date) params.append("start_date", input.start_date);
  if (input.end_date) params.append("end_date", input.end_date);
  if (input.subtotal !== undefined) params.append("subtotal", String(input.subtotal));
  if (input.sales_filters) params.append("sales_filters", input.sales_filters);
  if (input.item_filters) params.append("item_filters", input.item_filters);
  if (input.location_filters) params.append("location_filters", input.location_filters);

  return callAnalyzerApi(params);
}
