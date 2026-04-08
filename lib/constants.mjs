// Shared constants — used by both live tracking (regex) and cross-session analysis (SQL)

export const AUTOPILOT_NUDGE_THRESHOLD = 4;
export const MULTITASK_THRESHOLD_MINUTES = 15;

export const DISMISSAL_WORDS = [
    'got it', 'ok', 'okay', 'yes', 'sure', 'proceed', 'go ahead',
    'makes sense', 'yep', 'yeah', 'do it', 'looks good', 'lgtm',
    'go for it', 'sounds good', 'that works', 'perfect', 'great',
    'fine', '👍', 'next', 'continue',
];

export const DISMISSAL_PATTERN = new RegExp(
    `^(${DISMISSAL_WORDS.join('|')})\\s*[.!]?$`, 'i'
);
