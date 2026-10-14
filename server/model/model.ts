import OpenAI from "openai";

// Server-only. The one place that chooses the decision model and provider; swap it here.
// Never import this from code that can reach a browser bundle.
if (typeof window !== "undefined") throw new Error("server/model must not run in a browser.");

// Prototype choice (11 Oct 2026): OpenAI, because Claude API credit isn't available yet.
// gpt-6-luna is OpenAI's current small model with structured outputs; gpt-5-nano is cheaper
// but listed as deprecated.
export const SCOUT_MODEL = "gpt-6-luna";

// Reasoning effort for decisions: "none" is fastest, "low" thinks a little. Tune with measurements.
export const DECISION_EFFORT = "low" as const;

// Price per million tokens, for the cost cap. Update with SCOUT_MODEL.
export const PRICE_PER_MILLION = { input: 0.10, output: 0.50 };

export const costUsd = (usage: { inputTokens: number; outputTokens: number }) =>
    (usage.inputTokens * PRICE_PER_MILLION.input + usage.outputTokens * PRICE_PER_MILLION.output) / 1_000_000;

let client: OpenAI | null = null;

// Reads OPENAI_API_KEY from the server environment (.env.local in development, the host's
// variables in production). The key never leaves the server.
export function getModelClient(): OpenAI {
    client ??= new OpenAI();
    return client;
}

// Map SDK errors to the contract's codes (CLOUD_DESIGN §3.6). The real cause goes to the
// server log only; the response never echoes provider text.
export function describeModelError(error: unknown): { status: number; error: string; detail: string; retryAfterS?: number } {
    const log = (cause: string) => console.error(`[scout] model call failed: ${cause}`);
    if (error instanceof OpenAI.RateLimitError) {
        log(`rate limited or out of credit (${error.status ?? ""})`);
        return { status: 503, error: "unavailable", detail: "Scout is unavailable right now.", retryAfterS: 30 };
    }
    if (error instanceof OpenAI.AuthenticationError) log("authentication failed; check OPENAI_API_KEY");
    else if (error instanceof OpenAI.NotFoundError) log(`model ${SCOUT_MODEL} is not available to this key`);
    else if (error instanceof OpenAI.APIConnectionError) log("could not reach the model API");
    else if (error instanceof OpenAI.APIError) log(`API error ${error.status ?? ""}: ${error.message}`);
    else log(error instanceof Error ? error.message : String(error));
    return { status: 502, error: "model_error", detail: "Scout couldn't get a decision. Please try again." };
}
