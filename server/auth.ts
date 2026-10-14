// D1 credentials (contract §2.6): a public project key, and a per-project teach passcode
// stored only as a peppered hash.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { findProjectByKey, getProject, type ProjectRecord } from "./store/store.ts";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
// Passcodes avoid look-alike characters (0/O, 1/l/I) because admins type them.
const PASSCODE_CHARS = "23456789abcdefghjkmnpqrstuvwxyz";

function randomString(length: number, alphabet: string): string {
    let out = "";
    while (out.length < length) {
        for (const byte of randomBytes(length)) {
            // Rejection sampling keeps every character equally likely.
            if (byte < 256 - (256 % alphabet.length)) out += alphabet[byte % alphabet.length];
            if (out.length === length) break;
        }
    }
    return out;
}

export const newProjectId = () => `prj_${randomString(10, "0123456789abcdefghijklmnopqrstuvwxyz")}`;
export const newPublishableKey = () => `scout_pk_${randomString(24, BASE62)}`;
export const newPasscode = () => [0, 1, 2].map(() => randomString(4, PASSCODE_CHARS)).join("-");

function pepper(): string {
    const value = process.env.SCOUT_TOKEN_PEPPER;
    if (value) return value;
    if (process.env.NODE_ENV === "production") throw new Error("SCOUT_TOKEN_PEPPER is not set.");
    return "scout-dev-pepper-not-for-production";
}

export function hashPasscode(passcode: string): string {
    return createHmac("sha256", pepper()).update(passcode.trim().toLowerCase()).digest("hex");
}

export function passcodeMatches(project: ProjectRecord, given: string | null): boolean {
    if (!given) return false;
    const expected = Buffer.from(project.teachPasscodeHash, "hex");
    const actual = Buffer.from(hashPasscode(given), "hex");
    return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// The publishable key comes from X-Scout-Key, or ?key= on a GET (avoids a CORS preflight).
export async function projectFromKey(request: Request): Promise<ProjectRecord | null> {
    const key = request.headers.get("x-scout-key") ?? new URL(request.url).searchParams.get("key");
    if (!key || !/^scout_pk_[0-9A-Za-z]{24}$/.test(key)) return null;
    return findProjectByKey(key);
}

// Admin (teach) calls name the project in the path and carry the teach passcode.
export async function projectForTeach(
    request: Request,
    projectId: string
): Promise<{ ok: true; project: ProjectRecord } | { ok: false; status: number; error: string; detail: string }> {
    const project = await getProject(projectId);
    // An unknown project and a wrong passcode look the same from outside.
    const given = request.headers.get("x-scout-teach-passcode");
    if (!given) return { ok: false, status: 401, error: "missing_credentials", detail: "Teach mode needs the project's teach passcode." };
    let matches: boolean;
    try {
        matches = project !== null && passcodeMatches(project, given);
    } catch (error) {
        // A deployment without SCOUT_TOKEN_PEPPER can't check passcodes; say so instead of a bare 500.
        console.error(`[scout] ${error instanceof Error ? error.message : String(error)}`);
        return { ok: false, status: 503, error: "unavailable", detail: "Scout Cloud is not fully configured yet." };
    }
    if (!project || !matches) {
        return { ok: false, status: 401, error: "invalid_credentials", detail: "That teach passcode isn't right for this project." };
    }
    return { ok: true, project };
}
