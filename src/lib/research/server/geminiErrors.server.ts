import { z } from "zod";

const errorEnvelope = z.object({
  error: z.object({
    message: z.string().optional(),
    status: z.string().optional(),
    details: z.array(z.object({ reason: z.string().optional() })).optional(),
  }),
});
const statuses = new Set([
  "INVALID_ARGUMENT",
  "FAILED_PRECONDITION",
  "UNAUTHENTICATED",
  "PERMISSION_DENIED",
  "NOT_FOUND",
  "RESOURCE_EXHAUSTED",
  "INTERNAL",
  "UNAVAILABLE",
  "DEADLINE_EXCEEDED",
]);

/** Classify provider diagnostics without returning messages, request data, keys or project metadata. */
export function geminiRequestError(httpStatus: number, raw: unknown): Error {
  const parsed = errorEnvelope.safeParse(raw);
  const provider = parsed.success ? parsed.data.error : undefined;
  const reasons = new Set(provider?.details?.map((detail) => detail.reason));
  const message = provider?.message ?? "";
  const status = provider?.status && statuses.has(provider.status) ? `; ${provider.status}` : "";
  const prefix = `Gemini request failed (HTTP ${httpStatus}${status}).`;
  let hint: string;
  if (
    reasons.has("API_KEY_INVALID") ||
    reasons.has("API_KEY_EXPIRED") ||
    /api key (?:not valid|is invalid|is expired|has expired)/i.test(message)
  ) {
    hint =
      "The server API key is invalid or expired. Update GEMINI_API_KEY in server secrets and restart the server.";
  } else if (
    reasons.has("API_KEY_HTTP_REFERRER_BLOCKED") ||
    reasons.has("API_KEY_IP_ADDRESS_BLOCKED") ||
    reasons.has("API_KEY_SERVICE_BLOCKED")
  ) {
    hint =
      "The API key restrictions block this server request. Check its allowed API and server access restrictions in Google Cloud.";
  } else if (reasons.has("SERVICE_DISABLED")) {
    hint = "Enable the Generative Language API for the server key’s Google Cloud project.";
  } else if (
    reasons.has("BILLING_DISABLED") ||
    reasons.has("BILLING_NOT_ACTIVE") ||
    (/billing|free tier is not available/i.test(message) &&
      provider?.status === "FAILED_PRECONDITION")
  ) {
    hint =
      "This request requires an enabled billing plan for the server key’s Google project. Check Gemini billing and regional availability.";
  } else if (httpStatus === 400) {
    hint = /schema.*(?:complex|constraint)|(?:complex|constraint).*schema/i.test(message)
      ? "Gemini rejected the structured-output schema. Simplify the provider schema; local finding validation remains required."
      : "Gemini rejected the request format or input. Check the structured-output schema, image data, request limits and selected model capabilities.";
  } else if (httpStatus === 401) {
    hint =
      "Gemini could not authenticate the server request. Check GEMINI_API_KEY in server secrets and restart the server.";
  } else if (httpStatus === 403) {
    hint =
      "The server key lacks permission for this request. Check API restrictions, project permissions and model access.";
  } else if (httpStatus === 404) {
    hint =
      "The selected model is unavailable for this API/account. Check GEMINI_MODEL and its generateContent support.";
  } else if (httpStatus === 413) {
    hint = "The analysis input is too large for Gemini. Reduce sampled frames or session length.";
  } else if (httpStatus === 429) {
    hint =
      "Gemini quota or rate limits were reached. Check quota and billing, then retry later. No automatic retry was made.";
  } else if (httpStatus >= 500) {
    hint = "Gemini is temporarily unavailable. Retry later; the recording remains saved locally.";
  } else {
    hint = "Gemini rejected this request. Check server configuration and model capabilities.";
  }
  return new Error(`${prefix} ${hint} No analysis findings were saved.`);
}
