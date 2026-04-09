// Think Together — Module tests
// Tests pure functions: constants, counters, dismissal matching, query builder.
// Run: node test.mjs

import { strict as assert } from "node:assert";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
    DISMISSAL_WORDS, DISMISSAL_PATTERN, DELEGATION_WORDS, DELEGATION_PATTERN,
    AUTOPILOT_NUDGE_THRESHOLD, MULTITASK_THRESHOLD_MINUTES, MIN_ENGAGED_LENGTH,
} from "./lib/constants.mjs";
import { counters, initPersistence, saveCounters, loadCounters } from "./lib/counters.mjs";
import { classifyTurn } from "./lib/classify.mjs";
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

test("MIN_ENGAGED_LENGTH is 30", () => {
    assert.equal(MIN_ENGAGED_LENGTH, 30);
});

// --- Delegation Pattern ---
console.log("\n🔀 Delegation Pattern");

test("DELEGATION_WORDS is a non-empty array", () => {
    assert.ok(Array.isArray(DELEGATION_WORDS));
    assert.ok(DELEGATION_WORDS.length >= 5);
});

test("matches imperative delegation commands", () => {
    const shouldMatch = [
        "research FlaUI-MCP",
        "investigate the auth module",
        "look into why the tests fail",
        "deep dive into the codebase",
        "file a bug for the crash",
        "create a task for next sprint",
        "summarize the PR comments",
    ];
    for (const msg of shouldMatch) {
        assert.ok(DELEGATION_PATTERN.test(msg), `Should match: "${msg}"`);
    }
});

test("matches case-insensitively", () => {
    assert.ok(DELEGATION_PATTERN.test("Research this topic"));
    assert.ok(DELEGATION_PATTERN.test("INVESTIGATE the issue"));
});

test("does NOT match referential/embedded mentions", () => {
    const shouldNotMatch = [
        "should we research this first?",
        "I want to investigate why this happens",
        "can you look into this?",
        "let me deep dive into the code",
        "why did you file a bug?",
        "the research shows that...",
    ];
    for (const msg of shouldNotMatch) {
        assert.ok(!DELEGATION_PATTERN.test(msg), `Should NOT match: "${msg}"`);
    }
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
    assert.equal(typeof counters.delegationTurns, "number");
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
    counters.delegationTurns = 2;

    initPersistence(tmpFile);
    saveCounters();

    // Verify file was written
    const raw = JSON.parse(readFileSync(tmpFile, "utf-8"));
    assert.equal(raw.totalTurns, 10);
    assert.equal(raw.autopilotTurns, 4);
    assert.equal(raw.delegationTurns, 2);

    // Mutate counters, then reload
    counters.totalTurns = 999;
    counters.engagedTurns = 999;
    counters.delegationTurns = 999;
    loadCounters();
    assert.equal(counters.totalTurns, 10);
    assert.equal(counters.engagedTurns, 5);
    assert.equal(counters.delegationTurns, 2);

    // Cleanup
    rmSync(tmpDir, { recursive: true });
});

test("loadCounters handles old file without delegationTurns", () => {
    const tmpDir = join(tmpdir(), `think-together-test-compat-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    const tmpFile = join(tmpDir, "counters.json");
    // Old format without delegationTurns
    writeFileSync(tmpFile, JSON.stringify({
        autopilotStreak: 1, totalTurns: 5, autopilotTurns: 2, engagedTurns: 3,
    }));

    initPersistence(tmpFile);
    counters.delegationTurns = 99;
    loadCounters();
    assert.equal(counters.totalTurns, 5);
    assert.equal(counters.delegationTurns, 0); // defaults to 0

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
    assert.equal(typeof q.timezone, "string");
    assert.equal(typeof q.sessionsToday, "string");
    assert.equal(typeof q.engagementBySession, "string");
    assert.equal(typeof q.contextSwitches, "string");
});

test("timezone is a valid IANA zone name", () => {
    const q = buildTodaysRecapQueries();
    // IANA zone names contain a slash (e.g., America/Los_Angeles, Europe/London)
    // or are UTC/GMT
    assert.ok(q.timezone.includes('/') || q.timezone === 'UTC', `Expected IANA zone, got: ${q.timezone}`);
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

test("engagementBySession includes delegation heuristics", () => {
    const q = buildTodaysRecapQueries();
    assert.ok(q.engagementBySession.includes("delegation_turns"));
    assert.ok(q.engagementBySession.includes("engaged_turns"));
    assert.ok(q.engagementBySession.includes("research"));
});

test("engagementBySession detects fleet as autopilot", () => {
    const q = buildTodaysRecapQueries();
    assert.ok(q.engagementBySession.includes("/fleet"));
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

// --- classifyTurn ---
console.log("\n🏷️  classifyTurn");

test("classifies dismissals", () => {
    assert.equal(classifyTurn("got it"), "dismissal");
    assert.equal(classifyTurn("ok"), "dismissal");
    assert.equal(classifyTurn("yes"), "dismissal");
    assert.equal(classifyTurn("LGTM"), "dismissal");
    assert.equal(classifyTurn("sounds good."), "dismissal");
});

test("classifies delegation (imperative commands)", () => {
    assert.equal(classifyTurn("research FlaUI-MCP"), "delegation");
    assert.equal(classifyTurn("investigate the auth module"), "delegation");
    assert.equal(classifyTurn("look into why tests fail"), "delegation");
    assert.equal(classifyTurn("deep dive into the codebase"), "delegation");
    assert.equal(classifyTurn("file a bug for the crash"), "delegation");
    assert.equal(classifyTurn("summarize the PR"), "delegation");
});

test("classifies engaged turns (substantive messages)", () => {
    assert.equal(classifyTurn("I think we should refactor the auth module to use dependency injection"), "engaged");
    assert.equal(classifyTurn("The problem is that the cache invalidates too aggressively on writes"), "engaged");
    assert.equal(classifyTurn("Let me explain the requirements for this feature"), "engaged");
});

test("classifies questions as engaged regardless of length", () => {
    assert.equal(classifyTurn("Why not use Redis?"), "engaged");
    assert.equal(classifyTurn("What about edge cases?"), "engaged");
    assert.equal(classifyTurn("How does this interact with the rest of the system?"), "engaged");
});

test("very short questions are not engaged", () => {
    // Under 15 chars with '?' — too short to be meaningful
    assert.equal(classifyTurn("why?"), "interaction");
    assert.equal(classifyTurn("what?"), "interaction");
});

test("classifies short non-question messages as interaction", () => {
    assert.equal(classifyTurn("you can use /fleet"), "interaction");
    assert.equal(classifyTurn("session recap"), "interaction");
    assert.equal(classifyTurn("today's recap"), "interaction");
    assert.equal(classifyTurn("thanks"), "interaction");
});

test("empty and whitespace messages are interaction", () => {
    assert.equal(classifyTurn(""), "interaction");
    assert.equal(classifyTurn("   "), "interaction");
});

test("does NOT classify referential mentions as delegation", () => {
    // These start with other words, not imperative delegation verbs
    assert.notEqual(classifyTurn("should we research this first?"), "delegation");
    assert.notEqual(classifyTurn("I want to investigate why this happens"), "delegation");
    assert.notEqual(classifyTurn("the research shows that this is correct"), "delegation");
});

test("mentioning 'autopilot' in a question is NOT classified as autopilot-related", () => {
    // classifyTurn doesn't handle autopilot (that's mode-only now)
    // but it should classify these as engaged, not something weird
    assert.equal(classifyTurn("Can you explain why it says 2 autopilot?"), "engaged");
    assert.equal(classifyTurn("Why did autopilot trigger on that message?"), "engaged");
});

test("/fleet command at start is NOT classified as delegation", () => {
    // /fleet is handled separately as autopilot in extension.mjs, not by classifyTurn
    // classifyTurn sees it as a short interaction
    assert.equal(classifyTurn("/fleet research X and Y"), "interaction");
});

// --- Summary ---
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
