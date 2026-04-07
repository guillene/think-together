# Think Together — Copilot Instructions

## Architecture

This is a **Copilot CLI extension** — a single ES module (`extension.mjs`) that hooks into the Copilot CLI session lifecycle via `@github/copilot-sdk/extension`.

The extension injects a system-level prompt framework (`THINK_TOGETHER_FRAMEWORK`) at session start and dynamically adjusts per-turn context based on whether the user is in autopilot mode. It also registers a custom tool (`session_recap`).

### Core patterns

- **`joinSession` with hooks** — The extension's entry point. All behavior is driven by two hooks:
  - `onSessionStart` — injects the framework prompt and initializes counter persistence
  - `onUserPromptSubmitted` — classifies each turn (autopilot vs engaged) and injects per-turn context
- **Counter persistence** — Turn stats (`autopilotStreak`, `totalTurns`, etc.) are saved to a JSON file in the session workspace (`files/think-together-counters.json`) so they survive extension restarts. Persistence failures are silently ignored.
- **Autopilot detection** — Dual-signal: checks both the `autopilot` keyword in the prompt AND the session mode via `session.rpc.mode.get()`. Either signal triggers bypass.
- **Dismissal pattern** — A regex (`DISMISSAL_PATTERN`) distinguishes genuine engaged turns from short acknowledgments like "got it" or "ok".
- **Three active engagement protocols** — Coding, Learning/Research, and Data Analysis each have tailored pause points, Think Deeper counter-examples, and inline discovery hints.
- **Complexity-scaled explanations** — The coding protocol uses 3-10 sentences for approach explanations, scaling with problem complexity.
- **"Why before How" criteria** — Complex tasks are explicitly defined as: multi-component changes, architectural decisions, trade-offs, ambiguous requirements, or unfamiliar domains.

## Conventions

- **No build step** — The extension is a raw ES module loaded directly by the Copilot CLI runtime. No transpilation, bundling, or compilation.
- **No tests** — There is no test infrastructure. If adding tests, the extension's pure functions (`saveCounters`, `loadCounters`, dismissal matching) are the natural seams.
- **Fail silently** — All I/O and RPC calls use bare `catch {}` blocks. The extension must never crash the host session; degraded behavior is always preferred over errors.
- **Module-level state** — Counters live as module-scoped `let` variables, not inside classes or closures. This is intentional for simplicity given the single-instance lifecycle.
