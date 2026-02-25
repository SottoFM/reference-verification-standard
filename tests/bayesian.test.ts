import { describe, it, expect } from 'vitest';
import { computeBayesianScore } from '../src/bayesian';
import { DOMAIN_CONFIGS } from '../src/domains';

describe('computeBayesianScore', () => {
  describe('return shape', () => {
    it('returns posterior, verdict, and logOddsContributions', () => {
      const result = computeBayesianScore('NEWS', [
        { layerId: 'url', passed: true, confidence: 0.6 },
        { layerId: 'ai', passed: true, confidence: 0.85 },
      ]);
      expect(result).toHaveProperty('posterior');
      expect(result).toHaveProperty('verdict');
      expect(result).toHaveProperty('logOddsContributions');
    });

    it('posterior is in (0, 1)', () => {
      const { posterior } = computeBayesianScore('ACADEMIC', [
        { layerId: 'doi', passed: true, confidence: 0.95 },
        { layerId: 'title_search', passed: true, confidence: 0.9 },
        { layerId: 'url', passed: true, confidence: 0.6 },
        { layerId: 'ai', passed: true, confidence: 0.85 },
      ]);
      expect(posterior).toBeGreaterThan(0);
      expect(posterior).toBeLessThan(1);
    });
  });

  describe('ACADEMIC domain', () => {
    it('verifies a real paper with strong DOI + title match', () => {
      const { posterior, verdict } = computeBayesianScore('ACADEMIC', [
        { layerId: 'doi', passed: true, confidence: 0.95 },
        { layerId: 'title_search', passed: true, confidence: 0.9 },
        { layerId: 'url', passed: true, confidence: 0.6 },
        { layerId: 'ai', passed: true, confidence: 0.85 },
      ]);
      expect(posterior).toBeGreaterThan(DOMAIN_CONFIGS.ACADEMIC.bayesianThreshold);
      expect(verdict).toBe('VERIFIED');
    });

    it('fails a fake paper with no DOI and no title match', () => {
      const { posterior, verdict } = computeBayesianScore('ACADEMIC', [
        { layerId: 'doi', passed: false, confidence: 0 },
        { layerId: 'title_search', passed: false, confidence: 0 },
        { layerId: 'url', passed: false, confidence: 0 },
        { layerId: 'ai', passed: false, confidence: 0 },
      ]);
      expect(posterior).toBeLessThan(DOMAIN_CONFIGS.ACADEMIC.bayesianThreshold);
      expect(verdict).toBe('FAILED');
    });
  });

  describe('NEWS domain — the core fix', () => {
    it('verifies a live credible news article (URL 200 + strong AI)', () => {
      const { posterior, verdict } = computeBayesianScore('NEWS', [
        { layerId: 'url', passed: true, confidence: 0.8 },
        { layerId: 'ai', passed: true, confidence: 0.9 },
      ]);
      expect(posterior).toBeGreaterThan(DOMAIN_CONFIGS.NEWS.bayesianThreshold);
      expect(verdict).toBe('VERIFIED');
    });

    it('verifies a paywalled article via AI alone (403 + credible AI)', () => {
      // This is the key paywall case: URL fails but AI alone should be enough for a credible outlet.
      const { posterior, verdict } = computeBayesianScore('NEWS', [
        { layerId: 'url', passed: false, confidence: 0 },
        { layerId: 'ai', passed: true, confidence: 0.85 },
      ]);
      // NEWS prior=0.75 is generous; strong AI alone pushes posterior above 0.65 threshold
      expect(posterior).toBeGreaterThan(DOMAIN_CONFIGS.NEWS.bayesianThreshold);
      expect(verdict).toBe('VERIFIED');
    });

    it('fails a fabricated article (dead URL + AI rejection)', () => {
      const { posterior, verdict } = computeBayesianScore('NEWS', [
        { layerId: 'url', passed: false, confidence: 0 },
        { layerId: 'ai', passed: false, confidence: 0 },
      ]);
      expect(posterior).toBeLessThan(DOMAIN_CONFIGS.NEWS.bayesianThreshold);
      expect(verdict).toBe('FAILED');
    });
  });

  describe('GOVERNMENT domain', () => {
    it('verifies an official CDC page with URL + AI', () => {
      const { posterior, verdict } = computeBayesianScore('GOVERNMENT', [
        { layerId: 'url', passed: true, confidence: 1.0 },
        { layerId: 'ai', passed: true, confidence: 0.9 },
      ]);
      expect(posterior).toBeGreaterThan(DOMAIN_CONFIGS.GOVERNMENT.bayesianThreshold);
      expect(verdict).toBe('VERIFIED');
    });

    it('fails when URL is dead and AI is skeptical', () => {
      const { posterior, verdict } = computeBayesianScore('GOVERNMENT', [
        { layerId: 'url', passed: false, confidence: 0 },
        { layerId: 'ai', passed: false, confidence: 0.2 },
      ]);
      expect(posterior).toBeLessThan(DOMAIN_CONFIGS.GOVERNMENT.bayesianThreshold);
      expect(verdict).toBe('FAILED');
    });
  });

  describe('GENERAL domain', () => {
    it('verifies a credible Wikipedia article', () => {
      const { posterior, verdict } = computeBayesianScore('GENERAL', [
        { layerId: 'url', passed: true, confidence: 0.9 },
        { layerId: 'ai', passed: true, confidence: 0.85 },
      ]);
      expect(posterior).toBeGreaterThan(DOMAIN_CONFIGS.GENERAL.bayesianThreshold);
      expect(verdict).toBe('VERIFIED');
    });

    it('fails an anonymous unverifiable blog post', () => {
      const { posterior, verdict } = computeBayesianScore('GENERAL', [
        { layerId: 'url', passed: true, confidence: 0.4 },
        { layerId: 'ai', passed: false, confidence: 0.1 },
      ]);
      // Low prior (0.45) + negative AI evidence pushes posterior below 0.68 threshold
      expect(posterior).toBeLessThan(DOMAIN_CONFIGS.GENERAL.bayesianThreshold);
      expect(verdict).toBe('FAILED');
    });
  });

  describe('uninformative layers', () => {
    it('absent layers produce the same result as explicit c=0.5 inputs', () => {
      // Missing layers default to c=0.5 — identical to passing them explicitly.
      // Note: c=0.5 is only truly zero-update when sensitivity === 1-specificity.
      // With our actual params (LR+ ≠ LR-^-1), there is still a net shift — but both
      // representations should agree.
      const withExplicit = computeBayesianScore('NEWS', [
        { layerId: 'url', passed: true, confidence: 0.5 },
        { layerId: 'ai', passed: true, confidence: 0.5 },
      ]);
      const withMissing = computeBayesianScore('NEWS', []);
      expect(withMissing.posterior).toBeCloseTo(withExplicit.posterior, 8);
      expect(withMissing.verdict).toBe(withExplicit.verdict);
    });

    it('strong positive evidence raises posterior above c=0.5 baseline', () => {
      const baseline = computeBayesianScore('NEWS', []);
      const { posterior } = computeBayesianScore('NEWS', [
        { layerId: 'ai', passed: true, confidence: 0.95 },
      ]);
      expect(posterior).toBeGreaterThan(baseline.posterior);
    });

    it('strong negative evidence lowers posterior below c=0.5 baseline', () => {
      const baseline = computeBayesianScore('NEWS', []);
      const { posterior } = computeBayesianScore('NEWS', [
        { layerId: 'ai', passed: false, confidence: 0 },
      ]);
      expect(posterior).toBeLessThan(baseline.posterior);
    });
  });

  describe('logOddsContributions', () => {
    it('positive evidence produces a positive log-odds contribution', () => {
      const { logOddsContributions } = computeBayesianScore('ACADEMIC', [
        { layerId: 'doi', passed: true, confidence: 1.0 },
      ]);
      expect(logOddsContributions.doi).toBeGreaterThan(0);
    });

    it('negative evidence produces a negative log-odds contribution', () => {
      const { logOddsContributions } = computeBayesianScore('ACADEMIC', [
        { layerId: 'doi', passed: false, confidence: 0 },
      ]);
      expect(logOddsContributions.doi).toBeLessThan(0);
    });

    it('reports contributions for all domain layers', () => {
      const { logOddsContributions } = computeBayesianScore('ACADEMIC', [
        { layerId: 'doi', passed: true, confidence: 0.9 },
      ]);
      expect(logOddsContributions).toHaveProperty('doi');
      expect(logOddsContributions).toHaveProperty('title_search');
      expect(logOddsContributions).toHaveProperty('url');
      expect(logOddsContributions).toHaveProperty('ai');
    });
  });
});
