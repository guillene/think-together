// Today's Recap — cross-session engagement and multitasking analysis
//
// Builds SQL queries for the AI to run against session_store.
// SQL does the computation; the AI just presents and narrates.

import { DISMISSAL_WORDS, DELEGATION_WORDS, MULTITASK_THRESHOLD_MINUTES } from "./constants.mjs";
import { counters } from "./counters.mjs";

export function buildTodaysRecapQueries() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    const start = startOfDay.toISOString();
    const end = endOfDay.toISOString();
    const localDate = now.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const dismissalSql = DISMISSAL_WORDS
        .filter(w => w !== '👍')
        .map(w => `lower(trim(t.user_message)) LIKE '${w}%'`)
        .join('\n            OR ');

    const delegationSql = DELEGATION_WORDS
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
  SUM(CASE WHEN lower(t.user_message) LIKE '%/fleet%' THEN 1 ELSE 0 END) as autopilot_turns,
  SUM(CASE WHEN length(trim(t.user_message)) < 30 AND (
            ${dismissalSql}
            OR trim(t.user_message) = '👍'
        ) THEN 1 ELSE 0 END) as dismissal_turns,
  SUM(CASE WHEN (
            ${delegationSql}
        ) AND NOT lower(t.user_message) LIKE '%/fleet%'
        THEN 1 ELSE 0 END) as delegation_turns,
  SUM(CASE
        WHEN lower(t.user_message) LIKE '%/fleet%' THEN 0
        WHEN length(trim(t.user_message)) < 30 AND (
            ${dismissalSql}
            OR trim(t.user_message) = '👍'
        ) THEN 0
        WHEN (${delegationSql}) THEN 0
        WHEN t.user_message LIKE '%?%' AND length(trim(t.user_message)) >= 15 THEN 1
        WHEN length(trim(t.user_message)) >= 30 THEN 1
        ELSE 0
      END) as engaged_turns,
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

    return { start, end, localDate, timezone, sessionsToday, engagementBySession, contextSwitches };
}

export const todaysRecapTool = {
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
Timezone: ${q.timezone}

== CURRENT SESSION (exact Think Together tracking) ==
Total turns: ${counters.totalTurns}
Engaged turns: ${counters.engagedTurns}
Autopilot turns: ${counters.autopilotTurns}
Delegation turns: ${counters.delegationTurns}

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
Table with columns: Session | Turns | 🧠 Engaged | ⚡ Autopilot | 🔀 Delegated | 💬 Other | Started
- Use Query 2 results. "Other" = total - engaged - autopilot - delegation - dismissals.
- For the current session, use the EXACT counters above instead of Query 2 heuristic.
- Mark the current session with "(this session ✓)".
- **IMPORTANT: All timestamps in the database are UTC. Convert to ${q.timezone} for display.** For example, if the DB shows "2026-04-09T23:43:00Z" and timezone is America/Los_Angeles, display as "4:43 PM".

### Totals
Sum all sessions. Label: "approximate — engagement inferred from message heuristics, except current session which uses exact tracking".

### 🔍 Engagement balance
Compare per-session engagement profiles. Highlight sessions with real engaged turns vs pure delegation. Note interesting patterns without judging.

## Multitasking Analysis
Query 3 rows are context switches — the user moved to a different session within ${MULTITASK_THRESHOLD_MINUTES} min.
- Group consecutive switches into windows by time proximity.
- For each window: time range, sessions involved, switch count, typical gap.
- Note: multiple sessions starting within seconds of each other may indicate /fleet usage — label as "possible fleet burst" (soft hint, not confirmed).
- If no rows returned: "No active session switching detected today. ✅"

### 🪞 Was it worth it?
Summarize: total context switches, sessions involved.
Ask ONE reflective question about whether the multitasking was intentional.
Frame around: did delegating some tasks free focus for others, or did switching fragment attention?
Do NOT judge — only prompt reflection.`;
    },
};
