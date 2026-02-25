import type { ContentDomain, DomainConfig } from './types';

export const DOMAIN_CONFIGS: Record<ContentDomain, DomainConfig> = {
  ACADEMIC: {
    domain: 'ACADEMIC',
    label: 'Academic',
    description: 'Peer-reviewed papers, preprints, books, technical reports',
    layers: [
      {
        id: 'doi',
        weight: 0.45,
        description: 'DOI registered in CrossRef',
        // High sensitivity: real papers almost always have a DOI that resolves.
        // High specificity: fake papers rarely have a valid registered DOI.
        bayesian: { sensitivity: 0.92, specificity: 0.97 },
      },
      {
        id: 'title_search',
        weight: 0.30,
        description: 'Indexed in OpenAlex / title search',
        // Good sensitivity: most real papers are indexed; lower than DOI (preprints may lag).
        // Good specificity: fabricated titles rarely appear in academic indexes.
        bayesian: { sensitivity: 0.80, specificity: 0.88 },
      },
      {
        id: 'url',
        weight: 0.10,
        description: 'URL resolves (journal site, arXiv, etc.)',
        // Moderate: URLs break or redirect; paywalls return 403 for real papers.
        bayesian: { sensitivity: 0.70, specificity: 0.72 },
      },
      {
        id: 'ai',
        weight: 0.15,
        description: 'AI claim-support evaluation',
        // AI has good but not perfect recall for academic content.
        bayesian: { sensitivity: 0.78, specificity: 0.82 },
      },
    ],
    threshold: 0.70,
    // Prior: academic references are usually genuine; fabricated papers are uncommon.
    prior: 0.72,
    bayesianThreshold: 0.82,
    aiInstruction:
      'Verify the reference is a real academic work (paper, book, report) and that the cited claim is supported by it. Err toward REAL for indexed works.',
    typePatterns: ['PAPER', 'BOOK', 'REPORT'],
    urlPatterns: [
      /\bdoi\.org\b/,
      /\barxiv\.org\b/,
      /\bncbi\.nlm\.nih\.gov\b/,
      /\bpubmed\b/,
      /\bsciencedirect\b/,
      /\bspringer\b/,
      /\bnature\.com\b/,
      /\bjstor\.org\b/,
      /\bieee\.org\b/,
    ],
  },
  NEWS: {
    domain: 'NEWS',
    label: 'News',
    description: 'News articles from established outlets (NYT, Reuters, BBC, etc.)',
    layers: [
      {
        id: 'url',
        weight: 0.35,
        description: 'URL resolves to a live news article (403 from known outlets = partial credit)',
        // Many real articles 403/paywall; low sensitivity. Fake URLs rarely resolve at all.
        bayesian: { sensitivity: 0.55, specificity: 0.85 },
      },
      {
        id: 'ai',
        weight: 0.65,
        description: 'AI confirms outlet credibility + claim support',
        // AI is the primary signal for news: can verify outlet + plausibility of claim.
        bayesian: { sensitivity: 0.82, specificity: 0.80 },
      },
    ],
    // Threshold 0.50: AI alone (0.65 × 0.85 = 0.5525) clears this for credible outlets behind paywalls.
    threshold: 0.50,
    // Prior: news references from known outlets are usually real, but hallucination risk is moderate.
    prior: 0.75,
    bayesianThreshold: 0.65,
    aiInstruction:
      'Verify this is from a credible news outlet (established newspapers, wire services, broadcasters) and that the cited claim appears in the article. DOI and academic indexing are NOT expected for news. Err toward REAL for known reputable outlets like NYT, Reuters, BBC, AP, Washington Post, Guardian, WSJ, Bloomberg, FT, NPR.',
    typePatterns: ['ARTICLE', 'WEB'],
    urlPatterns: [
      /\bnytimes\.com\b/,
      /\bwashingtonpost\.com\b/,
      /\btheguardian\.com\b/,
      /\breuters\.com\b/,
      /\bapnews\.com\b/,
      /\bbbc\.(com|co\.uk)\b/,
      /\bnpr\.org\b/,
      /\bwsj\.com\b/,
      /\bbloomberg\.com\b/,
      /\bft\.com\b/,
      /\bpolitico\.com\b/,
      /\btheatlantic\.com\b/,
    ],
  },
  GOVERNMENT: {
    domain: 'GOVERNMENT',
    label: 'Government',
    description: 'Official government reports, legislation, statistics',
    layers: [
      {
        id: 'url',
        weight: 0.40,
        description: 'URL resolves to an official government domain',
        // Government URLs are stable and strongly indicative of authenticity.
        bayesian: { sensitivity: 0.85, specificity: 0.93 },
      },
      {
        id: 'ai',
        weight: 0.60,
        description: 'AI verifies official source + claim support',
        // AI can verify agency name, document type, and claim plausibility.
        bayesian: { sensitivity: 0.80, specificity: 0.84 },
      },
    ],
    threshold: 0.55,
    // Prior: government sources are highly credible; fabrication risk is low.
    prior: 0.82,
    bayesianThreshold: 0.72,
    aiInstruction:
      'Verify this is from an official government or intergovernmental source (agency websites, .gov, .gov.uk, UN, WHO, etc.) and that the cited claim is supported by the document. Err toward REAL for official government URLs.',
    typePatterns: ['REPORT', 'WEB'],
    urlPatterns: [
      /\.gov\b/,
      /\.gov\.\w{2}\b/,
      /\bwho\.int\b/,
      /\bun\.org\b/,
      /\boecd\.org\b/,
      /\bworldbank\.org\b/,
      /\bimf\.org\b/,
      /\bcdc\.gov\b/,
    ],
  },
  GENERAL: {
    domain: 'GENERAL',
    label: 'General',
    description: 'Blog posts, podcasts, videos, and other web content',
    layers: [
      {
        id: 'url',
        weight: 0.30,
        description: 'URL resolves',
        // General URLs are easy to fabricate; moderate signal.
        bayesian: { sensitivity: 0.65, specificity: 0.70 },
      },
      {
        id: 'title_search',
        weight: 0.10,
        description: 'May be indexed in OpenAlex / title search',
        // Low sensitivity (most web content is not indexed in academic search).
        bayesian: { sensitivity: 0.30, specificity: 0.75 },
      },
      {
        id: 'ai',
        weight: 0.60,
        description: 'AI evaluates source credibility + claim support',
        // AI bears most of the weight; apply high scrutiny for anonymous/blog sources.
        bayesian: { sensitivity: 0.72, specificity: 0.78 },
      },
    ],
    threshold: 0.55,
    // Prior: catch-all domain — higher fabrication risk than structured domains.
    prior: 0.45,
    bayesianThreshold: 0.68,
    aiInstruction:
      'Verify the source exists and the cited claim is supported. Apply high scrutiny to blogs, social media, and anonymous sources. Err toward REJECTION for unverifiable anonymous sources.',
    typePatterns: ['WEB', 'VIDEO', 'ARTICLE'],
  },
};
