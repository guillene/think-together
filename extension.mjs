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

import { AUTOPILOT_NUDGE_THRESHOLD, DISMISSAL_PATTERN } from "./lib/constants.mjs";
import { counters, initPersistence, saveCounters, loadCounters } from "./lib/counters.mjs";
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
            const keywordMatch = /\bautopilot\b/i.test(input.prompt);
            let modeMatch = false;
            try {
                const { mode } = await session.rpc.mode.get();
                modeMatch = mode === "autopilot";
            } catch {
                // RPC unavailable — fall back to keyword detection only
            }

            if (keywordMatch || modeMatch) {
                counters.autopilotTurns++;
                counters.autopilotStreak++;
                saveCounters();
                await session.log("⚡ Autopilot mode — executing efficiently.", { ephemeral: true });

                return {
                    additionalContext:
                        "The user is in autopilot mode. Skip ALL Think Together thinking pauses for this message. Execute efficiently without asking clarifying questions or quizzing afterward.",
                };
            }

            // Non-autopilot turn: check if returning from a long autopilot streak
            const streakBeforeReset = counters.autopilotStreak;
            counters.autopilotStreak = 0;

            // Positive reinforcement: track engaged vs dismissal turns
            const trimmed = input.prompt.trim();
            if (trimmed.length > 0 && !DISMISSAL_PATTERN.test(trimmed)) {
                counters.engagedTurns++;
            }
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
                const parts = [];
                parts.push(`Total turns: ${counters.totalTurns}`);
                if (counters.engagedTurns > 0) {
                    parts.push(`🧠 Engaged turns: ${counters.engagedTurns}`);
                }
                if (counters.autopilotTurns > 0) {
                    parts.push(`⚡ Autopilot turns: ${counters.autopilotTurns}`);
                }
                if (parts.length === 1 && counters.totalTurns === 0) {
                    return "No activity tracked yet.";
                }
                return `📊 Session recap\n${parts.join("\n")}`;
            },
        },
        todaysRecapTool,
    ],
});

