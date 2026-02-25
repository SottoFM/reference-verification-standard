# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-02-25

### Added

- `computeBayesianScore()` — v2 Bayesian log-odds scoring with per-layer sensitivity/specificity
- `LayerBayesianParams` type: `{ sensitivity, specificity }` per layer
- `BayesianLayerConfig` type: extends `LayerConfig` with `bayesian` field
- `prior` field on `DomainConfig` — P(reference is real | domain)
- `bayesianThreshold` field on `DomainConfig` — minimum posterior to VERIFY
- Domain priors: ACADEMIC=0.72, NEWS=0.75, GOVERNMENT=0.82, GENERAL=0.45
- Bayesian thresholds: ACADEMIC=0.82, NEWS=0.65, GOVERNMENT=0.72, GENERAL=0.68
- 17 new Bayesian tests (126 total)

### Changed

- `DomainConfig.layers` type widened from `LayerConfig[]` to `BayesianLayerConfig[]`
- `DOMAIN_CONFIGS` updated with calibrated sensitivity/specificity for all layers

### Notes

- v1 API (`computeDomainAwareScore`, `DomainConfig.threshold`) is fully backward-compatible

## [0.1.0] - 2024-02-25

### Added

- Initial release of the Sotto Open Verification Standard
- `classifyReference()` — classify a reference into ACADEMIC, NEWS, GOVERNMENT, or GENERAL domain
- `computeDomainAwareScore()` — compute a weighted verification score against a domain's threshold
- `DOMAIN_CONFIGS` — full domain configuration map with layers, weights, thresholds, and AI instructions
- TypeScript types: `ContentDomain`, `LayerId`, `LayerResult`, `LayerConfig`, `DomainConfig`
- Comprehensive test suite (classify, score, domains)
- Domain scoring formulas:
  - ACADEMIC: doi(0.45) + title_search(0.30) + url(0.10) + ai(0.15) ≥ 0.70
  - NEWS: url(0.35) + ai(0.65) ≥ 0.50
  - GOVERNMENT: url(0.40) + ai(0.60) ≥ 0.55
  - GENERAL: url(0.30) + title_search(0.10) + ai(0.60) ≥ 0.55

[0.1.0]: https://github.com/SottoFM/reference-verification-standard/releases/tag/v0.1.0
