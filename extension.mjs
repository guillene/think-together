// Think Together — Active AI Engagement Plugin
// Think with Copilot, not through it.
//
// Inspired by active recall and productive thinking pauses from learning science.
// Adds intentional thinking pauses to coding and learning tasks so the user stays
// mentally engaged instead of passively delegating.
//
// Install: copilot plugin install guillene/think-together

import { joinSession } from "@github/copilot-sdk/extension";

const AUTOPILOT_NUDGE_THRESHOLD = 4;
let autopilotStreak = 0;
let totalTurns = 0;
let autopilotTurns = 0;
let engagedTurns = 0;

// Toil detection: track repeated shell command patterns
const commandPatterns = new Map();
const TOIL_THRESHOLD = 3;
const toilSuggested = new Set();

// Dismissal patterns — short acknowledgments, not deep engagement
const DISMISSAL_PATTERN = /^(got it|ok|okay|yes|sure|proceed|go ahead|makes sense|yep|yeah|do it|looks good|lgtm|go for it|sounds good|that works|perfect|great|fine|👍|next|continue)\s*[.!]?$/i;

const THINK_TOGETHER_FRAMEWORK = `
## Think Together — Active AI Engagement Mode

The user wants to engage with AI actively, not passively. These rules create productive thinking pauses that support understanding and skill retention. Think *with* the user, not *for* them.

### Autopilot Bypass
When the user says **"autopilot"** (anywhere in the message), skip ALL thinking pauses below and execute efficiently. This is the trust signal for pure delegation.

### Scope
Apply thinking pauses to: **Coding tasks** and **Learning/Research tasks**
Skip for: Work item filing, simple file operations, administrative tasks

---

### Active Engagement Coding Protocol

**Before generating code:**
1. Briefly explain the approach (2-3 sentences)
2. Ask: "Does this make sense before I implement?"

**After generating code:**
1. Ask 1-2 questions about the solution (e.g., "What does this line do?", "Why X instead of Y?")
2. The user can dismiss with "got it" — no need to answer if they understood

**Why before How:** For complex requests, ask "What outcome are you optimizing for?" before diving in.

**Exception:** Skip for typos, simple fixes, or autopilot mode.

---

### Active Engagement Learning & Research Protocol

**Teach-back:** For complex topics, ask the user to explain what they're trying to understand before researching. "What do you already know about X?"

**After research:**
- End with: "📝 Consider processing this on paper before we continue."
- Ask a question connecting to existing knowledge when relevant

**Note suggestions:** After generating valuable content, suggest: "This could become a permanent note. Want me to draft it?"

---

### Toil Detection

Actively watch for:
- Repetitive manual steps
- Tasks that could be scripted/automated
- Processes done manually that could be templated

When detected, proactively suggest automation. Don't repeat the same suggestion twice per session.

---

### Hands-On Nudge

If the user has been in autopilot mode for several consecutive coding tasks, gently ask: "You've been delegating a lot lately. Want to take this one more hands-on?"
`.trim();

const session = await joinSession({
    hooks: {
        onSessionStart: async () => {
            return {
                additionalContext: THINK_TOGETHER_FRAMEWORK,
            };
        },
        onUserPromptSubmitted: async (input) => {
            totalTurns++;
            const keywordMatch = /\bautopilot\b/i.test(input.prompt);
            let modeMatch = false;
            try {
                const { mode } = await session.rpc.mode.get();
                modeMatch = mode === "autopilot";
            } catch {
                // RPC unavailable — fall back to keyword detection only
            }

            if (keywordMatch || modeMatch) {
                autopilotTurns++;
                autopilotStreak++;
                await session.log("⚡ Autopilot mode — executing efficiently.", { ephemeral: true });

                return {
                    additionalContext:
                        "The user is in autopilot mode. Skip ALL Think Together thinking pauses for this message. Execute efficiently without asking clarifying questions or quizzing afterward.",
                };
            }

            // Non-autopilot turn resets the streak
            autopilotStreak = 0;

            // Positive reinforcement: track engaged vs dismissal turns
            const trimmed = input.prompt.trim();
            if (trimmed.length > 0 && !DISMISSAL_PATTERN.test(trimmed)) {
                engagedTurns++;
            }
        },
        onPostToolUse: async (input) => {
            if (input.toolName !== "powershell") return;

            const cmd = String(input.toolArgs?.command || "");
            const pattern = extractCommandPattern(cmd);
            if (!pattern) return;

            const count = (commandPatterns.get(pattern) || 0) + 1;
            commandPatterns.set(pattern, count);

            if (count >= TOIL_THRESHOLD && !toilSuggested.has(pattern)) {
                toilSuggested.add(pattern);
                return {
                    additionalContext:
                        `Toil detected: the command pattern "${pattern}" has been run ${count} times this session. ` +
                        "Proactively suggest to the user that this could be automated with a script, alias, or function.",
                };
            }
        },
        onSessionEnd: async () => {
            const parts = [];
            if (engagedTurns > 0) {
                parts.push(`🧠 You thought deeply on ${engagedTurns} turn${engagedTurns === 1 ? "" : "s"}`);
            }
            if (autopilotTurns > 0) {
                parts.push(`⚡ ${autopilotTurns}/${totalTurns} turns in autopilot`);
            }
            if (parts.length > 0) {
                await session.log(`📊 Session recap: ${parts.join(" · ")}`);
            }
        },
    },
    tools: [],
});

/**
 * Extract a normalized command pattern from a shell command.
 * Splits on && and pipes, takes the first meaningful command,
 * and returns the first 2-3 tokens as the pattern key.
 */
function extractCommandPattern(cmd) {
    const trimmed = cmd.trim();
    if (!trimmed) return null;

    // Take the first sub-command (before && or |)
    const firstCmd = trimmed.split(/\s*(?:&&|\|\|?)\s*/)[0].trim();

    // Skip leading cd commands to get the actual work command
    const withoutCd = firstCmd.replace(/^cd\s+[^\s]+\s*(?:&&\s*)?/, "").trim();
    const target = withoutCd || firstCmd;

    // Extract first 2 tokens as the pattern (e.g., "git add", "npm test")
    const tokens = target.split(/\s+/).slice(0, 2);
    if (tokens.length === 0) return null;

    return tokens.join(" ").toLowerCase();
}
