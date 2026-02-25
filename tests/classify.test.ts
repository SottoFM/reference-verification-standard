import { describe, it, expect } from 'vitest';
import { classifyReference } from '../src/classify';

describe('classifyReference', () => {
  describe('DOI → always ACADEMIC', () => {
    it('classifies any reference with a DOI as ACADEMIC', () => {
      expect(classifyReference({ doi: '10.1234/example' })).toBe('ACADEMIC');
    });

    it('classifies DOI reference regardless of URL domain', () => {
      expect(classifyReference({ doi: '10.1234/x', url: 'https://nytimes.com/article' })).toBe('ACADEMIC');
    });

    it('classifies DOI reference regardless of type', () => {
      expect(classifyReference({ doi: '10.5678/news', type: 'ARTICLE' })).toBe('ACADEMIC');
    });
  });

  describe('URL pattern matching', () => {
    it('classifies arxiv.org URLs as ACADEMIC', () => {
      expect(classifyReference({ url: 'https://arxiv.org/abs/1706.03762' })).toBe('ACADEMIC');
    });

    it('classifies pubmed URLs as ACADEMIC', () => {
      expect(classifyReference({ url: 'https://pubmed.ncbi.nlm.nih.gov/12345678' })).toBe('ACADEMIC');
    });

    it('classifies nature.com URLs as ACADEMIC', () => {
      expect(classifyReference({ url: 'https://www.nature.com/articles/s41586-023-001' })).toBe('ACADEMIC');
    });

    it('classifies nytimes.com URLs as NEWS', () => {
      expect(classifyReference({ url: 'https://www.nytimes.com/2024/01/01/tech/ai.html' })).toBe('NEWS');
    });

    it('classifies reuters.com URLs as NEWS', () => {
      expect(classifyReference({ url: 'https://www.reuters.com/technology/ai-2024' })).toBe('NEWS');
    });

    it('classifies bbc.com URLs as NEWS', () => {
      expect(classifyReference({ url: 'https://www.bbc.com/news/technology-12345' })).toBe('NEWS');
    });

    it('classifies bbc.co.uk URLs as NEWS', () => {
      expect(classifyReference({ url: 'https://www.bbc.co.uk/news/science' })).toBe('NEWS');
    });

    it('classifies .gov URLs as GOVERNMENT', () => {
      expect(classifyReference({ url: 'https://www.cdc.gov/covid/data' })).toBe('GOVERNMENT');
    });

    it('classifies who.int URLs as GOVERNMENT', () => {
      expect(classifyReference({ url: 'https://www.who.int/news/item/01-01-2024' })).toBe('GOVERNMENT');
    });

    it('classifies worldbank.org URLs as GOVERNMENT', () => {
      expect(classifyReference({ url: 'https://www.worldbank.org/en/report' })).toBe('GOVERNMENT');
    });
  });

  describe('type-based fallback', () => {
    it('classifies PAPER type as ACADEMIC when no URL match', () => {
      expect(classifyReference({ type: 'PAPER', url: 'https://example.com/paper' })).toBe('ACADEMIC');
    });

    it('classifies BOOK type as ACADEMIC', () => {
      expect(classifyReference({ type: 'BOOK' })).toBe('ACADEMIC');
    });

    it('classifies ARTICLE type as NEWS (ARTICLE is in NEWS typePatterns)', () => {
      // ARTICLE is in NEWS typePatterns — type fallback correctly maps it to NEWS
      expect(classifyReference({ type: 'ARTICLE', url: 'https://randomblog.com' })).toBe('NEWS');
    });
  });

  describe('GENERAL fallback', () => {
    it('classifies unknown domains as GENERAL', () => {
      expect(classifyReference({ url: 'https://randomblog.com/post' })).toBe('GENERAL');
    });

    it('classifies references with no information as GENERAL', () => {
      expect(classifyReference({})).toBe('GENERAL');
    });

    it('classifies null values as GENERAL', () => {
      expect(classifyReference({ doi: null, url: null, type: null })).toBe('GENERAL');
    });
  });

  describe('priority ordering (ACADEMIC > NEWS > GOVERNMENT)', () => {
    it('prefers ACADEMIC URL pattern over NEWS type hint', () => {
      expect(classifyReference({ url: 'https://arxiv.org/abs/123', type: 'ARTICLE' })).toBe('ACADEMIC');
    });

    it('prefers NEWS URL pattern over GENERAL type hint', () => {
      expect(classifyReference({ url: 'https://apnews.com/article/123', type: 'WEB' })).toBe('NEWS');
    });
  });
});
