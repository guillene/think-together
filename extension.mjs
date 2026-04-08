// Think Together — Active AI Engagement Plugin
// Think with Copilot, not through it.
//
// Inspired by active recall and productive thinking pauses from learning science.
// Adds intentional thinking pauses to coding and learning tasks so the user stays
// mentally engaged instead of passively delegating.
//
// Install: copilot plugin install guillene/think-together

import { joinSession } from "@github/copilot-sdk/extension";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const AUTOPILOT_NUDGE_THRESHOLD = 4;
let autopilotStreak = 0;
let totalTurns = 0;
let autopilotTurns = 0;
let engagedTurns = 0;

// Persistence: save counters to session workspace so they survive extension restarts
let countersPath = null;

function saveCounters() {
    if (!countersPath) return;
    try {
        writeFileSync(countersPath, JSON.stringify({
            autopilotStreak, totalTurns, autopilotTurns, engagedTurns,
        }));
    } catch {
        // Non-critical — counters will just reset on next restart
    }
}

function loadCounters() {
    if (!countersPath) return;
    try {
        const data = JSON.parse(readFileSync(countersPath, "utf-8"));
        autopilotStreak = data.autopilotStreak || 0;
        totalTurns = data.totalTurns || 0;
        autopilotTurns = data.autopilotTurns || 0;
        engagedTurns = data.engagedTurns || 0;
    } catch {
        // File doesn't exist yet or is corrupt — start fresh
    }
}

// Dismissal words — shared between live regex (current session) and SQL heuristic (cross-session)
const DISMISSAL_WORDS = [
    'got it', 'ok', 'okay', 'yes', 'sure', 'proceed', 'go ahead',
    'makes sense', 'yep', 'yeah', 'do it', 'looks good', 'lgtm',
    'go for it', 'sounds good', 'that works', 'perfect', 'great',
    'fine', '👍', 'next', 'continue',
];
const DISMISSAL_PATTERN = new RegExp(
    `^(${DISMISSAL_WORDS.join('|')})\\s*[.!]?$`, 'i'
);

const MULTITASK_THRESHOLD_MINUTES = 15;

function buildTodaysRecapQueries() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    const start = startOfDay.toISOString();
    const end = endOfDay.toISOString();
    const localDate = now.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const dismissalSql = DISMISSAL_WORDS
        .filter(w => w !== '👍')
        .map(w => `lower(trim(t.user_message)) LIKE '${w}%'`)
        .join('\n            OR ');

    const sessionsToday = `SELECT s.id, COALESCE(s.summary, 'Untitled session') as summary, s.cwd, s.created_at
FROM sessions s
WHERE s.created_at >= '${start}' AND s.created_at < '${end}'
ORDER BY s.created_at`;

    const engagementBySession = `SELECT
  t.session_id,
  COALESCE(s.summary, 'Untitled session') as session_name,
  COUNT(*) as total_turns,
  SUM(CASE WHEN lower(t.user_message) LIKE '%autopilot%' THEN 1 ELSE 0 END) as autopilot_turns,
  SUM(CASE WHEN length(trim(t.user_message)) < 30 AND (
            ${dismissalSql}
            OR trim(t.user_message) = '👍'
        ) THEN 1 ELSE 0 END) as dismissal_turns,
  MIN(t.timestamp) as first_turn,
  MAX(t.timestamp) as last_turn
FROM turns t
JOIN sessions s ON t.session_id = s.id
WHERE t.timestamp >= '${start}' AND t.timestamp < '${end}'
GROUP BY t.session_id
ORDER BY MIN(t.timestamp)`;

    const contextSwitches = `WITH ordered_turns AS (
  SELECT
    t.session_id,
    COALESCE(s.summary, 'Untitled') as session_name,
    t.timestamp,
    LAG(t.session_id) OVER (ORDER BY t.timestamp) as prev_session_id,
    LAG(t.timestamp) OVER (ORDER BY t.timestamp) as prev_timestamp
  FROM turns t
  JOIN sessions s ON t.session_id = s.id
  WHERE t.timestamp >= '${start}' AND t.timestamp < '${end}'
)
SELECT
  session_id, session_name, timestamp,
  prev_session_id, prev_timestamp,
  ROUND((julianday(timestamp) - julianday(prev_timestamp)) * 24 * 60, 1) as gap_minutes
FROM ordered_turns
WHERE prev_session_id IS NOT NULL
  AND session_id != prev_session_id
  AND (julianday(timestamp) - julianday(prev_timestamp)) * 24 * 60 < ${MULTITASK_THRESHOLD_MINUTES}
ORDER BY timestamp`;

    return { start, end, localDate, sessionsToday, engagementBySession, contextSwitches };
}

const THINK_TOGETHER_FRAMEWORK = `
## Think Together — Active AI Engagement Mode

The user wants to engage with AI actively, not passively. These rules create productive thinking pauses that support understanding and skill retention. Think *with* the user, not *for* them.

### Autopilot Bypass
When the user says **"autopilot"** (anywhere in the message), skip ALL thinking pauses below and execute efficiently. This is the trust signal for pure delegation.

### Scope
Apply thinking pauses to: **Coding tasks**, **Learning/Research tasks**, and **Data Analysis tasks**
Skip for: Work item filing, simple file operations, administrative tasks

---

### Active Engagement Coding Protocol

**Before generating code:**
1. Explain the approach (3-10 sentences, scaling with problem complexity — 3 for a simple rename, up to 10 for multi-component design)
2. Ask: "Does this make sense before I implement?"
💡 Hint: Say "autopilot" to skip the pause and go straight to code.

**After generating code:**
1. Ask 1-2 questions that vary between systems thinking and code-level understanding depending on context:
   - Systems-level: "How does this interact with the rest of the system?", "What would break if this requirement changed?"
   - Code-level: "What does this line do?", "Why this approach over [alternative]?"
2. **Think Deeper:** Offer one counter-example — a scenario where this approach would be the wrong choice, or why someone might pick a different approach. Frame it as: "One case where this wouldn't work well: ..." This helps build judgment about *when* to apply a pattern, not just *how*.
💡 Hint: Say "got it" to move on, or answer to go deeper.

**Why before How:** For complex requests, ask "What outcome are you optimizing for?" before diving in. A request is complex when it involves any of: multiple components or files, architectural or design decisions, trade-offs between valid approaches, ambiguous requirements, or an unfamiliar domain. When in doubt, treat it as complex — asking is cheap, building the wrong thing is expensive.

**Exception:** Skip for typos, simple fixes, or autopilot mode.

---

### Active Engagement Learning & Research Protocol

**Teach-back:** For complex topics, ask the user to explain what they're trying to understand before researching. "What do you already know about X?"
💡 Hint: This isn't a quiz — it helps target the explanation to what you actually need.

**After research:**
- End with: "📝 Consider processing this on paper before we continue."
- Ask a question connecting to existing knowledge when relevant
- **Think Deeper:** Offer a contrast or common misconception — "A common mistake is thinking X works like Y, but they differ because..." or "How does this differ from [similar concept]?" This builds durable understanding by defining boundaries.

---

### Active Engagement Data Analysis Protocol

**Before querying or exploring data:**
1. Ask what question the user is trying to answer or what hypothesis they're testing (3-10 sentences scaling with complexity). "What pattern are you expecting to see?"
2. Suggest what columns, filters, or aggregations would answer that question.
💡 Hint: Thinking about what you expect to see *before* seeing the data sharpens your analysis.

**After seeing results:**
1. Summarize the key finding in plain language before diving into details.
2. Ask one interpretive question: "What does this tell you about [the system/users/trend]?" or "Does this match what you expected?"
3. **Think Deeper:** Challenge the conclusion with a counter-hypothesis — "What would this data look like if [alternative explanation] were true instead?" or "What confounding factor could produce the same pattern?" This prevents confirmation bias.
💡 Hint: Say "autopilot" if you just need the numbers and already know what they mean.

**Before drawing conclusions:**
- Prompt: "Before we act on this, what else would we need to check to rule out [alternative explanation]?"

---

### Toil Detection

Actively watch for:
- Repetitive manual steps
- Tasks that could be scripted/automated
- Processes done manually that could be templated

When detected, proactively suggest automation. Don't repeat the same suggestion twice per session.

---

### Today's Recap

When the user asks for "today's recap", "daily summary", or how their day went, call the **todays_recap** tool. It provides cross-session engagement stats per session, multitasking analysis, and reflection prompts covering all of today's Copilot sessions.

---

### Hands-On Nudge

If the user has been in autopilot mode for several consecutive coding tasks, gently ask: "You've been delegating a lot lately. Want to take this one more hands-on?"
`.trim();

const session = await joinSession({
    hooks: {
        onSessionStart: async () => {
            if (session.workspacePath) {
                const dir = join(session.workspacePath, "files");
                try { mkdirSync(dir, { recursive: true }); } catch {}
                countersPath = join(dir, "think-together-counters.json");
                loadCounters();
            }
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
                saveCounters();
                await session.log("⚡ Autopilot mode — executing efficiently.", { ephemeral: true });

                return {
                    additionalContext:
                        "The user is in autopilot mode. Skip ALL Think Together thinking pauses for this message. Execute efficiently without asking clarifying questions or quizzing afterward.",
                };
            }

            // Non-autopilot turn: check if returning from a long autopilot streak
            const streakBeforeReset = autopilotStreak;
            autopilotStreak = 0;

            // Positive reinforcement: track engaged vs dismissal turns
            const trimmed = input.prompt.trim();
            if (trimmed.length > 0 && !DISMISSAL_PATTERN.test(trimmed)) {
                engagedTurns++;
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
                parts.push(`Total turns: ${totalTurns}`);
                if (engagedTurns > 0) {
                    parts.push(`🧠 Engaged turns: ${engagedTurns}`);
                }
                if (autopilotTurns > 0) {
                    parts.push(`⚡ Autopilot turns: ${autopilotTurns}`);
                }
                if (parts.length === 1 && totalTurns === 0) {
                    return "No activity tracked yet.";
                }
                return `📊 Session recap\n${parts.join("\n")}`;
            },
        },
        {
            name: "todays_recap",
            description:
                "Shows today's cross-session recap: per-session engagement breakdown, totals, " +
                "multitasking analysis, and reflection prompts. Call when the user asks for " +
                "today's recap, daily summary, or daily reflection. Returns SQL queries to run " +
                "against session_store and a presentation template. After receiving the response, " +
                "execute each query (database: \"session_store\") and format the results as instructed.",
            parameters: { type: "object", properties: {} },
            handler: async () => {
                const q = buildTodaysRecapQueries();
                return `TODAY'S RECAP DATA — ${q.localDate}
Date range: ${q.start} to ${q.end}

== CURRENT SESSION (exact Think Together tracking) ==
Total turns: ${totalTurns}
Engaged turns: ${engagedTurns}
Autopilot turns: ${autopilotTurns}

== RUN THESE 3 QUERIES (database: "session_store") ==

--- Query 1: Sessions today ---
${q.sessionsToday}

--- Query 2: Engagement by session (approximate) ---
${q.engagementBySession}

--- Query 3: Context switches (within ${MULTITASK_THRESHOLD_MINUTES} min) ---
${q.contextSwitches}

== FORMAT THE RESULTS AS ==

# 📊 Today's Recap — ${q.localDate}

## Sessions ({count from Query 1} total)
Table with columns: Session | Turns | 🧠 Engaged | ⚡ Autopilot | 💬 Dismissals | Started
- Use Query 2 results. Engaged = total - autopilot - dismissals.
- For the current session, use the EXACT counters above instead of Query 2 heuristic.
- Mark the current session with "(this session ✓)".

### Totals
Sum all sessions. Label: "approximate — engagement inferred from message keywords, except current session which uses exact tracking".

### 🔍 Engagement balance
Compare per-session engagement profiles. Did autopilot-heavy sessions create space for deeper engaged ones? Note interesting patterns without judging.

## Multitasking Analysis
Query 3 rows are context switches — the user moved to a different session within ${MULTITASK_THRESHOLD_MINUTES} min.
- Group consecutive switches into windows by time proximity.
- For each window: time range, sessions involved, switch count, typical gap.
- Note idle time: how long each session waited while the user was in another.
- If no rows returned: "No active session switching detected today. ✅"

### 🪞 Was it worth it?
Summarize: total context switches, sessions involved.
Ask ONE reflective question about whether the multitasking was intentional.
Frame around: did delegating (autopilot) some tasks free focus for others, or did switching fragment attention?
Do NOT judge — only prompt reflection.`;
            },
        },
    ],
});

