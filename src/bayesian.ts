import type { ContentDomain, LayerResult } from './types';
import { DOMAIN_CONFIGS } from './domains';

/**
 * Sigmoid function — maps log-odds back to probability space.
 * σ(x) = 1 / (1 + e^(-x))
 */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Compute the Bayesian posterior probability that a reference is real.
 *
 * Algorithm (log-odds updating):
 *
 *   prior_log_odds = ln(prior / (1 - prior))
 *
 *   For each applicable layer with confidence c ∈ [0, 1]:
 *     LR+ = sensitivity / (1 - specificity)   — how much a pass shifts belief toward real
 *     LR- = (1 - sensitivity) / specificity   — how much a fail shifts belief toward fake
 *     Δ   = c × ln(LR+) + (1 - c) × ln(LR-)
 *
 *   posterior = sigmoid(prior_log_odds + Σ Δ)
 *   verdict   = posterior >= bayesianThreshold ? 'VERIFIED' : 'FAILED'
 *
 * Layers absent from layerResults are treated as minimally informative (c = 0.5).
 * Note: Δ = 0 only when LR+ × LR- = 1 (i.e. sensitivity = 1 - specificity, zero
 * discriminative power). For calibrated layers, c = 0.5 still contributes a small
 * net shift — absent evidence is not the same as no evidence.
 *
 * @param domain       - The content domain (ACADEMIC | NEWS | GOVERNMENT | GENERAL)
 * @param layerResults - Results from each verification layer
 * @returns posterior probability, the verdict, and a per-layer breakdown
 */
export function computeBayesianScore(
  domain: ContentDomain,
  layerResults: LayerResult[],
): {
  posterior: number;
  verdict: 'VERIFIED' | 'FAILED';
  logOddsContributions: Record<string, number>;
} {
  const config = DOMAIN_CONFIGS[domain];
  const resultMap = new Map(layerResults.map((r) => [r.layerId, r]));

  const priorLogOdds = Math.log(config.prior / (1 - config.prior));
  let runningLogOdds = priorLogOdds;
  const contributions: Record<string, number> = {};

  for (const layer of config.layers) {
    const { sensitivity, specificity } = layer.bayesian;
    const lrPos = sensitivity / (1 - specificity);  // LR+
    const lrNeg = (1 - sensitivity) / specificity;  // LR-

    const result = resultMap.get(layer.id);
    const c = result?.confidence ?? 0.5; // absent → uninformative

    const delta = c * Math.log(lrPos) + (1 - c) * Math.log(lrNeg);
    contributions[layer.id] = delta;
    runningLogOdds += delta;
  }

  const posterior = sigmoid(runningLogOdds);
  return {
    posterior,
    verdict: posterior >= config.bayesianThreshold ? 'VERIFIED' : 'FAILED',
    logOddsContributions: contributions,
  };
}
