# Task Observer — observation log

## Open observations

### Observation 1: Session interrupted mid-git — the staged index is the recovery anchor

**Status:** OPEN
**Date:** 2026-09-12
**Session context:** Recovery session after the previous one died between `git init`/`git add` and the first commit (GeoCheck AI Phase 0 scaffold).
**Skill:** recover
**Type:** open-source
**Phase/Area:** session resumption / git operations

**Issue:** The project was fully on disk and all ~85 files were staged, but `git log` said "no commits yet". The natural (wrong) first move would be to re-create scaffolding; the correct diagnosis was `git status` + `git diff --cached --stat`, which showed only the commit was missing.

**Suggested improvement:** In the `recover` skill, add a resumption rule: before re-doing any work after an interrupted session, inspect `git status` and `git diff --cached --stat` — an interrupted operation often leaves a staged-but-uncommitted index, and the cleanest finish is a single commit of the existing index (after re-verifying the gates).

**Principle:** Diagnose the actual state boundary (working tree vs index vs HEAD) before recreating anything; interrupted git operations usually fail at the boundary, not at the start.

### Observation 2: pnpm.cmd exit code is a false negative in PowerShell — gate on `cmd /c ... && echo PASS`

**Status:** OPEN
**Date:** 2026-09-12
**Session context:** Verification ladder of the recovered Phase 0 scaffold (`pnpm.cmd test/typecheck/lint/build`).
**Skill:** verification-before-completion
**Type:** open-source
**Phase/Area:** environment / running gates on Windows PowerShell

**Issue:** `pnpm.cmd test` etc. print results to stderr; PowerShell therefore reports `NativeCommandError` and exit code 1 even when vitest/tsc/oxlint/vite all succeeded (10/10 tests, 0 lint errors, build ok). `pnpm test` in a `cmd /c "... && echo PASS || echo FAIL"` wrapper returns the true exit code.

**Suggested improvement:** In `verification-before-completion`, for Windows PowerShell hosts, recommend wrapping gate runs as `cmd /c "pnpm <cmd> && echo PASS || echo FAIL"` (or checking `$LASTEXITCODE`) instead of trusting the surface exit code of `pnpm.cmd`.

**Principle:** Validate tool exit codes at the layer where the tool sets them (shell), not where the host re-interprets raw output streams (PowerShell stderr handling).

### Observation 3: writing-plans' "offer execution choice" clashes with Cline plan/act

**Status:** OPEN
**Date:** 2026-09-12
**Session context:** Phase 1 UI shell (GeoCheck AI) executed from a plan the user had already approved in plan mode.
**Skill:** writing-plans
**Type:** open-source
**Phase/Area:** plan execution handoff

**Issue:** `writing-plans` ends by offering a choice ("subagent-driven vs inline execution"). In a plan/act harness the user has already made the execution decision by approving the act-mode switch; re-asking duplicates a decision already made and adds friction in short sessions.

**Suggested improvement:** In `writing-plans`, add a handoff rule: if the harness has a plan/approval flow where the user explicitly approved the plan before execution, skip the execution-choice offer (or persist the chosen mode in the plan header) and proceed inline unless the user asks otherwise.

**Principle:** Do not re-collect a decision the user has already made through the approval flow; record it once and act on it.

## Archive

See `archive/` for closed observations (moved here during weekly reviews).