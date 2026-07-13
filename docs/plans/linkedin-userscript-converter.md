# LinkedIn → oh-my-cv Markdown Converter — Handover / Plan

**Status:** scoped, not started · **Owner:** Leo · **Created:** 2026-07-13
**Mode:** pick one at kickoff — _Brainstorm_ (refine open questions first) or _Execute_ (build against Phase plan below).

---

## 1. Goal

A **Tampermonkey/Violentmonkey userscript** that Leo runs on **his own logged-in LinkedIn profile**, which extracts his profile data and outputs **oh-my-cv resume markdown** (ideally copied straight to the clipboard) to paste into the oh-my-cv editor.

Deterministic (no LLM). One-click. Personal use.

---

## 2. Decisions locked

| Decision | Choice | Why |
|---|---|---|
| Delivery | **Userscript** (Tampermonkey/Violentmonkey) | Runs in Leo's own browser, own profile, manual trigger → sidesteps login wall + headless-bot ToS problem; full `window` + network access |
| Engine | **Deterministic parser** (no LLM) | Reproducible; Leo's pick |
| Output | oh-my-cv markdown → **clipboard** | Paste directly into the editor |
| Scope | **Own profile only**, personal use | Do NOT distribute as a general scraper |

---

## 3. Constraints & dead ends (already ruled out)

- **Headless scraping** (bot login) → against LinkedIn ToS + fragile. Ruled out. The userscript is the defensible alternative (own browser, manual).
- **LinkedIn API** → non-starter for CV data. "Sign In with LinkedIn" (OpenID Connect) returns only name/photo/email; the rich profile API is partner-gated. Ruled out.
- **CSV data export / "Save to PDF"** → considered as fallbacks; rejected as primary. CSV is slow (emailed) + lossy formatting; PDF text is flat/lossy; neither has company logos.
- **Old embedded `<code id="bpr-guid…">` Voyager JSON blobs** → **GONE** on current LinkedIn (verified 2026-07-13: `document.querySelector('code')` returns `null`). Do not build around these.

---

## 4. Data source — current best hypothesis: intercept the Voyager API

Modern LinkedIn fetches profile data **over the wire** from `*.linkedin.com/voyager/api/…` as JSON *after* page load — so it lives in **network responses**, not the HTML.

**Primary approach:** the userscript wraps `fetch` / `XMLHttpRequest` to capture LinkedIn's own authenticated API payloads as the page loads them. Robust to visual redesigns; reads LinkedIn's own structured JSON.

```js
// fetch hook — capture Voyager API responses (proof-of-concept)
const orig = window.fetch;
window.fetch = async (...args) => {
  const res = await orig(...args);
  const url = args[0]?.url || args[0];
  if (typeof url === 'string' && url.includes('/voyager/api/')) {
    res.clone().json().then(j => console.log('CAPTURED', url, j)).catch(() => {});
  }
  return res;
};
// also hook XMLHttpRequest — LinkedIn may use either
// then scroll / open profile sections and watch which URLs light up
```

**Fallbacks (in order):**
1. `application/ld+json` (schema.org `Person`) — stable, documented, but thin (name/title/org; usually no dates, bullets, or logos).
2. Parse the **rendered DOM** after expanding all "see more" — anchor on visible text / `aria-*` / semantic landmarks, **not** hashed class names.

**Company logos:** come from the profile data itself (the `media.licdn.com/.../company-logo…` URLs). Fallback: `logo.clearbit.com/<company-domain>`.

### ⚠️ FIRST STEP AT KICKOFF — ground-truth probes

Run these in the console on the live profile and record outputs (my knowledge of LinkedIn's structure is version-dependent and shifts):

```js
// 1) SEO JSON-LD present? (stable but thin)
document.querySelectorAll('script[type="application/ld+json"]').length
// 2) peek it
JSON.parse(document.querySelector('script[type="application/ld+json"]')?.textContent || 'null')
// 3) what <script> types exist? (hunt embedded JSON)
[...new Set([...document.scripts].map(s => s.type).filter(Boolean))]
// 4) any global state on window?
Object.keys(window).filter(k => /state|store|data|voyager|apollo|__/i.test(k))
// 5) drop in the fetch hook above, scroll the page, note which /voyager/api/… URLs fire
```

Build the parser against **what these actually return today**, not against assumptions.

---

## 5. Target output format (oh-my-cv markdown)

Produced by the pipeline shaped in PR #1 (`site/src/utils/markdown.ts`). The converter must emit exactly this shape:

### Frontmatter (header)
```yaml
---
name: Leo Caseiro
image: <public http(s) photo URL>        # optional; renders as circular avatar
header:
  - text: |                              # ⚠️ MUST use `|` block scalar (or quotes)
      <span style="font-size: 1.2em; font-weight: bold;">Senior Full-Stack Engineer</span>
  - text: <span class="iconify" data-icon="tabler:phone"></span> 0452 663 199
    link: tel:0452663199
    newLine: true
  - text: <span class="iconify" data-icon="tabler:mail"></span> leo@leocaseiro.com
    link: mailto:leo@leocaseiro.com
  # …linkedin, location, etc.
---
```
**Critical YAML gotcha:** any `text:` value containing `: ` (colon-space) — e.g. inline `style="font-size: 1.2em"` — **must** use `text: |` on its own line (or be quoted), or the whole frontmatter silently fails to parse (this bit us; PR #1 added a warning banner, but the converter must emit valid YAML in the first place). The converter should default to emitting **every** `text:` as a `|` block to be safe.

### Body sections
- `## Summary`, `## Skills`, `## Experience`, `## Education`, `## Awards and Honors`
- **Skills:** `•`-separated inline list.
- **Experience entry** = optional leading logo `<img>` + **two stacked `~` definition lists** (company/location row, then role/period row):

```markdown
<img class="resume-company-logo" src="https://media.licdn.com/.../company-logo…" />
**Atlassian**
  ~ Umina Beach, NSW (Remote)

Senior Software Engineer (Jira AI)
  ~ 09/2024 - 04/2026

- Bullet one…
- Bullet two…
```
(A standalone `<img>` line no longer needs a trailing blank line — PR #1 normalizes that.)

---

## 6. Proposed execution plan (phases)

1. **Ground-truth** — run the §4 probes on the live profile; decide primary source (Voyager fetch-hook vs JSON-LD vs DOM). _Verify: capture one real experience entry as JSON/text._
2. **Capture layer** — userscript hooks `fetch`+`XHR`, auto-expands "see more", scrolls to trigger lazy loads, collects raw profile data. _Verify: console dump has all sections._
3. **Normalize** — map raw → a clean intermediate model: `{ name, headline, photo, contacts[], summary, skills[], experience[{company, logo, location, role, start, end, bullets[]}], education[], awards[] }`. _Verify: intermediate JSON looks right for Leo's profile._
4. **Render** — deterministic model → oh-my-cv markdown (see §5), emitting `text: |` blocks, `~` two-row entries, `•` skills, logo `<img>`. _Verify: paste into oh-my-cv, header + entries render; no frontmatter warning banner._
5. **UX** — floating "Copy oh-my-cv markdown" button on the profile page; write result to clipboard; toast on success. _Verify: one click → paste → done._
6. **Resilience** — graceful fallback chain (Voyager → JSON-LD → DOM); clear console diagnostics when a section can't be found. _Verify: still produces partial markdown if one section changes._

### Userscript skeleton
```js
// ==UserScript==
// @name         LinkedIn → oh-my-cv
// @match        https://www.linkedin.com/in/*
// @grant        GM_setClipboard
// @run-at       document-start
// ==/UserScript==
// document-start so the fetch/XHR hooks are installed before LinkedIn's requests fire.
```

---

## 7. Open questions (for Brainstorm mode)

- Primary source once probes are in: **Voyager fetch-hook** (rich, needs the requests to fire) vs **DOM parse** (simplest, resilient to internal refactors) vs **JSON-LD** (too thin alone)?
- Contact details (phone, email, location) often aren't on the public profile DOM — pull from the "Contact info" modal, or leave as manual fields?
- Skill iconify icons (`vscode-icons:…`) — auto-map skills→icons, or plain `•` list?
- Logo source: Voyager URLs are signed/expiring (`?e=…&v=beta&t=…`) — is an expiring URL OK, or resolve a stable one (Clearbit) at generate time?
- Multiple positions at the same company — group under one logo, or repeat?

---

## 8. Kickoff instructions (next session)

Start a session with e.g. **"let's build the LinkedIn userscript — execute mode"** (or **"brainstorm mode"**). First action is always §4's probes on the live profile. Reference this doc + the project memory.

## 9. References
- PR #1 (branch `worktree-feat+profile-photo-header`): profile photo, company logos, deflist fix, frontmatter guard, `•` separator.
- Markdown pipeline: `site/src/utils/markdown.ts` (frontmatter parse, `renderHeader`, `_isolateStandaloneImages`).
- Project memory: `project_linkedin-to-markdown-converter.md` (Claude memory store).
