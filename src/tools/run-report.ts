import { runReport, HeartlandApiError } from "../heartland-client.js";
import type { RunReportInput } from "../types.js";

export async function handleRunReport(input: RunReportInput): Promise<{
  isError?: boolean;
  content: Array<{ type: "text"; text: string }>;
}> {
  try {
    const result = await runReport(input);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (err) {
    if (err instanceof HeartlandApiError) {
      const message =
        err.statusCode > 0
          ? `API error ${err.statusCode}: ${err.message}\nResponse body: ${err.responseBody}`
          : err.message;
      return {
        isError: true,
        content: [{ type: "text", text: message }],
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return {
      isError: true,
      content: [{ type: "text", text: `Unexpected error: ${message}` }],
    };
  }
}
