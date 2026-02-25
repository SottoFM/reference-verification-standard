## What does this PR change?

<!-- Describe the change: new domain pattern, weight adjustment, threshold change, new domain, etc. -->

## Motivation

<!-- Why is this change needed? What real-world cases does it fix? -->

## Scoring impact

<!-- Fill in the table for any domains that changed -->

| Domain | Before | After | Net effect |
|--------|--------|-------|------------|
| NEWS | url(0.35) + ai(0.65), threshold 0.50 | — | — |

## Test cases added

<!-- List the test cases you added or modified -->

- [ ] New test: `...`
- [ ] Updated test: `...`

## Evidence

<!-- Paste 2-3 concrete reference examples showing the change improves outcomes -->

| Reference | URL | Expected | Before | After |
|-----------|-----|----------|--------|-------|
| NYT article | https://nytimes.com/... | VERIFIED | REMOVED | VERIFIED |

## Checklist

- [ ] Tests pass (`npm test`)
- [ ] Type-check passes (`npm run typecheck`)
- [ ] CHANGELOG.md updated
- [ ] Weights for modified domains still sum to 1.0
