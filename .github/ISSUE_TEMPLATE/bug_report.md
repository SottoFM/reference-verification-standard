---
name: Bug report
about: Something is scored or classified incorrectly
title: '[BUG] '
labels: bug
assignees: ''
---

## Describe the bug

A clear description of what the bug is.

## Reference that was mis-classified or mis-scored

```ts
// Input
classifyReference({
  doi: null,
  url: 'https://...',
  type: 'ARTICLE',
});
// Expected: 'NEWS'
// Got: 'GENERAL'
```

## Expected behavior

What should have happened.

## Actual behavior

What actually happened, with the score breakdown if relevant.

## Additional context

Any other context — link to the source, why the classification matters, etc.
