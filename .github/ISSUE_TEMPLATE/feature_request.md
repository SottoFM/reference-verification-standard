---
name: Proposal — weight / threshold / domain change
about: Propose a change to scoring weights, thresholds, or domain detection
title: '[PROPOSAL] '
labels: proposal
assignees: ''
---

## Summary

What change are you proposing?

## Motivation

Why is the current standard wrong or incomplete for this case?
Include real-world examples where the current scoring fails.

## Proposed change

```ts
// Current
NEWS: {
  layers: [
    { id: 'url', weight: 0.35 },
    { id: 'ai',  weight: 0.65 },
  ],
  threshold: 0.50,
}

// Proposed
NEWS: {
  layers: [
    { id: 'url', weight: 0.30 },
    { id: 'ai',  weight: 0.70 },
  ],
  threshold: 0.48,
}
```

## Evidence

Concrete examples showing the proposed change improves outcomes.
Include references that currently fail but should pass, or pass but should fail.

## Impact assessment

- Does this change affect other domains?
- Could it increase false positives (accepting bad sources)?
- Could it increase false negatives (rejecting good sources)?
