# Think Together — Copilot Instructions

## Architecture

This is a **Copilot CLI extension** — an ES module entry point (`extension.mjs`) backed by a modular `lib/` directory, hooking into the Copilot CLI session lifecycle via `@github/copilot-sdk/extension`.

The extension injects a system-level prompt framework (`THINK_TOGETHER_FRAMEWORK`) at session start and dynamically adjusts per-turn context based on whether the user is in autopilot mode. It registers two custom tools: `session_recap` (current session) and `todays_recap` (cross-session daily summary).

### Module structure

```
extension.mjs          → Entry point: joinSession, hooks, tool wiring (~100 lines)
lib/
├── constants.mjs      → DISMISSAL_WORDS, thresholds, DISMISSAL_PATTERN
├── counters.mjs       → Shared mutable counter object + save/load persistence
├── framework.mjs      → THINK_TOGETHER_FRAMEWORK prompt string
└── todays-recap.mjs   → buildTodaysRecapQueries + todaysRecapTool definition
plugin.json            → CLI manifest for `copilot extension install`
test.mjs               → 20 tests (run: `node test.mjs`)
```

### Core patterns

- **`joinSession` with hooks** — The extension's entry point. All behavior is driven by two hooks:
  - `onSessionStart` — injects the framework prompt and initializes counter persistence
  - `onUserPromptSubmitted` — classifies each turn (autopilot vs engaged) and injects per-turn context
- **Counter persistence** — Turn stats (`autopilotStreak`, `totalTurns`, etc.) are saved to a JSON file in the session workspace (`files/think-together-counters.json`) so they survive extension restarts. Persistence failures are silently ignored.
- **Autopilot detection** — Dual-signal: checks both the `autopilot` keyword in the prompt AND the session mode via `session.rpc.mode.get()`. Either signal triggers bypass.
- **Dismissal pattern** — A regex (`DISMISSAL_PATTERN`) built from a shared `DISMISSAL_WORDS` array distinguishes genuine engaged turns from short acknowledgments like "got it" or "ok". The same word list generates SQL conditions for cross-session heuristic classification.
- **Today's Recap (AI-driven query pattern)** — The `todays_recap` tool returns SQL queries + a presentation template. The AI executes the queries against `session_store` and formats the results. This decouples the extension from Copilot CLI internals. SQL does the heavy computation (engagement heuristics via keyword matching, context switch detection via `LAG` window functions); the AI just presents and narrates.
- **Multitasking detection** — Uses a configurable threshold (`MULTITASK_THRESHOLD_MINUTES`, default 15). Context switches are detected by ordering all turns across sessions by timestamp and finding consecutive turns in different sessions within the threshold. Engagement classification across sessions is approximate (keyword heuristic) and explicitly labeled as such.
- **Local date boundaries** — `buildTodaysRecapQueries()` computes start/end of day in local time (not UTC) to avoid calendar boundary confusion.
- **Three active engagement protocols** — Coding, Learning/Research, and Data Analysis each have tailored pause points, Think Deeper counter-examples, and inline discovery hints.
- **Complexity-scaled explanations** — The coding protocol uses 3-10 sentences for approach explanations, scaling with problem complexity.
- **"Why before How" criteria** — Complex tasks are explicitly defined as: multi-component changes, architectural decisions, trade-offs, ambiguous requirements, or unfamiliar domains.

## Conventions

- **No build step** — The extension is a raw ES module loaded directly by the Copilot CLI runtime. No transpilation, bundling, or compilation.
- **Tests** — Run with `node test.mjs`. Tests cover pure functions: dismissal pattern matching (positives, negatives, case, punctuation), counter persistence (round-trip, missing file, corrupt file), and Today's Recap query builder (shape, date boundaries, SQL content). Add tests for new pure functions.
- **Fail silently** — All I/O and RPC calls use bare `catch {}` blocks. The extension must never crash the host session; degraded behavior is always preferred over errors.
- **Shared mutable counter object** — Counters live as an exported mutable object (`export const counters = {...}`) in `lib/counters.mjs`. ES module live bindings keep it synchronized across all importers. This is intentional for simplicity given the single-instance lifecycle.
- **plugin.json** — Required manifest for `copilot extension install`. Keep `version` in sync with `package.json` when releasing.

## Versioning & Releases

- **Semantic versioning** — The project uses [SemVer](https://semver.org/). The current version lives in `package.json` under `"version"`.
- **Git tags** — Each release is tagged as `v<major>.<minor>.<patch>` (e.g., `v0.0.1`). Always create an annotated tag (`git tag -a`).
- **GitHub Releases** — Every version bump gets a corresponding [GitHub Release](https://github.com/guillene/think-together/releases) with a changelog summarizing what changed.
- **Release workflow** — When bumping a version: (1) update `version` in both `package.json` and `plugin.json`, (2) commit, (3) create an annotated git tag, (4) push with `--tags`, (5) create a GitHub Release via `gh release create`.
- **License** — MIT. The `LICENSE` file and `package.json` both reflect this.
