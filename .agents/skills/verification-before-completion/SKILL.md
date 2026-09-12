---
name: verification-before-completion
description: Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running verification commands and confirming output before making any success claims; evidence before assertions always
---

# Verification Before Completion

## Overview

Claiming work is complete without verification is dishonesty, not efficiency.

**Core principle:** Evidence before claims, always.

**Violating the letter of this rule is violating the spirit of this rule.**

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command in this message, you cannot claim it passes.

## The Gate Function

```
BEFORE claiming any status or expressing satisfaction:

1. IDENTIFY: What command proves this claim?
2. RUN: Execute the FULL command (fresh, complete)
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
   - If NO: State actual status with evidence
   - If YES: State claim WITH evidence
5. ONLY THEN: Make the claim

Skip any step = lying, not verifying
```

## Common Failures

| Claim | Requires | Not Sufficient |
|-------|----------|----------------|
| Tests pass | Test command output: 0 failures | Previous run, "should pass" |
| Linter clean | Linter output: 0 errors | Partial check, extrapolation |
| Build succeeds | Build command: exit 0 | Linter passing, logs look good |
| Bug fixed | Test original symptom: passes | Code changed, assumed fixed |
| Regression test works | Red-green cycle verified | Test passes once |
| Agent completed | VCS diff shows changes | Agent reports "success" |
| Requirements met | Line-by-line checklist | Tests passing |

## Red Flags - STOP

- Using "should", "probably", "seems to"
- Expressing satisfaction before verification ("Great!", "Perfect!", "Done!", etc.)
- About to commit/push/PR without verification
- Trusting agent success reports
- Relying on partial verification
- Thinking "just this once"
- Tired and wanting work over
- **ANY wording implying success without having run verification**

## Rationalization Prevention

| Excuse | Reality |
|--------|---------|
| "Should work now" | RUN the verification |
| "I'm confident" | Confidence ≠ evidence |
| "Just this once" | No exceptions |
| "Linter passed" | Linter ≠ compiler |
| "Agent said success" | Verify independently |
| "I'm tired" | Exhaustion ≠ excuse |
| "Partial check is enough" | Partial proves nothing |
| "Different words so rule doesn't apply" | Spirit over letter |

## Key Patterns

**Tests:**
```
✅ [Run test command] [See: 34/34 pass] "All tests pass"
❌ "Should pass now" / "Looks correct"
```

**Regression tests (TDD Red-Green):**
```
✅ Write → Run (pass) → Revert fix → Run (MUST FAIL) → Restore → Run (pass)
❌ "I've written a regression test" (without red-green verification)
```

**Build:**
```
✅ [Run build] [See: exit 0] "Build passes"
❌ "Linter passed" (linter doesn't check compilation)
```

**Requirements:**
```
✅ Re-read plan → Create checklist → Verify each → Report gaps or completion
❌ "Tests pass, phase complete"
```

**Agent delegation:**
```
✅ Agent reports success → Check VCS diff → Verify changes → Report actual state
❌ Trust agent report
```

## Why This Matters

From 24 failure memories:
- your human partner said "I don't believe you" - trust broken
- Undefined functions shipped - would crash
- Missing requirements shipped - incomplete features
- Time wasted on false completion → redirect → rework
- Violates: "Honesty is a core value. If you lie, you'll be replaced."

## Live Verification (real browser) — mandatory for user-visible features

Unit tests, typecheck and lint verify layers **in isolation**. The bugs that
reach users live in the seams between layers. This repo learned that the hard
way: a dead CSS pipeline, a submit button that couldn't submit, an `/auth/me`
response that failed the client's zod parse, and placeholder pages that threw
at runtime — all invisible to green tests. For any feature with a user-visible
surface, climb the full ladder before claiming "done":

**The verification ladder:**
1. **Unit/component tests** — logic in isolation (already the norm).
2. **Contract tests** — API responses asserted against the *shared zod schema*
   the client parses with (not just HTTP status codes). HTTP error mocks must
   use the real rejection shape (`HttpErrorResponse` body on `.error`), never
   `new Error(...)`. Form tests must click the real submit button, not
   dispatch synthetic events.
3. **Artifact probes** — after build, assert on the *emitted output*, not the
   inputs (see `.github/scripts/stylesheet-probe.mjs` for the pattern: compiled
   utilities present, no raw directives).
4. **Live run** — drive the real UI in headless Chromium (puppeteer is
   available via impeccable's toolchain; Chromium is cached) through the
   feature's happy path AND at least one unhappy path:
   - click the real elements the user clicks;
   - assert DOM outcomes (navigation, visible alerts, rendered text);
   - sweep the browser console — zero unexpected errors (expected probes, e.g.
     the auth guard's 401 restore while logged out, are documented exclusions);
   - verify persistence interactions (reload keeps state) where applicable.

**Honesty rules:**
- "Verified visually" may only be claimed from an *executed* browser session
  or explicit user confirmation — never assumed from green tests.
- Distinguish agent-executed checks from user-attended checks in session notes.
- Keep the throwaway e2e probe patterns (start servers detached, poll
  readiness, filter expected console noise) — see skill-observations #10.

## When To Apply

**ALWAYS before:**
- ANY variation of success/completion claims
- ANY expression of satisfaction
- ANY positive statement about work state
- Committing, PR creation, task completion
- Moving to next task
- Delegating to agents

**Rule applies to:**
- Exact phrases
- Paraphrases and synonyms
- Implications of success
- ANY communication suggesting completion/correctness

## The Bottom Line

**No shortcuts for verification.**

Run the command. Read the output. THEN claim the result.

This is non-negotiable.
