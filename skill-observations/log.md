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

### Observation 4: Git add/commit/status batched in one parallel block → index.lock collision

**Status:** OPEN
**Date:** 2026-09-12
**Session context:** Feature 02 commit (GeoCheck AI Phase 2); `git add` + `git commit` + `git log` emitted as parallel tool calls in one block.
**Skill:** executing-plans
**Type:** open-source
**Phase/Area:** delivery / git commit step

**Issue:** Three git invocations launched concurrently collided: `git commit` died with `fatal: Unable to create '.git/index.lock': File exists`, and the follow-up `git log` raced ahead of the commit (showed a stale HEAD). Recovered by killing git, removing the stale lock, and re-running add+commit sequentially.

**Suggested improvement:** In `executing-plans` (delivery step), state that git operations on the same repository are dependent calls — run them sequentially in one shell invocation (`add; commit`), never as parallel tool calls.

**Principle:** Calls that mutate shared mutable state (index, HEAD) are never independent, even though they look like separate commands.

### Observation 5: UMD/CJS deps need `test.server.deps.inline` + `test.deps.interopDefault: false` in Vitest 5 — and root-level config keys are silently ignored

**Status:** OPEN
**Date:** 2026-09-12
**Session context:** Wiring `@techstark/opencv-js` into Vitest for stage-1 unit tests (GeoCheck AI).
**Skill:** library-docs / test-driven-development
**Type:** open-source
**Phase/Area:** test tooling / CJS interop

**Issue:** Dynamic `import()` of a large UMD dep failed instantly in Vitest with `TypeError: Method Promise.prototype.then called on incompatible receiver [object Module]` (Vitest's `interopModule` proxy calls `.then` on the namespace). Adding `server.deps.inline` / `deps.interopDefault` at the config ROOT had no effect — they only work under the `test` key; the silent ignore cost several debug iterations.

**Suggested improvement:** In `test-driven-development` (or a library-docs note), add: "Vitest 5 + UMD/CJS dependency that breaks on import → set `test.server.deps.inline: [<pkg>]` and `test.deps.interopDefault: false`; both must live under `test`." Also recommend isolating with a plain-Node dynamic-import smoke to prove the dep itself loads.

**Principle:** Validate that a config fix is actually read (config keys can be silently misplaced) before concluding the fix doesn't work.

### Observation 6: Prettier reformats vendored minified assets under `public/`

**Status:** OPEN
**Date:** 2026-09-13
**Session context:** Feature 04 OCR (GeoCheck AI); staging tesseract.js `worker.min.js`/`*.wasm.js` into `public/tesseract/`, then running `pnpm format`.
**Skill:** verification-before-completion / repo conventions
**Type:** open-source
**Phase/Area:** formatting gates / vendored static assets

**Issue:** `prettier --write .` reformatted vendored minified JS assets (`worker.min.js`, `*.wasm.js`) copied into `public/` — byte-identity with the upstream package was silently lost (these are served verbatim to the browser worker; reformatting also risks subtle breakage and inflates diffs).

**Suggested improvement:** In projects that vendor third-party runtime assets into `public/`, add `public/` to `.prettierignore` *before* the first `format` run; if already reformatted, restore byte-identical copies from the package source (`node_modules/...`) rather than trusting prettier's output.

**Principle:** Formatting tools must never mutate vendored artifacts; exclusion has to precede the first run, not be discovered from a diff.

### Observation 7: Validate in-repo library notes against the installed package before planning on them

**Status:** OPEN
**Date:** 2026-09-13
**Session context:** Feature 04 OCR planning (GeoCheck AI); `context/library-docs.md` claimed tesseract.js exposes `createTesseract(options)`.
**Skill:** library-docs / writing-plans
**Type:** open-source
**Phase/Area:** documentation accuracy / pre-implementation spike

**Issue:** The project's own library-docs entry for tesseract.js described an API that does not exist in the installed version (`createWorker` is correct). Planning directly from the stale note would have produced non-compiling code; a 15-minute spike into `node_modules` (package.json, `src/index.d.ts`, `createWorker.js`, `worker-script/*`) caught it.

**Suggested improvement:** In `writing-plans` (or library-docs conventions), add: before writing a plan that integrates a library, verify the claimed API against the *installed* package's types/source — in-repo notes can drift from the pinned version.

**Principle:** Trust the pinned dependency's source over derived documentation; a spike is cheaper than a plan built on a wrong interface.

## Archive

See `archive/` for closed observations (moved here during weekly reviews).