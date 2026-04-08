// Think Together — Module tests
// Tests pure functions: constants, counters, dismissal matching, query builder.
// Run: node test.mjs

import { strict as assert } from "node:assert";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
    DISMISSAL_WORDS, DISMISSAL_PATTERN,
    AUTOPILOT_NUDGE_THRESHOLD, MULTITASK_THRESHOLD_MINUTES,
} from "./lib/constants.mjs";
import { counters, initPersistence, saveCounters, loadCounters } from "./lib/counters.mjs";
import { buildTodaysRecapQueries } from "./lib/todays-recap.mjs";

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (e) {
        failed++;
        console.log(`  ❌ ${name}`);
        console.log(`     ${e.message}`);
    }
}

// --- Constants ---
console.log("\n📦 Constants");

test("DISMISSAL_WORDS is a non-empty array", () => {
    assert.ok(Array.isArray(DISMISSAL_WORDS));
    assert.ok(DISMISSAL_WORDS.length > 10);
});

test("AUTOPILOT_NUDGE_THRESHOLD is a positive number", () => {
    assert.equal(typeof AUTOPILOT_NUDGE_THRESHOLD, "number");
    assert.ok(AUTOPILOT_NUDGE_THRESHOLD > 0);
});

test("MULTITASK_THRESHOLD_MINUTES is 15", () => {
    assert.equal(MULTITASK_THRESHOLD_MINUTES, 15);
});

// --- Dismissal Pattern ---
console.log("\n🔍 Dismissal Pattern");

test("matches known dismissals", () => {
    const shouldMatch = ["got it", "ok", "yes", "sure", "lgtm", "sounds good", "👍", "next"];
    for (const word of shouldMatch) {
        assert.ok(DISMISSAL_PATTERN.test(word), `Should match: "${word}"`);
    }
});

test("matches with trailing punctuation", () => {
    assert.ok(DISMISSAL_PATTERN.test("got it."));
    assert.ok(DISMISSAL_PATTERN.test("ok!"));
    assert.ok(DISMISSAL_PATTERN.test("yes."));
});

test("matches case-insensitively", () => {
    assert.ok(DISMISSAL_PATTERN.test("Got It"));
    assert.ok(DISMISSAL_PATTERN.test("OK"));
    assert.ok(DISMISSAL_PATTERN.test("LGTM"));
    assert.ok(DISMISSAL_PATTERN.test("Yes"));
});

test("does NOT match engaged messages", () => {
    const shouldNotMatch = [
        "I think we should refactor this",
        "What about using a different approach?",
        "Let me explain the requirements",
        "got it, but what about edge cases?",
        "ok so the problem is that the cache invalidates",
    ];
    for (const msg of shouldNotMatch) {
        assert.ok(!DISMISSAL_PATTERN.test(msg), `Should NOT match: "${msg}"`);
    }
});

test("does NOT match partial words in longer messages", () => {
    assert.ok(!DISMISSAL_PATTERN.test("okay so here is what I think we should do"));
    assert.ok(!DISMISSAL_PATTERN.test("yes but only for the test environment"));
});

// --- Counters ---
console.log("\n🔢 Counters");

test("counters has expected shape", () => {
    assert.equal(typeof counters.autopilotStreak, "number");
    assert.equal(typeof counters.totalTurns, "number");
    assert.equal(typeof counters.autopilotTurns, "number");
    assert.equal(typeof counters.engagedTurns, "number");
});

test("counters are mutable", () => {
    const before = counters.totalTurns;
    counters.totalTurns++;
    assert.equal(counters.totalTurns, before + 1);
    counters.totalTurns = before; // reset
});

test("save and load round-trips through file", () => {
    const tmpDir = join(tmpdir(), `think-together-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    const tmpFile = join(tmpDir, "counters.json");

    // Set known values
    counters.autopilotStreak = 3;
    counters.totalTurns = 10;
    counters.autopilotTurns = 4;
    counters.engagedTurns = 5;

    initPersistence(tmpFile);
    saveCounters();

    // Verify file was written
    const raw = JSON.parse(readFileSync(tmpFile, "utf-8"));
    assert.equal(raw.totalTurns, 10);
    assert.equal(raw.autopilotTurns, 4);

    // Mutate counters, then reload
    counters.totalTurns = 999;
    counters.engagedTurns = 999;
    loadCounters();
    assert.equal(counters.totalTurns, 10);
    assert.equal(counters.engagedTurns, 5);

    // Cleanup
    rmSync(tmpDir, { recursive: true });
});

test("loadCounters handles missing file gracefully", () => {
    initPersistence(join(tmpdir(), "nonexistent-" + Date.now() + ".json"));
    counters.totalTurns = 42;
    loadCounters(); // should not throw
    assert.equal(counters.totalTurns, 42); // unchanged
});

test("loadCounters handles corrupt file gracefully", () => {
    const tmpDir = join(tmpdir(), `think-together-test-corrupt-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    const tmpFile = join(tmpDir, "counters.json");
    writeFileSync(tmpFile, "not json at all {{{");

    initPersistence(tmpFile);
    counters.totalTurns = 42;
    loadCounters(); // should not throw
    assert.equal(counters.totalTurns, 42); // unchanged

    rmSync(tmpDir, { recursive: true });
});

// --- Today's Recap Queries ---
console.log("\n📊 Today's Recap Queries");

test("buildTodaysRecapQueries returns expected shape", () => {
    const q = buildTodaysRecapQueries();
    assert.equal(typeof q.start, "string");
    assert.equal(typeof q.end, "string");
    assert.equal(typeof q.localDate, "string");
    assert.equal(typeof q.sessionsToday, "string");
    assert.equal(typeof q.engagementBySession, "string");
    assert.equal(typeof q.contextSwitches, "string");
});

test("date range covers exactly one local day", () => {
    const q = buildTodaysRecapQueries();
    const start = new Date(q.start);
    const end = new Date(q.end);
    const diffHours = (end - start) / (1000 * 60 * 60);
    assert.equal(diffHours, 24);
});

test("date range starts at local midnight", () => {
    const q = buildTodaysRecapQueries();
    const start = new Date(q.start);
    const now = new Date();
    // start should be today at 00:00 local
    assert.equal(start.getFullYear(), now.getFullYear());
    assert.equal(start.getMonth(), now.getMonth());
    assert.equal(start.getDate(), now.getDate());
    assert.equal(start.getHours(), 0);
    assert.equal(start.getMinutes(), 0);
});

test("sessionsToday query uses date boundaries", () => {
    const q = buildTodaysRecapQueries();
    assert.ok(q.sessionsToday.includes(q.start));
    assert.ok(q.sessionsToday.includes(q.end));
});

test("engagementBySession includes dismissal heuristics", () => {
    const q = buildTodaysRecapQueries();
    assert.ok(q.engagementBySession.includes("autopilot"));
    assert.ok(q.engagementBySession.includes("got it"));
    assert.ok(q.engagementBySession.includes("👍"));
});

test("contextSwitches uses LAG window function", () => {
    const q = buildTodaysRecapQueries();
    assert.ok(q.contextSwitches.includes("LAG"));
    assert.ok(q.contextSwitches.includes(String(MULTITASK_THRESHOLD_MINUTES)));
});

test("queries use parameterized dates not date('now')", () => {
    const q = buildTodaysRecapQueries();
    // Should NOT use SQLite date('now') — uses JS-computed boundaries instead
    assert.ok(!q.sessionsToday.includes("date('now')"));
    assert.ok(!q.engagementBySession.includes("date('now')"));
    assert.ok(!q.contextSwitches.includes("date('now')"));
});

// --- Summary ---
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
