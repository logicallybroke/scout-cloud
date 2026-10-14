import { stat } from "node:fs/promises";
import { dataDir } from "../../server/store/store.ts";

export const dynamic = "force-dynamic";

// For the host's health check: is the data folder reachable? Never calls the model.
export async function GET() {
    try {
        await stat(dataDir());
        return Response.json({ ok: true });
    } catch {
        return Response.json({ ok: false, detail: "The data folder is not available." }, { status: 503 });
    }
}
