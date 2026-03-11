export type ContentDomain = 'ACADEMIC' | 'NEWS' | 'GOVERNMENT' | 'EDUCATIONAL' | 'GENERAL';

// Must match the layer IDs used in the verification pipeline
export type LayerId = 'doi' | 'title_search' | 'url' | 'ai';

export interface LayerResult {
  layerId: LayerId;
  passed: boolean;
  confidence: number; // 0.0–1.0
}

// ── Weighted-sum layer config (v1 scoring) ────────────────────────────────────

export interface LayerConfig {
  id: LayerId;
  weight: number;      // normalized among applicable layers, sums to 1.0
  description: string;
}

// ── Bayesian layer config (v2 scoring) ────────────────────────────────────────

/**
 * Sensitivity and specificity characterise each layer's diagnostic power.
 *
 * sensitivity  = P(layer passes | reference is real)
 * specificity  = P(layer fails  | reference is fake)
 *
 * These define two likelihood ratios:
 *   LR+ = sensitivity / (1 - specificity)   — evidence in favour of real
 *   LR- = (1 - sensitivity) / specificity   — evidence in favour of fake
 *
 * A continuous confidence c ∈ [0,1] contributes:
 *   Δ log-odds = c × ln(LR+) + (1-c) × ln(LR-)
 *
 * c = 1.0 → full positive evidence
 * c = 0.5 → uninformative (no update)
 * c = 0.0 → full negative evidence
 */
export interface LayerBayesianParams {
  sensitivity: number; // P(pass | real)  — 0.0–1.0
  specificity: number; // P(fail | fake)  — 0.0–1.0
}

export interface BayesianLayerConfig extends LayerConfig {
  bayesian: LayerBayesianParams;
}

// ── Domain config ─────────────────────────────────────────────────────────────

export interface DomainConfig {
  domain: ContentDomain;
  label: string;
  description: string;

  // v1: weighted-sum scoring
  layers: BayesianLayerConfig[];
  threshold: number;       // minimum weighted score to VERIFY (v1)

  // v2: Bayesian scoring
  /** P(reference is real | it belongs to this domain) — domain prior */
  prior: number;
  /** minimum posterior probability to VERIFY (v2) */
  bayesianThreshold: number;

  aiInstruction: string;
  urlPatterns?: RegExp[];
  typePatterns?: string[];
}

export interface VerificationPrinciple {
  id: string;
  title: string;
  description: string;
}
