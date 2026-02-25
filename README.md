<div align="center">

# @sottofm/verification-standard

**The open, domain-aware reference verification standard.**

[![CI](https://github.com/SottoFM/reference-verification-standard/actions/workflows/ci.yml/badge.svg)](https://github.com/SottoFM/reference-verification-standard/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@sottofm/verification-standard?color=D97706)](https://www.npmjs.com/package/@sottofm/verification-standard)
[![License: MIT](https://img.shields.io/badge/License-MIT-1E3A5F.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-1E3A5F)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-16A34A.svg)](CONTRIBUTING.md)

*Because a Reuters article and a Nature paper need different verification criteria.*

[**Why this exists**](#the-problem) · [**Quick start**](#quick-start) · [**Domain scoring**](#domain-scoring) · [**API**](#api-reference) · [**Contributing**](#contributing)

---

</div>

## The Problem

Most citation verification systems apply a single fixed formula to every source:

```
score = doi × 0.40 + title_search × 0.30 + url × 0.10 + ai × 0.20
```

This is broken for anything that isn't an academic paper. DOI and academic title search
are irrelevant for a New York Times article — which means a live, credible Reuters story
scores **at most 0.23** against a 0.65 threshold and is always marked as removed.

News podcasts silently end up with zero references.

## The Fix

Domain-aware scoring. Each source is classified into one of four domains first, then scored
by the layers and weights appropriate for that domain.

```
ACADEMIC  →  doi(0.45) + title_search(0.30) + url(0.10) + ai(0.15)  ≥ 0.70
NEWS      →  url(0.35) + ai(0.65)                                    ≥ 0.50
GOVERNMENT→  url(0.40) + ai(0.60)                                    ≥ 0.55
GENERAL   →  url(0.30) + title_search(0.10) + ai(0.60)              ≥ 0.55
```

**Concrete result:** A live NYT article:
- Old (fixed weights): `0.10×0.6 + 0.20×0.85 = 0.23` → **REMOVED** ❌
- New (domain-aware NEWS): `0.35×0.6 + 0.65×0.85 = 0.76` → **VERIFIED** ✅

**Paywalled article (403 response):** AI alone scores `0.65 × 0.85 = 0.5525 > 0.50` → **VERIFIED** ✅

---

## Quick Start

```bash
npm install @sottofm/verification-standard
```

```ts
import {
  classifyReference,
  computeDomainAwareScore,
  DOMAIN_CONFIGS,
} from '@sottofm/verification-standard';

// Step 1: classify the reference
const domain = classifyReference({
  doi: null,
  url: 'https://www.nytimes.com/2024/01/climate.html',
  type: 'ARTICLE',
});
// → 'NEWS'

// Step 2: run your verification layers (URL check, AI eval, etc.)
const layerResults = [
  { layerId: 'url', passed: true, confidence: 0.6 },
  { layerId: 'ai',  passed: true, confidence: 0.85 },
];

// Step 3: compute domain-aware score
const { score, verdict } = computeDomainAwareScore(domain, layerResults);
// → { score: 0.7625, verdict: 'VERIFIED' }

// Optional: access domain config (AI instructions, URL patterns, etc.)
const config = DOMAIN_CONFIGS[domain];
console.log(config.aiInstruction);
// → "Verify this is from a credible news outlet..."
```

---

## Domain Scoring

### ACADEMIC

> Peer-reviewed papers, preprints, books, technical reports

| Layer | Weight | Description |
|-------|--------|-------------|
| `doi` | **0.45** | DOI registered in CrossRef — strongest signal |
| `title_search` | **0.30** | Indexed in OpenAlex / academic title search |
| `url` | 0.10 | URL resolves (journal site, arXiv, etc.) |
| `ai` | 0.15 | AI claim-support evaluation |

**Threshold: ≥ 0.70** · Classified by: DOI present, arXiv/PubMed/Nature/IEEE URL, PAPER/BOOK type

---

### NEWS

> Established news outlets (NYT, Reuters, BBC, AP, Guardian, Bloomberg…)

| Layer | Weight | Description |
|-------|--------|-------------|
| `url` | 0.35 | URL resolves to a live article (403 = partial credit for known outlets) |
| `ai` | **0.65** | AI confirms outlet credibility and claim support |

**Threshold: ≥ 0.50** · Lower threshold because credible outlets often return 403/paywall · Classified by: Reuters/NYT/BBC/AP/Guardian/Bloomberg/FT URL pattern, ARTICLE type

> **Paywall math:** `0.65 × 0.85 = 0.5525 > 0.50` — a credible outlet passes via AI even with a dead URL.

---

### GOVERNMENT

> Official government reports, legislation, statistics

| Layer | Weight | Description |
|-------|--------|-------------|
| `url` | 0.40 | URL resolves to an official government domain |
| `ai` | **0.60** | AI verifies official source and claim support |

**Threshold: ≥ 0.55** · Classified by: `.gov`, `who.int`, `un.org`, `worldbank.org`, `oecd.org` URL patterns

---

### GENERAL

> Wikipedia, blogs, videos, podcasts, and other web content

| Layer | Weight | Description |
|-------|--------|-------------|
| `url` | 0.30 | URL resolves |
| `title_search` | 0.10 | May be indexed (Wikipedia, major sites) |
| `ai` | **0.60** | AI evaluates source credibility and claim support — high scrutiny |

**Threshold: ≥ 0.55** · Catch-all domain for anything not classified above

---

## Classification Logic

`classifyReference` follows a strict priority order:

```
1. DOI present?          → ACADEMIC (always)
2. URL matches ACADEMIC patterns?  → ACADEMIC
3. URL matches NEWS patterns?      → NEWS
4. URL matches GOVERNMENT patterns? → GOVERNMENT
5. Type matches ACADEMIC types?    → ACADEMIC
6. Type matches NEWS types?        → NEWS (only via ARTICLE with matching URL)
7. Fallback                        → GENERAL
```

---

## API Reference

### `classifyReference(ref)`

Classify a reference into a content domain.

```ts
function classifyReference(ref: {
  doi?: string | null;
  url?: string | null;
  type?: string | null;
}): ContentDomain
```

### `computeDomainAwareScore(domain, layerResults)` — v1

Compute a weighted-sum score for a given domain.

```ts
function computeDomainAwareScore(
  domain: ContentDomain,
  layerResults: LayerResult[]
): { score: number; verdict: 'VERIFIED' | 'FAILED' }
```

`score` is between 0 and 1. `verdict` is `'VERIFIED'` if `score >= domain.threshold`, `'FAILED'` otherwise.

Layer results for layers not applicable to the domain are ignored.

---

### `computeBayesianScore(domain, layerResults)` — v2

Compute a Bayesian posterior probability using log-odds updating.

```ts
function computeBayesianScore(
  domain: ContentDomain,
  layerResults: LayerResult[]
): {
  posterior: number;              // P(reference is real | evidence) — 0.0–1.0
  verdict: 'VERIFIED' | 'FAILED'; // posterior >= domain.bayesianThreshold
  logOddsContributions: Record<string, number>; // per-layer Δ log-odds (for transparency)
}
```

**Algorithm:**

```
prior_log_odds = ln(prior / (1 - prior))

For each applicable layer with confidence c ∈ [0, 1]:
  LR+ = sensitivity / (1 - specificity)   — how much a pass shifts toward "real"
  LR- = (1 - sensitivity) / specificity   — how much a fail shifts toward "fake"
  Δ   = c × ln(LR+) + (1-c) × ln(LR-)

posterior = sigmoid(prior_log_odds + Σ Δ)
```

Absent layers default to `c = 0.5` (minimally informative). `logOddsContributions` exposes each layer's Δ for debugging and explainability.

**Example:**
```ts
const { posterior, verdict, logOddsContributions } = computeBayesianScore('NEWS', [
  { layerId: 'url', passed: false, confidence: 0 },  // 403 paywall
  { layerId: 'ai',  passed: true,  confidence: 0.85 },
]);
// posterior ≈ 0.82, verdict: 'VERIFIED'
// logOddsContributions: { url: -0.73, ai: +1.21 }
```

---

### `DOMAIN_CONFIGS`

```ts
const DOMAIN_CONFIGS: Record<ContentDomain, DomainConfig>
```

Full domain configuration map. Each `DomainConfig` includes:

```ts
interface DomainConfig {
  domain: ContentDomain;
  label: string;                 // 'Academic' | 'News' | 'Government' | 'General'
  description: string;
  layers: BayesianLayerConfig[]; // applicable layers with weights + Bayesian params
  threshold: number;             // v1: minimum weighted score to VERIFY
  prior: number;                 // v2: P(reference is real | domain)
  bayesianThreshold: number;     // v2: minimum posterior probability to VERIFY
  aiInstruction: string;         // injected into AI evaluator prompt
  urlPatterns?: RegExp[];        // URL patterns for classification
  typePatterns?: string[];       // ReferenceType values for classification
}

interface BayesianLayerConfig extends LayerConfig {
  bayesian: {
    sensitivity: number; // P(pass | real) — 0.0–1.0
    specificity: number; // P(fail | fake) — 0.0–1.0
  };
}
```

### Types

```ts
type ContentDomain = 'ACADEMIC' | 'NEWS' | 'GOVERNMENT' | 'GENERAL';

type LayerId = 'doi' | 'title_search' | 'url' | 'ai';

interface LayerResult {
  layerId: LayerId;
  passed: boolean;
  confidence: number; // 0.0–1.0
}

interface LayerConfig {
  id: LayerId;
  weight: number;      // normalized weight, all layers in a domain sum to 1.0
  description: string;
}
```

---

## Architecture

```
src/
├── types.ts      — ContentDomain, LayerId, LayerResult, DomainConfig, BayesianLayerConfig
├── domains.ts    — DOMAIN_CONFIGS (the standard itself, including Bayesian params)
├── classify.ts   — classifyReference()
├── score.ts      — computeDomainAwareScore() [v1: weighted sum]
├── bayesian.ts   — computeBayesianScore()    [v2: log-odds updating]
└── index.ts      — public exports
```

The standard has zero runtime dependencies. Pure TypeScript — works in any JS environment.

---

## Used by Sotto

This package is the scoring engine behind [Sotto](https://sotto.fm) — the open podcast network
where AI generates multi-voice podcasts from any topic.

Every reference cited in a Sotto podcast is verified using this standard. The domain badge
(Academic / News / Government / General) and verification status visible in the podcast player
are computed entirely from the logic in this repository.

When this standard improves — via community PRs — Sotto benefits automatically by
updating its submodule reference.

---

## Contributing

This standard is intentionally public. Weights, thresholds, URL patterns, and AI instructions
are all community-improvable. If a credible source is being rejected, or a junk source is passing,
open an issue or PR.

→ **[Read CONTRIBUTING.md](CONTRIBUTING.md)**

Key things you can improve:
- **URL patterns** — Add a news outlet, government agency, or academic publisher that's being misclassified
- **Weights** — Propose evidence-backed changes to layer weights or thresholds
- **AI instructions** — Improve the prompt guidance for each domain's AI evaluator
- **New domains** — Make the case for a new domain (e.g., `SOCIAL_MEDIA`, `PREPRINT`)

---

## License

[MIT](LICENSE) — Copyright © 2024 [SottoFM](https://sotto.fm)
