// Counter state + persistence for Think Together session tracking
//
// Counters are a shared mutable object so all importers see the same state.
// Persistence writes to a JSON file in the session workspace — failures are
// silently ignored (degraded > crashed).

import { readFileSync, writeFileSync } from "node:fs";

export const counters = {
    autopilotStreak: 0,
    totalTurns: 0,
    autopilotTurns: 0,
    engagedTurns: 0,
};

let countersPath = null;

export function initPersistence(path) {
    countersPath = path;
}

export function saveCounters() {
    if (!countersPath) return;
    try {
        writeFileSync(countersPath, JSON.stringify(counters));
    } catch {
        // Non-critical — counters will just reset on next restart
    }
}

export function loadCounters() {
    if (!countersPath) return;
    try {
        const data = JSON.parse(readFileSync(countersPath, "utf-8"));
        counters.autopilotStreak = data.autopilotStreak || 0;
        counters.totalTurns = data.totalTurns || 0;
        counters.autopilotTurns = data.autopilotTurns || 0;
        counters.engagedTurns = data.engagedTurns || 0;
    } catch {
        // File doesn't exist yet or is corrupt — start fresh
    }
}
