import { describe, it, expect } from 'vitest';
import { classifyReference } from '../src/classify';
import { computeDomainAwareScore } from '../src/score';
import { computeBayesianScore } from '../src/bayesian';
import { DOMAIN_CONFIGS } from '../src/domains';
import type { ContentDomain, LayerResult } from '../src/types';

/**
 * End-to-end integration tests: classify → score/bayesian pipeline.
 * Verifies that both scoring systems agree on clear-cut cases and
 * that the full classify → verify flow produces sensible results.
 */
describe('integration: classify → score → bayesian', () => {
  describe('v1 and v2 agree on clear-cut verified cases', () => {
    const clearVerified: Array<{ label: string; domain: ContentDomain; layers: LayerResult[] }> = [
      {
        label: 'strong academic paper (DOI + title + URL + AI)',
        domain: 'ACADEMIC',
        layers: [
          { layerId: 'doi', passed: true, confidence: 0.95 },
          { layerId: 'title_search', passed: true, confidence: 0.9 },
          { layerId: 'url', passed: true, confidence: 0.8 },
          { layerId: 'ai', passed: true, confidence: 0.9 },
        ],
      },
      {
        label: 'credible news article (URL + AI)',
        domain: 'NEWS',
        layers: [
          { layerId: 'url', passed: true, confidence: 0.8 },
          { layerId: 'ai', passed: true, confidence: 0.9 },
        ],
      },
      {
        label: 'official government page (URL + AI)',
        domain: 'GOVERNMENT',
        layers: [
          { layerId: 'url', passed: true, confidence: 1.0 },
          { layerId: 'ai', passed: true, confidence: 0.9 },
        ],
      },
      {
        label: 'educational platform (URL + AI)',
        domain: 'EDUCATIONAL',
        layers: [
          { layerId: 'url', passed: true, confidence: 0.9 },
          { layerId: 'ai', passed: true, confidence: 0.85 },
        ],
      },
    ];

    for (const { label, domain, layers } of clearVerified) {
      it(`both systems VERIFY: ${label}`, () => {
        const v1 = computeDomainAwareScore(domain, layers);
        const v2 = computeBayesianScore(domain, layers);
        expect(v1.verdict).toBe('VERIFIED');
        expect(v2.verdict).toBe('VERIFIED');
      });
    }
  });

  describe('v1 and v2 agree on clear-cut failed cases', () => {
    const clearFailed: Array<{ label: string; domain: ContentDomain; layers: LayerResult[] }> = [
      {
        label: 'fabricated paper (all layers fail)',
        domain: 'ACADEMIC',
        layers: [
          { layerId: 'doi', passed: false, confidence: 0 },
          { layerId: 'title_search', passed: false, confidence: 0 },
          { layerId: 'url', passed: false, confidence: 0 },
          { layerId: 'ai', passed: false, confidence: 0 },
        ],
      },
      {
        label: 'fabricated news (all layers fail)',
        domain: 'NEWS',
        layers: [
          { layerId: 'url', passed: false, confidence: 0 },
          { layerId: 'ai', passed: false, confidence: 0 },
        ],
      },
      {
        label: 'fake government source (all layers fail)',
        domain: 'GOVERNMENT',
        layers: [
          { layerId: 'url', passed: false, confidence: 0 },
          { layerId: 'ai', passed: false, confidence: 0 },
        ],
      },
      {
        label: 'unverifiable blog post (weak URL, AI rejects)',
        domain: 'GENERAL',
        layers: [
          { layerId: 'url', passed: true, confidence: 0.3 },
          { layerId: 'ai', passed: false, confidence: 0 },
        ],
      },
    ];

    for (const { label, domain, layers } of clearFailed) {
      it(`both systems FAIL: ${label}`, () => {
        const v1 = computeDomainAwareScore(domain, layers);
        const v2 = computeBayesianScore(domain, layers);
        expect(v1.verdict).toBe('FAILED');
        expect(v2.verdict).toBe('FAILED');
      });
    }
  });

  describe('classify → score end-to-end scenarios', () => {
    it('arxiv paper: classified as ACADEMIC, verified by both systems', () => {
      const domain = classifyReference({ url: 'https://arxiv.org/abs/2301.00001', doi: '10.48550/arXiv.2301.00001' });
      expect(domain).toBe('ACADEMIC');

      const layers: LayerResult[] = [
        { layerId: 'doi', passed: true, confidence: 0.95 },
        { layerId: 'title_search', passed: true, confidence: 0.85 },
        { layerId: 'url', passed: true, confidence: 0.9 },
        { layerId: 'ai', passed: true, confidence: 0.88 },
      ];

      expect(computeDomainAwareScore(domain, layers).verdict).toBe('VERIFIED');
      expect(computeBayesianScore(domain, layers).verdict).toBe('VERIFIED');
    });

    it('NYT article: classified as NEWS, verified with paywall (URL fails, AI passes)', () => {
      const domain = classifyReference({ url: 'https://www.nytimes.com/2024/01/15/technology/ai-regulation.html' });
      expect(domain).toBe('NEWS');

      const layers: LayerResult[] = [
        { layerId: 'url', passed: false, confidence: 0 },
        { layerId: 'ai', passed: true, confidence: 0.85 },
      ];

      expect(computeDomainAwareScore(domain, layers).verdict).toBe('VERIFIED');
      expect(computeBayesianScore(domain, layers).verdict).toBe('VERIFIED');
    });

    it('CDC page: classified as GOVERNMENT, verified with strong URL + AI', () => {
      const domain = classifyReference({ url: 'https://www.cdc.gov/flu/about/keyfacts.htm' });
      expect(domain).toBe('GOVERNMENT');

      const layers: LayerResult[] = [
        { layerId: 'url', passed: true, confidence: 1.0 },
        { layerId: 'ai', passed: true, confidence: 0.9 },
      ];

      expect(computeDomainAwareScore(domain, layers).verdict).toBe('VERIFIED');
      expect(computeBayesianScore(domain, layers).verdict).toBe('VERIFIED');
    });

    it('random blog: classified as GENERAL, fails with weak evidence', () => {
      const domain = classifyReference({ url: 'https://some-random-blog.com/my-hot-take' });
      expect(domain).toBe('GENERAL');

      const layers: LayerResult[] = [
        { layerId: 'url', passed: true, confidence: 0.4 },
        { layerId: 'ai', passed: false, confidence: 0.15 },
      ];

      expect(computeDomainAwareScore(domain, layers).verdict).toBe('FAILED');
      expect(computeBayesianScore(domain, layers).verdict).toBe('FAILED');
    });

    it('Khan Academy: classified as EDUCATIONAL, verified with URL + AI', () => {
      const domain = classifyReference({ url: 'https://www.khanacademy.org/math/algebra/quadratics' });
      expect(domain).toBe('EDUCATIONAL');

      const layers: LayerResult[] = [
        { layerId: 'url', passed: true, confidence: 0.9 },
        { layerId: 'ai', passed: true, confidence: 0.85 },
      ];

      expect(computeDomainAwareScore(domain, layers).verdict).toBe('VERIFIED');
      expect(computeBayesianScore(domain, layers).verdict).toBe('VERIFIED');
    });
  });

  describe('all domains have consistent config', () => {
    const allDomains: ContentDomain[] = ['ACADEMIC', 'NEWS', 'GOVERNMENT', 'EDUCATIONAL', 'GENERAL'];

    it('every domain exported from DOMAIN_CONFIGS is testable with both scoring systems', () => {
      for (const domain of allDomains) {
        expect(DOMAIN_CONFIGS).toHaveProperty(domain);

        // Both scoring functions accept all domains without throwing
        const layers: LayerResult[] = [
          { layerId: 'url', passed: true, confidence: 0.5 },
          { layerId: 'ai', passed: true, confidence: 0.5 },
        ];
        expect(() => computeDomainAwareScore(domain, layers)).not.toThrow();
        expect(() => computeBayesianScore(domain, layers)).not.toThrow();
      }
    });

    it('perfect evidence verifies in both systems for every domain', () => {
      for (const domain of allDomains) {
        const layers: LayerResult[] = [
          { layerId: 'doi', passed: true, confidence: 1.0 },
          { layerId: 'title_search', passed: true, confidence: 1.0 },
          { layerId: 'url', passed: true, confidence: 1.0 },
          { layerId: 'ai', passed: true, confidence: 1.0 },
        ];
        const v1 = computeDomainAwareScore(domain, layers);
        const v2 = computeBayesianScore(domain, layers);
        expect(v1.verdict).toBe('VERIFIED');
        expect(v2.verdict).toBe('VERIFIED');
      }
    });

    it('zero evidence fails in both systems for every domain', () => {
      for (const domain of allDomains) {
        const layers: LayerResult[] = [
          { layerId: 'doi', passed: false, confidence: 0 },
          { layerId: 'title_search', passed: false, confidence: 0 },
          { layerId: 'url', passed: false, confidence: 0 },
          { layerId: 'ai', passed: false, confidence: 0 },
        ];
        const v1 = computeDomainAwareScore(domain, layers);
        const v2 = computeBayesianScore(domain, layers);
        expect(v1.verdict).toBe('FAILED');
        expect(v2.verdict).toBe('FAILED');
      }
    });
  });
});
