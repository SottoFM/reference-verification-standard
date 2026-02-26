# Contributing to the Sotto Open Verification Standard

Thank you for helping make citation verification fairer and more transparent.
This standard is intentionally public so the community can improve it — adjust weights,
add new domains, fix misclassifications, and catch cases we haven't thought of.

---

## Table of Contents

- [Ways to Contribute](#ways-to-contribute)
- [Development Setup](#development-setup)
- [Proposing Weight or Threshold Changes](#proposing-weight-or-threshold-changes)
- [Adding a New Domain](#adding-a-new-domain)
- [Adding URL Patterns](#adding-url-patterns)
- [Writing Tests](#writing-tests)
- [Pull Request Process](#pull-request-process)
- [Design Principles](#design-principles)

---

## Ways to Contribute

| Contribution | How |
|--------------|-----|
| Fix a misclassification (e.g., BBC URL not detected as NEWS) | Add a URL pattern to `src/domains.ts` + test |
| A credible source is being rejected incorrectly | Open a proposal issue with evidence |
| A junk source is passing verification | Open a bug report |
| Add support for a new domain (e.g., SOCIAL_MEDIA) | See [Adding a New Domain](#adding-a-new-domain) |
| Improve the AI prompt instruction for a domain | Edit `aiInstruction` in `src/domains.ts` |
| Fix a documentation error | PR directly |

---

## Development Setup

```bash
git clone https://github.com/SottoFM/reference-verification-standard.git
cd reference-verification-standard
npm install

# Run tests
npm test

# Watch mode
npm run test:watch

# Type-check
npm run typecheck

# Build (outputs to dist/)
npm run build
```

**Requirements**: Node.js 18+, npm 8+

---

## Proposing Weight or Threshold Changes

Weights and thresholds are the most impactful changes. A small adjustment can mean hundreds of
valid sources being verified vs removed. Please include evidence.

### What good evidence looks like

A concrete reference that currently scores incorrectly, with the full breakdown:

```
Reference: "Climate change accelerating, UN report says" — Reuters, 2024
URL: https://www.reuters.com/climate/... (returns 200)
AI verdict: REAL (credible outlet, claim supported)

Current score (broken):
  doi  × 0.40 = 0       (irrelevant for news)
  ts   × 0.30 = 0       (irrelevant for news)
  url  × 0.10 = 0.06
  ai   × 0.20 = 0.17
  ──────────────────
  total = 0.23 → REMOVED ❌

Proposed score (domain-aware NEWS):
  url × 0.35 = 0.21
  ai  × 0.65 = 0.5525
  ──────────────────
  total = 0.76 → VERIFIED ✓
```

### Process

1. Open an issue using the **Proposal** template
2. Include 2–3 concrete examples with score breakdowns
3. If it's a threshold change, show what currently passes/fails at the current and proposed threshold
4. Submit a PR with the change + tests + CHANGELOG entry

### Bayesian parameters

**Bayesian parameters** — `sensitivity`, `specificity`, and `prior` values are currently
expert-set heuristics (see `src/domains.ts`). A valuable contribution would be empirically
calibrating these against a labeled dataset of real vs. hallucinated references.

---

## Adding a New Domain

If you believe a new content type deserves its own scoring model (e.g., `SOCIAL_MEDIA`, `PREPRINT`):

1. Add the domain to `ContentDomain` in `src/types.ts`
2. Add its `DomainConfig` entry in `src/domains.ts`:
   - Define applicable layers and weights (must sum to 1.0)
   - Set a threshold
   - Write an `aiInstruction` that guides the AI evaluator
   - Add `urlPatterns` and `typePatterns` to help `classifyReference`
3. Update `classifyReference` in `src/classify.ts` if the new domain needs a specific priority position
4. Add tests in `tests/classify.test.ts` and `tests/domains.test.ts`
5. Update the README scoring table

### Naming conventions

- Domain names: `UPPER_SNAKE_CASE` (e.g., `SOCIAL_MEDIA`)
- Layer IDs: `lower_snake_case` (e.g., `social_graph`)
- Keep domain names generic — `ACADEMIC` not `PAPER`, `NEWS` not `JOURNALISM`

---

## Adding URL Patterns

URL patterns are regular expressions tested against the reference URL. They determine domain
classification when no DOI is present.

```ts
// In src/domains.ts, under the relevant domain's urlPatterns array:
urlPatterns: [
  /\bnewsite\.com\b/,      // matches newsite.com subdomains too
  /\bnewsite\.org\b/,
],
```

### Guidelines for URL patterns

- Use `\b` word boundaries to avoid partial matches (e.g., `/\bnpr\.org\b/` not `/npr\.org/`)
- Include both `www` and non-`www` variants if they differ (most regex patterns handle this with `\b`)
- Use `\.` to escape dots in domain names
- Prefer specific patterns over broad ones — `\bnytimes\.com\b` not `\bnyt/`
- Include both `.com` and country TLDs where relevant (e.g., `\bbbc\.(com|co\.uk)\b`)
- Test your pattern manually: `console.log(/\byourpattern\.com\b/.test('https://www.yourpattern.com/article'))`

---

## Writing Tests

Tests live in `tests/`. We use [Vitest](https://vitest.dev/).

### Test naming

Name tests after what they verify, not what they call:

```ts
// ✓ Good
it('classifies a paywalled Reuters article as NEWS', ...)
it('NEWS score with 403 URL still clears 0.50 threshold via AI', ...)

// ✗ Bad
it('classifyReference returns NEWS', ...)
it('computeDomainAwareScore works', ...)
```

### What to test

- Every new URL pattern you add
- Score boundary cases (just above/below threshold)
- Priority ordering (e.g., DOI overrides NEWS URL pattern)
- Empty/null/missing inputs

---

## Pull Request Process

1. Fork the repo and create a branch: `git checkout -b fix/bbc-news-pattern`
2. Make your changes with tests
3. Ensure all checks pass: `npm run typecheck && npm test && npm run build`
4. Update `CHANGELOG.md` under `[Unreleased]`
5. Open a PR using the PR template
6. A maintainer will review within a few days

### What makes a PR easy to merge

- One focused change per PR (don't bundle weight changes + new patterns)
- Tests for every new pattern or scoring change
- CHANGELOG entry
- Score breakdown table showing before/after for affected cases

---

## Design Principles

These guide every decision in the standard:

1. **Domain-aware, not one-size-fits-all** — A Reuters article and a Nature paper need different
   verification criteria. Never apply academic standards to news.

2. **Paywalls are not fabrications** — A URL returning 403 from a known outlet is evidence of
   a real article, not a fake one. The AI layer must carry enough weight to verify paywalled content.

3. **AI confidence is capped** — The maximum AI confidence contribution is 0.85 (not 1.0). No
   single layer should be able to single-handedly verify a reference at maximum confidence.

4. **Err toward verification for credible sources, rejection for anonymous ones** — For established
   outlets (NYT, Nature, CDC), the standard leans REAL. For anonymous blogs, it leans REMOVED.

5. **Transparency** — Every verification score is explainable: layer × weight = contribution.
   No black boxes.

6. **Weights must sum to 1.0** — Every domain's layers must sum to exactly 1.0. This keeps
   scores interpretable as fractions of the maximum possible confidence.

---

## Questions?

Open an issue or start a discussion. We're happy to help guide contributions.

Built with care by [Sotto](https://sotto.fm) — the open podcast network.
