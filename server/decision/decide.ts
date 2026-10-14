import type { ScoutDecision, ScoutRequest } from "@/lib/scout/core/contracts";
import { readDecision } from "@/lib/scout/core/decision";
import { DECISION_EFFORT, getModelClient, SCOUT_MODEL } from "./model";

// Strict structured output: every field is required, and unused ones are null or empty.
// Inputs are name/value pairs because strict schemas can't have free-form object keys.
const DECISION_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["kind", "workflowId", "inputs", "message"],
    properties: {
        kind: { type: "string", enum: ["run", "answer", "clarify", "unsupported"] },
        workflowId: { type: ["string", "null"] },
        inputs: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["name", "value"],
                properties: { name: { type: "string" }, value: { type: "string" } },
            },
        },
        message: { type: "string" },
    },
};

function buildInstructions(request: ScoutRequest): string {
    return [
        "You are Scout, a live demo assistant inside a software product. A visitor is asking for something.",
        "Choose exactly one response kind:",
        "- run: one of the WORKFLOWS below does what the visitor asks. Set workflowId to its id and give a value for every declared input, using only values the visitor stated or that are unmistakably implied. message: one short sentence saying what you are about to show. Do not say it is done.",
        "- clarify: a workflow fits, but a required input is missing or unclear, or the request could mean more than one workflow. message: one short question.",
        "- answer: the visitor asks a question that the FACTS answer. Answer briefly, using only the facts.",
        "- unsupported: anything else. message: briefly say what you can show instead.",
        "Rules: never invent workflows, inputs, steps, URLs, or facts. For kinds other than run, set workflowId to null and inputs to []. Input names must match the workflow exactly.",
        "",
        "FACTS:",
        ...request.facts.map((fact) => `- ${fact}`),
        "",
        "WORKFLOWS (JSON):",
        JSON.stringify(request.workflows),
    ].join("\n");
}

export type DecideResult =
    | { ok: true; decision: ScoutDecision; modelMs: number }
    | { ok: false; error: string };

export async function decide(request: ScoutRequest): Promise<DecideResult> {
    const started = performance.now();
    const response = await getModelClient().responses.create({
        model: SCOUT_MODEL,
        reasoning: { effort: DECISION_EFFORT },
        max_output_tokens: 400,
        instructions: buildInstructions(request),
        input: [
            ...request.history.map((turn) => ({
                role: turn.role === "visitor" ? ("user" as const) : ("assistant" as const),
                content: turn.text,
            })),
            { role: "user" as const, content: request.message },
        ],
        text: {
            format: { type: "json_schema", name: "scout_decision", schema: DECISION_SCHEMA, strict: true },
        },
    });
    const modelMs = Math.round(performance.now() - started);

    if (response.status !== "completed" || !response.output_text) {
        return { ok: false, error: "The model did not return a complete decision." };
    }

    let raw: unknown;
    try {
        raw = JSON.parse(response.output_text);
    } catch {
        return { ok: false, error: "The model returned invalid JSON." };
    }

    // Convert [{ name, value }] to { name: value } before the shared runtime check.
    if (typeof raw === "object" && raw !== null && "inputs" in raw && Array.isArray(raw.inputs)) {
        const pairs = raw.inputs.filter(
            (pair: unknown): pair is { name: string; value: string } =>
                typeof pair === "object" && pair !== null &&
                "name" in pair && typeof pair.name === "string" &&
                "value" in pair && typeof pair.value === "string"
        );
        raw = { ...raw, inputs: Object.fromEntries(pairs.map((pair) => [pair.name, pair.value])) };
    }

    const decision = readDecision(raw, request.workflows);
    return decision
        ? { ok: true, decision, modelMs }
        : { ok: false, error: "The model's decision did not match the expected shape." };
}
