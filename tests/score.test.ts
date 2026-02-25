import { describe, it, expect } from 'vitest';
import { computeDomainAwareScore } from '../src/score';

describe('computeDomainAwareScore', () => {
  describe('ACADEMIC domain', () => {
    it('verifies when doi + title_search are strong (score > 0.70)', () => {
      const { score, verdict } = computeDomainAwareScore('ACADEMIC', [
        { layerId: 'doi', passed: true, confidence: 0.95 },
        { layerId: 'title_search', passed: true, confidence: 0.9 },
        { layerId: 'url', passed: true, confidence: 0.6 },
        { layerId: 'ai', passed: true, confidence: 0.85 },
      ]);
      // 0.45*0.95 + 0.30*0.90 + 0.10*0.60 + 0.15*0.85 = 0.4275 + 0.27 + 0.06 + 0.1275 = 0.885
      expect(score).toBeCloseTo(0.885, 2);
      expect(verdict).toBe('VERIFIED');
    });

    it('fails when DOI check fails and no title match', () => {
      const { score, verdict } = computeDomainAwareScore('ACADEMIC', [
        { layerId: 'doi', passed: false, confidence: 0 },
        { layerId: 'title_search', passed: false, confidence: 0 },
        { layerId: 'url', passed: true, confidence: 0.6 },
        { layerId: 'ai', passed: false, confidence: 0 },
      ]);
      // 0.45*0 + 0.30*0 + 0.10*0.6 + 0.15*0 = 0.06
      expect(score).toBeCloseTo(0.06, 2);
      expect(verdict).toBe('FAILED');
    });

    it('handles missing layers (only partial results provided)', () => {
      const { score, verdict } = computeDomainAwareScore('ACADEMIC', [
        { layerId: 'doi', passed: true, confidence: 1.0 },
      ]);
      // Only doi contributes: 0.45 * 1.0 = 0.45 — below 0.70 threshold
      expect(score).toBeCloseTo(0.45, 2);
      expect(verdict).toBe('FAILED');
    });
  });

  describe('NEWS domain — the core fix', () => {
    it('verifies a live NYT article (URL 200 + credible AI)', () => {
      const { score, verdict } = computeDomainAwareScore('NEWS', [
        { layerId: 'url', passed: true, confidence: 0.6 },
        { layerId: 'ai', passed: true, confidence: 0.85 },
      ]);
      // 0.35*0.6 + 0.65*0.85 = 0.21 + 0.5525 = 0.7625
      expect(score).toBeCloseTo(0.7625, 3);
      expect(verdict).toBe('VERIFIED');
    });

    it('verifies a paywalled article (403 + credible AI) — paywall should not cause REMOVED', () => {
      const { score, verdict } = computeDomainAwareScore('NEWS', [
        { layerId: 'url', passed: false, confidence: 0 },
        { layerId: 'ai', passed: true, confidence: 0.85 },
      ]);
      // 0.35*0 + 0.65*0.85 = 0 + 0.5525 = 0.5525 > 0.50 threshold
      expect(score).toBeCloseTo(0.5525, 3);
      expect(verdict).toBe('VERIFIED');
    });

    it('fails a fabricated news article (AI rejects + dead URL)', () => {
      const { score, verdict } = computeDomainAwareScore('NEWS', [
        { layerId: 'url', passed: false, confidence: 0 },
        { layerId: 'ai', passed: false, confidence: 0 },
      ]);
      expect(score).toBeCloseTo(0, 2);
      expect(verdict).toBe('FAILED');
    });

    it('ignores irrelevant layers (doi, title_search) for NEWS', () => {
      // Even if doi/title_search are passed, they should contribute nothing to NEWS score
      const withExtra = computeDomainAwareScore('NEWS', [
        { layerId: 'url', passed: true, confidence: 0.6 },
        { layerId: 'ai', passed: true, confidence: 0.85 },
        { layerId: 'doi', passed: true, confidence: 1.0 },
        { layerId: 'title_search', passed: true, confidence: 1.0 },
      ]);
      const withoutExtra = computeDomainAwareScore('NEWS', [
        { layerId: 'url', passed: true, confidence: 0.6 },
        { layerId: 'ai', passed: true, confidence: 0.85 },
      ]);
      expect(withExtra.score).toBeCloseTo(withoutExtra.score, 5);
    });
  });

  describe('GOVERNMENT domain', () => {
    it('verifies an official CDC page', () => {
      const { score, verdict } = computeDomainAwareScore('GOVERNMENT', [
        { layerId: 'url', passed: true, confidence: 1.0 },
        { layerId: 'ai', passed: true, confidence: 0.85 },
      ]);
      // 0.40*1.0 + 0.60*0.85 = 0.40 + 0.51 = 0.91
      expect(score).toBeCloseTo(0.91, 2);
      expect(verdict).toBe('VERIFIED');
    });

    it('fails when URL does not resolve and AI is uncertain', () => {
      const { score, verdict } = computeDomainAwareScore('GOVERNMENT', [
        { layerId: 'url', passed: false, confidence: 0 },
        { layerId: 'ai', passed: false, confidence: 0.3 },
      ]);
      // 0.40*0 + 0.60*0.3 = 0.18 < 0.55
      expect(score).toBeCloseTo(0.18, 2);
      expect(verdict).toBe('FAILED');
    });
  });

  describe('GENERAL domain', () => {
    it('verifies a Wikipedia article (URL + AI credible)', () => {
      const { score, verdict } = computeDomainAwareScore('GENERAL', [
        { layerId: 'url', passed: true, confidence: 0.8 },
        { layerId: 'title_search', passed: false, confidence: 0 },
        { layerId: 'ai', passed: true, confidence: 0.85 },
      ]);
      // 0.30*0.8 + 0.10*0 + 0.60*0.85 = 0.24 + 0 + 0.51 = 0.75
      expect(score).toBeCloseTo(0.75, 2);
      expect(verdict).toBe('VERIFIED');
    });

    it('fails an anonymous unverifiable blog post', () => {
      const { score, verdict } = computeDomainAwareScore('GENERAL', [
        { layerId: 'url', passed: true, confidence: 0.4 },
        { layerId: 'title_search', passed: false, confidence: 0 },
        { layerId: 'ai', passed: false, confidence: 0 },
      ]);
      // 0.30*0.4 + 0 + 0 = 0.12 < 0.55
      expect(score).toBeCloseTo(0.12, 2);
      expect(verdict).toBe('FAILED');
    });
  });

  describe('edge cases', () => {
    it('returns score 0 and FAILED for empty layer results', () => {
      const { score, verdict } = computeDomainAwareScore('NEWS', []);
      expect(score).toBe(0);
      expect(verdict).toBe('FAILED');
    });

    it('score never exceeds sum of all weights (≤ 1.0)', () => {
      for (const domain of ['ACADEMIC', 'NEWS', 'GOVERNMENT', 'GENERAL'] as const) {
        const { score } = computeDomainAwareScore(domain, [
          { layerId: 'doi', passed: true, confidence: 1.0 },
          { layerId: 'title_search', passed: true, confidence: 1.0 },
          { layerId: 'url', passed: true, confidence: 1.0 },
          { layerId: 'ai', passed: true, confidence: 1.0 },
        ]);
        expect(score).toBeLessThanOrEqual(1.0 + 1e-10);
      }
    });
  });
});
