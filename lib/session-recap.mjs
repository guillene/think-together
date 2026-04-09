// Session Recap — query-based session engagement analysis
//
// Builds a SQL query for the AI to run against session_store for the current
// session. Uses the same classification heuristics as todays-recap so counts
// are consistent. The AI runs the query and formats the results.

import { DISMISSAL_WORDS, DELEGATION_WORDS, MIN_ENGAGED_LENGTH } from "./constants.mjs";

export function buildSessionRecapQuery(sessionId) {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const dismissalSql = DISMISSAL_WORDS
        .filter(w => w !== '👍')
        .map(w => `lower(trim(t.user_message)) LIKE '${w}%'`)
        .join('\n            OR ');

    const delegationSql = DELEGATION_WORDS
        .map(w => `lower(trim(t.user_message)) LIKE '${w}%'`)
        .join('\n            OR ');

    const classificationCase = `CASE
    WHEN lower(t.user_message) LIKE '/fleet%' THEN 'autopilot'
    WHEN length(trim(t.user_message)) < 30 AND (
            ${dismissalSql}
            OR trim(t.user_message) = '👍'
        ) THEN 'dismissal'
    WHEN (
            ${delegationSql}
        ) AND NOT lower(t.user_message) LIKE '/fleet%'
        THEN 'delegation'
    WHEN t.user_message LIKE '%?%' AND length(trim(t.user_message)) >= 15 THEN 'engaged'
    WHEN length(trim(t.user_message)) >= ${MIN_ENGAGED_LENGTH} THEN 'engaged'
    ELSE 'interaction'
  END`;

    const summary = `SELECT
  COUNT(*) as total_turns,
  SUM(CASE WHEN cat = 'engaged' THEN 1 ELSE 0 END) as engaged,
  SUM(CASE WHEN cat = 'autopilot' THEN 1 ELSE 0 END) as autopilot,
  SUM(CASE WHEN cat = 'delegation' THEN 1 ELSE 0 END) as delegation,
  SUM(CASE WHEN cat = 'dismissal' THEN 1 ELSE 0 END) as dismissals,
  SUM(CASE WHEN cat = 'interaction' THEN 1 ELSE 0 END) as interactions,
  MIN(ts) as first_turn,
  MAX(ts) as last_turn
FROM (
  SELECT ${classificationCase} as cat, t.timestamp as ts
  FROM turns t WHERE t.session_id = '${sessionId}'
)`;

    const turnDetail = `SELECT
  t.turn_index,
  substr(t.user_message, 1, 80) as message_preview,
  ${classificationCase} as category,
  t.timestamp
FROM turns t
WHERE t.session_id = '${sessionId}'
ORDER BY t.turn_index`;

    return { summary, turnDetail, sessionId, timezone };
}
