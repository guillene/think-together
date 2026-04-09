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
                counters.turnLog.push({ c: 'autopilot', m: input.prompt.trim().slice(0, 80) });
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
            counters.turnLog.push({ c: category, m: input.prompt.trim().slice(0, 80) });
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
                if (counters.totalTurns === 0) return "No activity tracked yet.";

                const other = counters.totalTurns - counters.engagedTurns - counters.autopilotTurns - counters.delegationTurns;
                return `SESSION RECAP DATA (live tracking — authoritative)

Total: ${counters.totalTurns} | 🧠 Engaged: ${counters.engagedTurns} | ⚡ Autopilot: ${counters.autopilotTurns} | 🔀 Delegation: ${counters.delegationTurns} | 💬 Other: ${other}

== FORMAT THE RESULTS AS ==

# 📊 Session Recap

Show summary: "{total} turns — {engaged} engaged, {autopilot} autopilot, {delegation} delegation, {other} other"

Table with one row per non-zero category (emoji + label + count):
🧠 Engaged | ⚡ Autopilot | 🔀 Delegation | 💬 Other (dismissals + short interactions)

## What we accomplished
Summarize the key work done this session based on your conversation history. Group into logical work items.

## 🔍 Engagement insight
One brief observation about the engagement pattern. Non-judgmental.`;
            },
        },
        {
            name: "session_recap_debug",
            description:
                "Debug version of session_recap — shows per-turn classification for fine-tuning. " +
                "Call when the user asks for session recap debug or detailed turn breakdown.",
            parameters: { type: "object", properties: {} },
            handler: async () => {
                const log = counters.turnLog;
                if (log.length === 0) return "No turns tracked yet.";

                const rows = log.map((t, i) => `${i}|${t.m}|${t.c}`).join('\n');
                const engaged = log.filter(t => t.c === 'engaged').length;
                const autopilot = log.filter(t => t.c === 'autopilot').length;
                const delegation = log.filter(t => t.c === 'delegation').length;
                const dismissal = log.filter(t => t.c === 'dismissal').length;
                const interaction = log.filter(t => t.c === 'interaction').length;
                return `SESSION RECAP DEBUG (live tracking — authoritative)

== TURN LOG (index|message_preview|category) ==
${rows}

== TOTALS ==
🧠 Engaged: ${engaged} | ⚡ Autopilot: ${autopilot} | 🔀 Delegation: ${delegation} | 💬 Dismissal: ${dismissal} | 💬 Interaction: ${interaction}

== FORMAT AS ==

# 🔬 Session Recap — Debug

Table with columns: Turn | Message | Classification
- Classification emoji: 🧠 engaged, ⚡ autopilot, 🔀 delegation, 💬 dismissal, 💬 interaction
- Show totals below the table.
- Flag any turns that seem miscategorized.`;
            },
        },
        todaysRecapTool,
    ],
});

