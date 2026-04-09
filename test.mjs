// Think Together — Module tests
// Tests pure functions: constants, counters, dismissal matching, query builder.
// Run: node test.mjs

import { strict as assert } from "node:assert";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
    DISMISSAL_WORDS, DISMISSAL_PATTERN, DELEGATION_WORDS, DELEGATION_PATTERN,
    AUTOPILOT_NUDGE_THRESHOLD, MULTITASK_THRESHOLD_MINUTES,
} from "./lib/constants.mjs";
import { counters, initPersistence, saveCounters, loadCounters } from "./lib/counters.mjs";
import { classifyTurn, stripSystemPrefix } from "./lib/classify.mjs";
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
    assert.ok(Array.isArray(counters.turnLog));
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

    counters.autopilotStreak = 3;
    counters.totalTurns = 10;
    counters.autopilotTurns = 4;
    counters.engagedTurns = 5;
    counters.delegationTurns = 2;
    counters.turnLog = [{ c: 'engaged', m: 'test msg' }, { c: 'autopilot', m: '/fleet go' }];

    initPersistence(tmpFile);
    saveCounters();

    const raw = JSON.parse(readFileSync(tmpFile, "utf-8"));
    assert.equal(raw.totalTurns, 10);
    assert.equal(raw.turnLog.length, 2);
    assert.equal(raw.turnLog[0].c, 'engaged');

    counters.totalTurns = 999;
    counters.turnLog = [];
    loadCounters();
    assert.equal(counters.totalTurns, 10);
    assert.equal(counters.turnLog.length, 2);

    rmSync(tmpDir, { recursive: true });
});

test("loadCounters handles old file without delegationTurns or turnLog", () => {
    const tmpDir = join(tmpdir(), `think-together-test-compat-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    const tmpFile = join(tmpDir, "counters.json");
    writeFileSync(tmpFile, JSON.stringify({
        autopilotStreak: 1, totalTurns: 5, autopilotTurns: 2, engagedTurns: 3,
    }));

    initPersistence(tmpFile);
    counters.delegationTurns = 99;
    counters.turnLog = [{ c: 'test', m: 'old' }];
    loadCounters();
    assert.equal(counters.totalTurns, 5);
    assert.equal(counters.delegationTurns, 0);
    assert.deepEqual(counters.turnLog, []);

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

test("stripSystemPrefix removes emoji+sentence prefixes", () => {
    assert.equal(
        stripSystemPrefix("⚠️ GitHub MCP server not configured. Research FlaUI-MCP"),
        "Research FlaUI-MCP"
    );
});

test("stripSystemPrefix leaves normal messages unchanged", () => {
    assert.equal(stripSystemPrefix("research FlaUI-MCP"), "research FlaUI-MCP");
    assert.equal(stripSystemPrefix("Hello. World"), "Hello. World");
});

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

test("classifies system-prefixed research tasks as delegation", () => {
    assert.equal(classifyTurn("⚠️ GitHub MCP server not configured. Research FlaUI-MCP"), "delegation");
    assert.equal(classifyTurn("⚠️ GitHub MCP server not configured. Investigate the auth module"), "delegation");
});

test("classifies questions as engaged (active seeking)", () => {
    assert.equal(classifyTurn("Why not use Redis?"), "engaged");
    assert.equal(classifyTurn("What about edge cases?"), "engaged");
    assert.equal(classifyTurn("How does this interact with the rest of the system?"), "engaged");
    assert.equal(classifyTurn("Can you explain why it says 2 autopilot?"), "engaged");
});

test("classifies reasoning as engaged (connectors)", () => {
    assert.equal(classifyTurn("I like this but we need error handling"), "engaged");
    assert.equal(classifyTurn("This works because the cache invalidates"), "engaged");
    assert.equal(classifyTurn("We should use Redis instead of Memcached"), "engaged");
});

test("classifies opinions as engaged", () => {
    assert.equal(classifyTurn("I think we should refactor this"), "engaged");
    assert.equal(classifyTurn("Let's use dependency injection here"), "engaged");
    assert.equal(classifyTurn("We should add tests for this"), "engaged");
    assert.equal(classifyTurn("What about using a different approach"), "engaged");
    assert.equal(classifyTurn("I want to understand the architecture"), "engaged");
});

test("classifies context-providing as engaged", () => {
    assert.equal(classifyTurn("The problem is that the cache invalidates too early"), "engaged");
    assert.equal(classifyTurn("The issue is with the auth middleware"), "engaged");
    assert.equal(classifyTurn("It should return a 404 not a 500"), "engaged");
});

test("classifies corrections as engaged", () => {
    assert.equal(classifyTurn("Actually, that's not how it works"), "engaged");
    assert.equal(classifyTurn("No, the endpoint returns JSON"), "engaged");
    assert.equal(classifyTurn("Wait, we need to handle the null case"), "engaged");
});

test("classifies constraints as engaged", () => {
    assert.equal(classifyTurn("We need to support backwards compatibility"), "engaged");
    assert.equal(classifyTurn("Make sure the tests pass before merging"), "engaged");
});

test("classifies short non-signal messages as interaction", () => {
    assert.equal(classifyTurn("you can use /fleet"), "interaction");
    assert.equal(classifyTurn("session recap"), "interaction");
    assert.equal(classifyTurn("today's recap"), "interaction");
    assert.equal(classifyTurn("thanks"), "interaction");
    assert.equal(classifyTurn("cool"), "interaction");
});

test("classifies commands as interaction", () => {
    assert.equal(classifyTurn("/fleet research X"), "interaction");
    assert.equal(classifyTurn("/chronicle tips"), "interaction");
});

test("empty and whitespace messages are interaction", () => {
    assert.equal(classifyTurn(""), "interaction");
    assert.equal(classifyTurn("   "), "interaction");
});

test("does NOT classify referential mentions as delegation", () => {
    assert.notEqual(classifyTurn("should we research this first?"), "delegation");
    assert.notEqual(classifyTurn("I want to investigate why this happens"), "delegation");
});

// --- Summary ---
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
