// Focused checks for the D1 cloud: passcodes, rate limits, the cost cap and the JSON store.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.SCOUT_DATA_DIR = await mkdtemp(join(tmpdir(), "scout-cloud-test-"));
process.env.SCOUT_GLOBAL_MONTHLY_BUDGET_USD = "0.001";

const { hashPasscode, newPasscode, newProjectId, newPublishableKey, passcodeMatches } = await import("./auth.ts");
const { capReached, rateLimit, recordSpend, resetRateLimits } = await import("./usage/limits.ts");
const store = await import("./store/store.ts");
const { catalogFor, publicWorkflow } = await import("./catalog.ts");

const workflow = {
    id: "invite-teammate-abc", version: 3, title: "Invite", purpose: "Invite a teammate", examples: [],
    inputs: [{ name: "email", label: "Email", example: "sam@x.com" }],
    steps: [{ action: "ui.type", target: { description: "Email", strategies: [{ kind: "label" as const, text: "Email" }] },
              input: { value: { $input: "email" } } }],
};

test("keys, ids and passcodes have the documented shapes", () => {
    assert.match(newPublishableKey(), /^scout_pk_[0-9A-Za-z]{24}$/);
    assert.ok(store.isProjectId(newProjectId()));
    assert.match(newPasscode(), /^[2-9a-hjkmnp-z]{4}-[2-9a-hjkmnp-z]{4}-[2-9a-hjkmnp-z]{4}$/);
});

test("a passcode matches only its own hash, ignoring case and surrounding spaces", () => {
    const passcode = newPasscode();
    const project = { id: "prj_test000001", name: "t", publishableKey: newPublishableKey(), teachPasscodeHash: hashPasscode(passcode), configVersion: 1, createdAt: "" };
    assert.equal(passcodeMatches(project, ` ${passcode.toUpperCase()} `), true);
    assert.equal(passcodeMatches(project, "wrong-pass-code"), false);
    assert.equal(passcodeMatches(project, null), false);
});

test("the rate limit refuses the request after the limit and reports Retry-After", () => {
    resetRateLimits();
    assert.equal(rateLimit("b", 2, 60_000, 0).ok, true);
    assert.equal(rateLimit("b", 2, 60_000, 1).ok, true);
    const third = rateLimit("b", 2, 60_000, 2);
    assert.ok(!third.ok && third.retryAfterS === 60);
    assert.equal(rateLimit("b", 2, 60_000, 60_000).ok, true, "a new window starts");
});

test("the hard cost cap trips once month-to-date spend reaches it", async () => {
    assert.equal(await capReached(), false);
    await recordSpend(0.0006);
    assert.equal(await capReached(), false);
    await recordSpend(0.0006);
    assert.equal(await capReached(), true);
});

test("the store round-trips projects and workflows, and finds a project by key", async () => {
    const project = { id: newProjectId(), name: "Demo", publishableKey: newPublishableKey(), teachPasscodeHash: "00", configVersion: 1, createdAt: new Date().toISOString() };
    await store.saveProject(project);
    assert.equal((await store.findProjectByKey(project.publishableKey))?.id, project.id);
    await store.saveWorkflow(project.id, { workflow, status: "draft", updatedAt: "now" });
    const listed = await store.listWorkflows(project.id);
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.workflow.id, workflow.id);
    assert.equal(await store.bumpConfigVersion(project.id), 2);
    assert.equal(await store.deleteWorkflow(project.id, workflow.id), true);
    assert.equal((await store.listWorkflows(project.id)).length, 0);
});

test("the store refuses unsafe ids, so nothing escapes the data folder", async () => {
    assert.equal(await store.getProject("../../etc"), null);
    assert.equal(await store.getWorkflow("prj_test000001", "../secret"), null);
    await assert.rejects(store.saveWorkflow("prj_test000001", { workflow: { ...workflow, id: "../x" }, status: "draft", updatedAt: "" }));
});

test("visitors never receive recorded example values, and the model sees only the catalog", () => {
    const visible = publicWorkflow(workflow);
    assert.equal("example" in (visible.inputs[0] ?? {}), false);
    const [entry] = catalogFor([workflow]);
    assert.deepEqual(entry, { id: workflow.id, title: "Invite", purpose: "Invite a teammate", examples: [], inputs: [{ name: "email", label: "Email" }] });
});
