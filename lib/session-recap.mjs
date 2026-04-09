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

    const turnDetail = `SELECT
  t.turn_index,
  substr(t.user_message, 1, 80) as message_preview,
  CASE
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
  END as category,
  t.timestamp
FROM turns t
WHERE t.session_id = '${sessionId}'
ORDER BY t.turn_index`;

    return { turnDetail, sessionId, timezone };
}
