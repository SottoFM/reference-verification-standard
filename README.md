<div align="center">

# @sottofm/verification-standard

**The open, domain-aware reference verification standard.**

[![CI](https://github.com/SottoFM/reference-verification-standard/actions/workflows/ci.yml/badge.svg)](https://github.com/SottoFM/reference-verification-standard/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@sottofm/verification-standard?color=D97706)](https://www.npmjs.com/package/@sottofm/verification-standard)
[![License: MIT](https://img.shields.io/badge/License-MIT-1E3A5F.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-1E3A5F)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-16A34A.svg)](CONTRIBUTING.md)

*Because a Reuters article and a Nature paper need different verification criteria.*

[**Why this exists**](#the-problem) · [**Quick start**](#quick-start) · [**How it works**](#how-bayesian-scoring-works-plain-english) · [**Domain scoring**](#domain-scoring) · [**API**](#api-reference) · [**Prior art**](#prior-art--theoretical-basis) · [**Contributing**](#contributing)

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

> **v2 (Bayesian):** Use `computeBayesianScore` for a probabilistic posterior with per-layer
> explainability — see [API Reference → computeBayesianScore](#computebayesianscoredomainlayerresults--v2).

---

## How Bayesian Scoring Works (Plain English)

*Not a stats person? Here is the intuition behind `computeBayesianScore`.*

### The core idea

Start with a gut feeling — a starting probability — then update it with evidence. Each
verification check nudges your confidence up or down. The result is a single probability
(e.g. "81% chance this reference is real"), not a weighted percentage.

### Starting confidence (the prior)

Each domain starts with a different base probability before any checks run. These reflect
how often AI-generated content hallucinates references in that domain:

| Domain | Prior | Why |
|--------|-------|-----|
| GOVERNMENT | 82% | Official government sources are rarely fabricated |
| NEWS | 75% | Established outlets are usually real; moderate hallucination risk |
| ACADEMIC | 72% | Papers are generally genuine; fabrication exists but is less common |
| GENERAL | 45% | Anonymous web content has high hallucination risk — lower starting confidence |

### How each check updates your confidence

Every verification layer has two diagnostic properties:

| Property | Plain English | What it means |
|----------|--------------|---------------|
| **Sensitivity** | Hit rate | How often does this check *pass* for a real reference? High = rarely misses real refs |
| **Specificity** | Fake-catcher rate | How often does this check *fail* for a fake reference? High = rarely lets fakes through |

A layer with **high sensitivity AND high specificity** is highly informative. For NEWS,
the AI layer (sensitivity 0.82, specificity 0.80) carries far more signal than the URL
check (sensitivity 0.55, specificity 0.85) — because news articles are commonly paywalled,
a failed URL is weak evidence of fakeness.

### Evidence accumulates

The algorithm keeps a running tally in **log-odds** — a representation where you can
simply add and subtract evidence instead of multiplying probabilities. At the end, it
converts back to a normal probability from 0% to 100%.

**Example — paywalled NYT article (NEWS domain):**

| Step | Evidence | Running probability |
|------|---------|---------------------|
| Prior | NEWS domain — moderate hallucination risk | 75% |
| URL 403 (confidence = 0) | Paywalled; credible outlets often return 403 | ~61% |
| AI confirms credible outlet (confidence = 0.85) | Strong positive signal | ~81% |
| **Verdict** | 81% ≥ 65% Bayesian threshold | ✅ **VERIFIED** |

A broken URL from a known outlet barely disqualifies the reference. Strong AI confirmation
brings the probability to 81%, which clears the 65% threshold for NEWS.

### Why not just use v1 (weighted sum)?

v1 is simpler and faster. v2 adds three things:

1. **A domain-calibrated starting estimate** — the prior accounts for base rates of
   hallucination by content type
2. **Principled evidence combination** — Bayes' theorem handles asymmetric layers gracefully
   (a weak layer barely moves the posterior; a strong layer moves it a lot)
3. **Per-layer explainability** — `logOddsContributions` shows exactly which check helped
   and which hurt, making failures debuggable

For most references, v1 and v2 agree. The difference shows up in edge cases: a paywalled
article from a credible outlet, or a reference with strong AI support but a broken URL.

→ **[See the full API docs for `computeBayesianScore`](#computebayesianscoredomainlayerresults--v2)**

---

## Domain Scoring

*Column guide: LR+ = sensitivity / (1 − specificity); LR− = (1 − sensitivity) / specificity.
Higher LR+ means a confident pass is stronger evidence of a real reference; lower LR− means
a confident fail is stronger evidence of a fake.*

### ACADEMIC

> Peer-reviewed papers, preprints, books, technical reports

`v1 threshold: ≥ 0.70  |  v2 prior: 0.72  |  v2 bayesianThreshold: ≥ 0.82`

| Layer | v1 Weight | Sensitivity | Specificity | LR+ | LR− |
|-------|-----------|-------------|-------------|-----|-----|
| `doi` | **0.45** | 0.92 | 0.97 | 30.67 | 0.08 |
| `title_search` | **0.30** | 0.80 | 0.88 | 6.67 | 0.23 |
| `url` | 0.10 | 0.70 | 0.72 | 2.50 | 0.42 |
| `ai` | 0.15 | 0.78 | 0.82 | 4.33 | 0.27 |

**Classified by:** DOI present, arXiv/PubMed/Nature/IEEE URL, PAPER/BOOK type

---

### NEWS

> Established news outlets (NYT, Reuters, BBC, AP, Guardian, Bloomberg…)

`v1 threshold: ≥ 0.50  |  v2 prior: 0.75  |  v2 bayesianThreshold: ≥ 0.65`

| Layer | v1 Weight | Sensitivity | Specificity | LR+ | LR− |
|-------|-----------|-------------|-------------|-----|-----|
| `url` | 0.35 | 0.55 | 0.85 | 3.67 | 0.53 |
| `ai`  | **0.65** | 0.82 | 0.80 | 4.10 | 0.23 |

**Classified by:** Reuters/NYT/BBC/AP/Guardian/Bloomberg/FT URL pattern, ARTICLE type · Lower v1 threshold because credible outlets often return 403/paywall

> **Paywall math:** `0.65 × 0.85 = 0.5525 > 0.50` — a credible outlet passes via AI even with a dead URL.

---

### GOVERNMENT

> Official government reports, legislation, statistics

`v1 threshold: ≥ 0.55  |  v2 prior: 0.82  |  v2 bayesianThreshold: ≥ 0.72`

| Layer | v1 Weight | Sensitivity | Specificity | LR+ | LR− |
|-------|-----------|-------------|-------------|-----|-----|
| `url` | 0.40 | 0.85 | 0.93 | 12.14 | 0.16 |
| `ai`  | **0.60** | 0.80 | 0.84 | 5.00 | 0.24 |

**Classified by:** `.gov`, `who.int`, `un.org`, `worldbank.org`, `oecd.org` URL patterns

---

### GENERAL

> Wikipedia, blogs, videos, podcasts, and other web content

`v1 threshold: ≥ 0.55  |  v2 prior: 0.45  |  v2 bayesianThreshold: ≥ 0.68`

| Layer | v1 Weight | Sensitivity | Specificity | LR+ | LR− |
|-------|-----------|-------------|-------------|-----|-----|
| `url` | 0.30 | 0.65 | 0.70 | 2.17 | 0.50 |
| `title_search` | 0.10 | 0.30 | 0.75 | 1.20 | 0.93 |
| `ai`  | **0.60** | 0.72 | 0.78 | 3.27 | 0.36 |

**Classified by:** Catch-all for anything not classified above

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
// posterior ≈ 0.81, verdict: 'VERIFIED'
// logOddsContributions: { url: -0.64, ai: +0.98 }
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

## Prior Art & Theoretical Basis

The Bayesian log-odds algorithm is a well-established pattern in statistics and evidence-based
medicine. Each domain layer's sensitivity/specificity pair functions as its likelihood ratio,
and evidence accumulates additively in log space — a formulation due to Good (1950). The domain
priors reflect empirical base rates of hallucinated references by content type, motivated by
factuality benchmarks showing that hallucination rates differ significantly across content domains.

**Methodology**

| Citation | Relevance |
|----------|-----------|
| Good, I.J. (1950). *Probability and the Weighing of Evidence*. Charles Griffin. | Formalizes `initial_log_odds + weight_of_evidence = final_log_odds` where weight of evidence = log(likelihood ratio) — the core formula used here |
| Wald, A. (1947). *Sequential Analysis*. Wiley. | Foundation of sequential likelihood-ratio testing; the theoretical precursor to log-odds evidence accumulation |
| Fagan, T.J. (1975). "Nomogram for Bayes's theorem." *New England Journal of Medicine*, 293, 257. | Graphical tool for applying Bayes' theorem via likelihood ratios to convert pre-test to post-test probability |
| Jaeschke, R., Guyatt, G.H., & Sackett, D.L. (1994). "Users' Guides to the Medical Literature III-B: How to Use an Article About a Diagnostic Test." *JAMA*, 271(9), 703–707. | Practical guide to interpreting diagnostic tests via sensitivity, specificity, and likelihood ratios |
| Good, I.J. (1985). "Weight of Evidence: A Brief Survey." In *Bayesian Statistics 2*, pp. 249–270. | Accessible summary of the weight-of-evidence framework by Good himself |

**Application domain**

| Citation | Relevance |
|----------|-----------|
| Manakul, P., Liusie, A., & Gales, M.J.F. (2023). "SelfCheckGPT: Zero-Resource Black-Box Hallucination Detection for Generative Large Language Models." *EMNLP 2023*. [arXiv:2303.08896](https://arxiv.org/abs/2303.08896) | Motivates hallucination detection in AI-generated content; demonstrates that consistency varies by content type |
| Min, S., et al. (2023). "FActScore: Fine-Grained Atomic Factuality Evaluation in Long-Form Text Generation." *EMNLP 2023*. [arXiv:2305.14251](https://arxiv.org/abs/2305.14251) | Fine-grained factuality evaluation showing hallucination rates differ significantly by domain — motivates domain-specific priors |

> **Calibration note:** The `sensitivity`, `specificity`, and `prior` values in `src/domains.ts`
> are expert-set heuristics, not empirically calibrated against a labeled dataset. They reflect
> informed judgment about relative layer reliability. Empirically calibrating these against real
> vs. hallucinated reference data would be a high-value community contribution — see
> [CONTRIBUTING.md](CONTRIBUTING.md) for details.

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
