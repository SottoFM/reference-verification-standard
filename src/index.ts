export type {
  ContentDomain,
  LayerId,
  LayerResult,
  LayerConfig,
  BayesianLayerConfig,
  LayerBayesianParams,
  DomainConfig,
  VerificationPrinciple,
} from './types';

export { DOMAIN_CONFIGS } from './domains';
export { classifyReference } from './classify';
export { computeDomainAwareScore } from './score';
export { computeBayesianScore } from './bayesian';
