# Think Together

*Think with Copilot, not through it.*

A [Copilot CLI](https://github.com/github/copilot-cli) extension that adds **intentional thinking pauses** to your AI-assisted workflow — so you build understanding alongside velocity.

## What it does

Think Together turns Copilot into a thinking partner that helps you learn as you ship:

- **Active engagement coding** — Before generating code, Copilot explains its approach and asks if it makes sense. After generating code, it asks questions that vary between architecture-level and code-level depending on context (dismissable with "got it").
- **"Why before How"** — For complex requests, Copilot asks what outcome you're optimizing for before diving into implementation.
- **Learning engagement** — For research tasks, Copilot asks what you already know before looking things up. After research, it reminds you to process the information.
- **Toil detection** — Watches for repetitive manual steps and proactively suggests automation.
- **Hands-on nudge** — If you've been delegating heavily, gently asks if you want to take the next one more hands-on.

## Autopilot bypass

When you need pure execution speed:
- Switch to **autopilot mode** in the CLI (Shift+Tab) — thinking pauses are automatically disabled
- Or type **"autopilot"** anywhere in your message — pauses are skipped for that message only

## Who this is for

- Developers who want to use AI to **augment their thinking**, not just their output
- Engineers onboarding to new codebases who want to accelerate their learning
- Anyone who sees every AI interaction as a chance to grow

## Install

```
copilot plugin install guillene/think-together
```

## Philosophy

The best thinking happens together. AI should amplify your understanding, not replace it.
