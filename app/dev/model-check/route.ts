import { describeModelError, getModelClient, SCOUT_MODEL } from "../../../server/model/model.ts";

// Development-only access check: is the key working, is the model available to it,
// and how long does one tiny call take? Each visit costs a fraction of a cent.
export async function GET() {
    if (process.env.NODE_ENV === "production") {
        return new Response("Not found", { status: 404 });
    }

    const client = getModelClient();
    try {
        await client.models.retrieve(SCOUT_MODEL);

        const started = performance.now();
        const response = await client.responses.create({
            model: SCOUT_MODEL,
            reasoning: { effort: "none" },
            max_output_tokens: 64,
            input: "Reply with exactly the word: ok",
        });
        const elapsedMs = Math.round(performance.now() - started);

        return Response.json({
            ok: true,
            model: response.model,
            elapsedMs,
            status: response.status ?? null,
            reply: response.output_text.trim(),
            usage: response.usage
                ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens }
                : null,
        });
    } catch (error) {
        const { status, error: code, detail } = describeModelError(error);
        return Response.json({ error: code, detail }, { status });
    }
}
