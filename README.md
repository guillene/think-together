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

## Examples

### Coding — with vs without

**Without Think Together:**
```
You:    "Add retry logic to the API client"
Copilot: [generates code]
You:    [copy-paste, move on]
```

**With Think Together:**
```
You:    "Add retry logic to the API client"
Copilot: "I'll add exponential backoff with a max of 3 retries, wrapping
          the fetch call. Does this make sense before I implement?"
You:    "yes, but cap the delay at 10s"
Copilot: [generates code]
         "How does this retry logic interact with your existing error
          handling — will callers need to update their catch blocks?"
You:    "got it" (or answer the question)
```

### Learning — with vs without

**Without Think Together:**
```
You:    "Explain how SSH key-based auth works"
Copilot: [full explanation]
You:    [reads, moves on]
```

**With Think Together:**
```
You:    "Explain how SSH key-based auth works"
Copilot: "What do you already know about SSH auth?"
You:    "I know there's a public and private key pair but not how the
         handshake actually verifies identity"
Copilot: [targeted explanation filling the gap]
         "📝 Consider processing this on paper before we continue."
```

### Autopilot bypass

When you need speed, just say the word:
```
You:    "autopilot — rename all instances of userId to userID"
Copilot: [executes immediately, no pauses]
```

### Hands-on nudge

After several consecutive autopilot tasks:
```
You:    "Help me design the caching layer"
Copilot: "You've been delegating a lot lately. Want to take this one
          more hands-on?"
```

### Session recap

Check your engagement anytime:
```
You:    "Show me my session recap"
Copilot: 📊 Session recap
         Total turns: 12
         🧠 Engaged turns: 8
         ⚡ Autopilot turns: 4
```


