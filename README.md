# Think Together

*Think with Copilot, not through it.*

A [Copilot CLI](https://github.com/github/copilot-cli) plugin that adds **productive friction** to your AI-assisted workflow. Inspired by active recall and spaced repetition from learning science — the same principles behind tools like Anki.

## What it does

Think Together turns Copilot from an answer machine into a thinking partner:

- **Active engagement coding** — Before generating code, Copilot explains its approach and asks if it makes sense. After generating code, it quizzes you on the solution (dismissable with "got it").
- **"Why before How"** — For complex requests, Copilot asks what outcome you're optimizing for before diving into implementation.
- **Learning engagement** — For research tasks, Copilot asks what you already know before looking things up. After research, it reminds you to process the information.
- **Toil detection** — Watches for repetitive manual steps and proactively suggests automation.
- **Hands-on nudge** — If you've been delegating heavily, gently asks if you want to take the next one more hands-on.

## Autopilot bypass

When you need pure execution speed:
- Switch to **autopilot mode** in the CLI (Shift+Tab) — friction is automatically disabled
- Or type **"autopilot"** anywhere in your message — friction is skipped for that message only

## Who this is for

- Developers learning new codebases who want to actually understand the code
- Senior engineers who want to stay sharp instead of atrophying
- Anyone worried about becoming dependent on AI-generated code

## Who this is NOT for

- If you're in a time crunch and need maximum output speed, use autopilot mode
- If you find any friction annoying rather than useful, this isn't your tool

## Install

```
copilot plugin install guillene/think-together
```

## Philosophy

The best thinking happens together. AI should amplify your understanding, not replace it.

---

*"I made my AI harder to use on purpose."*
