// Turn classification — pure function for engagement tracking
//
// Priority chain: dismissal → delegation → engaged → interaction
// Autopilot is handled separately via RPC mode signal in extension.mjs.

import { DISMISSAL_PATTERN, DELEGATION_PATTERN, MIN_ENGAGED_LENGTH } from "./constants.mjs";

/**
 * Classify a user prompt for engagement tracking.
 * @param {string} prompt - The raw user message
 * @returns {'dismissal' | 'delegation' | 'engaged' | 'interaction'}
 */
export function classifyTurn(prompt) {
    const trimmed = prompt.trim();
    if (trimmed.length === 0) return 'interaction';

    if (DISMISSAL_PATTERN.test(trimmed)) return 'dismissal';
    if (DELEGATION_PATTERN.test(trimmed)) return 'delegation';

    // Questions show active thinking regardless of length
    if (trimmed.includes('?') && trimmed.length >= 15) return 'engaged';

    // Substantive messages above the length threshold
    if (trimmed.length >= MIN_ENGAGED_LENGTH) return 'engaged';

    return 'interaction';
}
