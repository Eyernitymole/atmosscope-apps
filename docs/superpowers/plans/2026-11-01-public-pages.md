# AtmosScope Public Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the existing `web/` as a noncommercial GitHub Pages experience after the repository owner enables Pages, with verifiable static assets and honest status documentation.

**Architecture:** A dedicated Actions workflow validates and uploads only `web/`, then deploys it with GitHub's Pages actions. A small Node validator checks both entry points and their local references; README records URLs and the manual Pages setting without claiming the site is live prematurely.

**Tech Stack:** GitHub Actions, Node.js 24, plain HTML/CSS/JavaScript.

**Spec:** `docs/superpowers/specs/2026-11-01-public-pages-design.md`

## Global Constraints

- Keep `web/index.html` as the professional atlas and `web/ordinary.html` as ordinary weather; preserve both installation bundles.
- Publish `web/` only; no root-level build outputs, secrets, logs or native installers.
- Free Open-Meteo is for noncommercial use with the current limits in the spec; do not suggest commercial or mainland-reliable service.
- Never describe the expected GitHub Pages URL as live before an unauthenticated public check.

## Review Focus

- A relative asset with query/hash must resolve to its pathname; the validator test covers it.
- An external CDN URL must not be mistaken for a missing local asset; the validator test covers it.
- A traversal or root-absolute asset reference must be rejected rather than read outside `web/`; the validator test covers it.
- A missing professional or ordinary entry point must fail validation; the validator test covers both.
- Pages disabled at the repository level must remain documented as a deployment blocker; manually review README and repository state before a live claim.

---

### Task 1: Validate and deploy the static site

**Files:**
- Create: `scripts/check-pages-content.mjs`
- Create: `tests/pages.test.mjs`
- Create: `.github/workflows/pages.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: existing `web/index.html` and `web/ordinary.html` plus their relative assets.
- Produces: `validatePagesContent(root: string) -> string[]` reporting invalid or missing local references; CLI exits nonzero on findings; Pages artifact contains `web/` only.

- [ ] **Step 1: Write failing tests**

Test `validatePagesContent` with temporary two-entry HTML fixtures: normal relative CSS/JS, query/hash variants and external URLs pass; missing entry, missing local resource, traversal and root-absolute paths report errors. Run the validator CLI against an invalid temporary site and assert a nonzero exit code. Review the workflow and README against the spec; their semantics require GitHub Actions and human inspection rather than a source-text assertion.

- [ ] **Step 2: Verify tests fail for the missing validator/workflow**

Run: `node --test tests/pages.test.mjs`
Expected: FAIL because the validator or workflow does not exist.

- [ ] **Step 3: Implement the validator, workflow and README**

Export `validatePagesContent(root)` from `scripts/check-pages-content.mjs`; parse local `src`/`href` references from both HTML entries, strip query/hash, reject root-absolute and out-of-root paths, check files exist, and support CLI invocation with a directory argument. `.github/workflows/pages.yml` uses `actions/checkout@v4`, `actions/setup-node@v4` (Node 24), `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3` with `path: web`, and `actions/deploy-pages@v4`. Trigger only `push` to `main` for `web/**` and workflow path, with `workflow_dispatch` for retry; check contents before upload. README lists expected entry URLs, noncommercial/data source caveats, explicit enablement and public verification steps.

- [ ] **Step 4: Verify tests and real web tree pass**

Run: `node --test tests/pages.test.mjs && node scripts/check-pages-content.mjs web && npm test`
Expected: all commands exit 0, including the new tests.

- [ ] **Step 5: Commit**

Run: `git add docs/superpowers/plans/2026-11-01-public-pages.md tests/pages.test.mjs scripts/check-pages-content.mjs .github/workflows/pages.yml README.md && git commit -m "feat: prepare noncommercial GitHub Pages deployment"`
Expected: one commit on `docs/public-pages-design`, no uncommitted files.

## Self-review

The validator and workflow fulfill repeatable deploy, path isolation and asset checks; README covers owner-only enablement and honest public URL status. Existing site functions stay unchanged. Manual, unauthenticated public checks cannot be performed until Pages is enabled; report that gap rather than declaring success.
