# Think Together

*Think with Copilot, not through it.*

A [Copilot CLI](https://github.com/github/copilot-cli) extension that adds **intentional thinking pauses** to your AI-assisted workflow — so you build understanding alongside velocity.

## What it does

Think Together turns Copilot into a thinking partner that helps you learn as you ship:

- **Active engagement coding** — Before generating code, Copilot explains its approach (3-10 sentences scaling with complexity) and asks if it makes sense. After generating code, it asks questions that vary between architecture-level and code-level depending on context (dismissable with "got it").
- **"Why before How"** — For complex requests (multi-component, architectural decisions, trade-offs, ambiguous requirements), Copilot asks what outcome you're optimizing for before diving into implementation.
- **Think Deeper** — Each protocol includes counter-examples that build judgment: "One case where this wouldn't work well: ..." for coding, common misconceptions for learning, and counter-hypotheses for data analysis.
- **Data analysis engagement** — Before querying data, Copilot asks what you expect to see. After results, it challenges conclusions with alternative explanations to prevent confirmation bias.
- **Learning engagement** — For research tasks, Copilot asks what you already know before looking things up. After research, it reminds you to process the information.
- **Inline hints** — Contextual 💡 hints teach you extension features as you go, so you learn by doing rather than reading docs.
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
          the fetch call. Each retry doubles the wait time starting at
          500ms. I'll cap the delay and add jitter to avoid thundering
          herd. Does this make sense before I implement?"
You:    "yes, but cap the delay at 10s"
Copilot: [generates code]
         "How does this retry logic interact with your existing error
          handling — will callers need to update their catch blocks?
          One case where this wouldn't work well: idempotency — if the
          API call isn't idempotent, retries could cause duplicates."
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

### Data analysis — with vs without

**Without Think Together:**
```
You:    "Query the dashboard for error rates by region"
Copilot: [writes query, shows results]
You:    [looks at numbers, moves on]
```

**With Think Together:**
```
You:    "Query the dashboard for error rates by region"
Copilot: "What pattern are you expecting to see — uniform errors, or
          a spike in a specific region?"
You:    "I think US-East is having issues"
Copilot: [writes query, shows results]
         "US-East shows 3x the error rate. But before we blame that
          region — could this be a traffic volume artifact? US-East
          also handles 3x the requests."
You:    "good point, normalize it"
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


