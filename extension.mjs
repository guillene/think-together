// Think Together — Active AI Engagement Plugin
// Think with Copilot, not through it.
//
// Inspired by active recall and productive thinking pauses from learning science.
// Adds intentional thinking pauses to coding and learning tasks so the user stays
// mentally engaged instead of passively delegating.
//
// Install: copilot plugin install guillene/think-together

import { joinSession } from "@github/copilot-sdk/extension";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { AUTOPILOT_NUDGE_THRESHOLD } from "./lib/constants.mjs";
import { counters, initPersistence, saveCounters, loadCounters } from "./lib/counters.mjs";
import { classifyTurn } from "./lib/classify.mjs";
import { THINK_TOGETHER_FRAMEWORK } from "./lib/framework.mjs";
import { buildSessionRecapQuery } from "./lib/session-recap.mjs";
import { todaysRecapTool } from "./lib/todays-recap.mjs";

const session = await joinSession({
    hooks: {
        onSessionStart: async () => {
            if (session.workspacePath) {
                const dir = join(session.workspacePath, "files");
                try { mkdirSync(dir, { recursive: true }); } catch {}
                initPersistence(join(dir, "think-together-counters.json"));
                loadCounters();
            }
            return {
                additionalContext: THINK_TOGETHER_FRAMEWORK,
            };
        },
        onUserPromptSubmitted: async (input) => {
            counters.totalTurns++;

            // Autopilot: mode-only detection via RPC (no keyword matching)
            let isAutopilot = false;
            try {
                const { mode } = await session.rpc.mode.get();
                isAutopilot = mode === "autopilot";
            } catch {
                // RPC unavailable — assume not autopilot
            }

            // Fleet command detection — counts as autopilot delegation
            const isFleet = /^\/fleet\b/i.test(input.prompt.trim());

            if (isAutopilot || isFleet) {
                counters.autopilotTurns++;
                counters.autopilotStreak++;
                saveCounters();

                return {
                    additionalContext:
                        "The user is in autopilot mode. Skip ALL Think Together thinking pauses for this message. Execute efficiently without asking clarifying questions or quizzing afterward.",
                };
            }

            // Non-autopilot: classify the turn
            const streakBeforeReset = counters.autopilotStreak;
            counters.autopilotStreak = 0;

            const category = classifyTurn(input.prompt);
            if (category === 'engaged') counters.engagedTurns++;
            if (category === 'delegation') counters.delegationTurns++;
            saveCounters();

            if (streakBeforeReset >= AUTOPILOT_NUDGE_THRESHOLD) {
                return {
                    additionalContext:
                        `The user just came back from ${streakBeforeReset} consecutive autopilot turns. ` +
                        "Gently suggest they take this one more hands-on — e.g., \"You've been delegating a lot lately. Want to take this one more hands-on?\" " +
                        "Keep it light, not preachy. If the task is clearly administrative, skip the nudge.",
                };
            }
        },
    },
    tools: [
        {
            name: "session_recap",
            description:
                "Shows Think Together session stats: engaged turns, autopilot turns, and toil patterns detected. " +
                "Call when the user asks for a session recap or engagement summary. " +
                "For cross-session daily stats, use todays_recap instead.",
            parameters: { type: "object", properties: {} },
            handler: async () => {
                // Extract session ID from workspace path for full-session query
                let sessionId = null;
                if (session.workspacePath) {
                    sessionId = session.workspacePath.replace(/\\/g, '/').split('/').pop();
                }

                if (!sessionId) {
                    // No workspace path — fall back to live counters only
                    const parts = [];
                    parts.push(`Total turns: ${counters.totalTurns}`);
                    if (counters.engagedTurns > 0) parts.push(`🧠 Engaged turns: ${counters.engagedTurns}`);
                    if (counters.autopilotTurns > 0) parts.push(`⚡ Autopilot turns: ${counters.autopilotTurns}`);
                    if (counters.delegationTurns > 0) parts.push(`🔀 Delegation turns: ${counters.delegationTurns}`);
                    const other = counters.totalTurns - counters.engagedTurns - counters.autopilotTurns - counters.delegationTurns;
                    if (other > 0) parts.push(`💬 Other: ${other}`);
                    if (counters.totalTurns === 0) return "No activity tracked yet.";
                    return `📊 Session recap (live counters only — no session store available)\n${parts.join("\n")}`;
                }

                const q = buildSessionRecapQuery(sessionId);
                return `SESSION RECAP DATA
Session ID: ${q.sessionId}
Timezone: ${q.timezone}

== LIVE COUNTERS (extension-tracked subset — may be partial if extension reloaded) ==
Total turns: ${counters.totalTurns}
Engaged: ${counters.engagedTurns}
Autopilot: ${counters.autopilotTurns}
Delegation: ${counters.delegationTurns}

== RUN THIS QUERY (database: "session_store") ==

--- Per-turn classification ---
${q.turnDetail}

== FORMAT THE RESULTS AS ==

# 📊 Session Recap

## Turn-by-turn breakdown
Table with columns: Turn | Your Message | Classification
- Use the query results. Show message_preview (truncated at 80 chars).
- Classification emoji: 🧠 engaged, ⚡ autopilot, 🔀 delegation, 💬 dismissal, 💬 interaction
- **IMPORTANT: All timestamps are UTC. Convert to ${q.timezone} for display.**

## Summary
Count each category from the query results (NOT from live counters — the query is authoritative).
Format: "{total} turns — {engaged} engaged, {autopilot} autopilot, {delegation} delegation, {other} other (dismissals + interactions)"

## What we accomplished
Summarize the key work done based on the message previews. Group related turns into logical work items.

## 🔍 Engagement insight
One observation about the engagement pattern — were there sustained engaged stretches, or was it mostly delegation? Keep it brief and non-judgmental.`;
            },
        },
        todaysRecapTool,
    ],
});

