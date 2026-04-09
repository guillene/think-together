// Turn classification — pure function for engagement tracking
//
// Priority chain: dismissal → delegation → engaged → interaction
// Autopilot is handled separately via RPC mode signal in extension.mjs.
//
// "Engaged" means the user is actively thinking — asking questions, reasoning,
// expressing opinions, providing context, or correcting. NOT just typing a
// long message or issuing a command.

import { DISMISSAL_PATTERN, DELEGATION_PATTERN } from "./constants.mjs";

// Engagement signals — patterns indicating active thinking
const ENGAGEMENT_SIGNALS = [
    // Questions (active seeking)
    /\?/,
    // Reasoning connectors
    /\b(but|because|however|although|since|therefore|so that|instead of)\b/i,
    // Expressing opinion / decision-making
    /\b(I think|I want|I need|I believe|let's|let us|we should|we could|we need|what about|how about|what if)\b/i,
    // Providing context / explaining
    /\b(the problem is|the issue is|it works like|it should|it doesn't|it's not|the reason|the goal is|the idea is)\b/i,
    // Disagreement / correction / critical thinking
    /\b(actually|that's wrong|not quite|that's not|I disagree|on second thought)\b/i,
    /\b(no|wait|hold on),/i,
    // Sharing constraints or requirements
    /\b(must|need to|has to|can't|shouldn't|requirement|constraint|make sure)\b/i,
    // Referencing specific technical context
    /\b(in the|from the|like in|similar to|based on|according to)\b/i,
];

// Command/tool invocations — not engagement
const COMMAND_PATTERN = /^\/\w+/;

/**
 * Strip system-injected prefixes from a message before classification.
 * System messages often start with emoji + context sentence + ". "
 * e.g., "⚠️ GitHub MCP server not configured. Research FlaUI-MCP"
 */
export function stripSystemPrefix(text) {
    if (text.charCodeAt(0) > 127) {
        const dotSpace = text.indexOf('. ');
        if (dotSpace > 0 && dotSpace < 80) {
            return text.slice(dotSpace + 2);
        }
    }
    return text;
}

/**
 * Classify a user prompt for engagement tracking.
 * @param {string} prompt - The raw user message
 * @returns {'dismissal' | 'delegation' | 'engaged' | 'interaction'}
 */
export function classifyTurn(prompt) {
    const trimmed = prompt.trim();
    if (trimmed.length === 0) return 'interaction';

    // Commands (e.g., /fleet, /chronicle) are interactions, not engagement
    if (COMMAND_PATTERN.test(trimmed)) return 'interaction';

    if (DISMISSAL_PATTERN.test(trimmed)) return 'dismissal';
    if (DELEGATION_PATTERN.test(trimmed)) return 'delegation';

    // Retry delegation after stripping system prefix
    const stripped = stripSystemPrefix(trimmed);
    if (stripped !== trimmed && DELEGATION_PATTERN.test(stripped)) return 'delegation';

    // Check for engagement signals
    const textToCheck = stripped !== trimmed ? stripped : trimmed;
    for (const signal of ENGAGEMENT_SIGNALS) {
        if (signal.test(textToCheck)) return 'engaged';
    }

    return 'interaction';
}
