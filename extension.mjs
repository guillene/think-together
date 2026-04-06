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
            const keywordMatch = /\bautopilot\b/i.test(input.prompt);
            let modeMatch = false;
            try {
                const { mode } = await session.rpc.mode.get();
                modeMatch = mode === "autopilot";
            } catch {
                // RPC unavailable — fall back to keyword detection only
            }

            if (keywordMatch || modeMatch) {
                autopilotStreak++;
                await session.log("⚡ Autopilot mode — executing efficiently.", { ephemeral: true });

                let context =
                    "The user is in autopilot mode. Skip ALL Think Together thinking pauses for this message. Execute efficiently without asking clarifying questions or quizzing afterward.";

                if (autopilotStreak >= AUTOPILOT_NUDGE_THRESHOLD) {
                    context +=
                        `\n\nThe user has been in autopilot for ${autopilotStreak} consecutive turns. ` +
                        'Before executing, gently ask: "You\'ve been delegating for a while now. Want to take this one more hands-on?" ' +
                        "If they decline, proceed in autopilot. Only nudge once — don't repeat if they dismiss it.";
                    autopilotStreak = 0;
                }

                return { additionalContext: context };
            }

            // Non-autopilot turn resets the streak
            autopilotStreak = 0;
        },
    },
    tools: [],
});
