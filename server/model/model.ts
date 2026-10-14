import OpenAI from "openai";

// Server-only. The one place that chooses the decision model and provider; swap it here.
// Prototype choice (11 Oct 2026): OpenAI, because Claude API credit isn't available yet.
// gpt-6-luna is OpenAI's current small model ($0.10 / $0.50 per 1M tokens) with
// structured outputs; gpt-5-nano is cheaper but listed as deprecated.
export const SCOUT_MODEL = "gpt-6-luna";

// Reasoning effort for decisions: "none" is fastest, "low" thinks a little. Tune with measurements.
export const DECISION_EFFORT = "low" as const;

let client: OpenAI | null = null;

// Reads OPENAI_API_KEY from the server environment (.env.local in development).
export function getModelClient(): OpenAI {
    client ??= new OpenAI();
    return client;
}

// Turn SDK errors into messages that say what to fix, without exposing credentials.
export function describeModelError(error: unknown): { status: number; error: string } {
    if (error instanceof OpenAI.AuthenticationError) {
        return { status: 500, error: "Authentication failed. Check OPENAI_API_KEY in .env.local, then restart npm run dev." };
    }
    if (error instanceof OpenAI.NotFoundError) {
        return { status: 500, error: `Model ${SCOUT_MODEL} is not available to this API key.` };
    }
    if (error instanceof OpenAI.RateLimitError) {
        return { status: 429, error: "Rate limited or out of API credit. Check billing on platform.openai.com." };
    }
    if (error instanceof OpenAI.APIConnectionError) {
        return { status: 502, error: "Could not reach the model API. Check the network connection." };
    }
    if (error instanceof OpenAI.APIError) {
        return { status: 502, error: `Model API error ${error.status ?? ""}: ${error.message}` };
    }
    return { status: 500, error: "Unexpected error while calling the model." };
}
