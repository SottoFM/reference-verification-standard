import { describe, it, expect } from 'vitest';
import { DOMAIN_CONFIGS } from '../src/domains';

describe('DOMAIN_CONFIGS', () => {
  it('defines all four required domains', () => {
    expect(DOMAIN_CONFIGS).toHaveProperty('ACADEMIC');
    expect(DOMAIN_CONFIGS).toHaveProperty('NEWS');
    expect(DOMAIN_CONFIGS).toHaveProperty('GOVERNMENT');
    expect(DOMAIN_CONFIGS).toHaveProperty('GENERAL');
  });

  describe('layer weights sum to 1.0 per domain', () => {
    for (const [domain, config] of Object.entries(DOMAIN_CONFIGS)) {
      it(`${domain} layer weights sum to 1.0`, () => {
        const total = config.layers.reduce((sum, l) => sum + l.weight, 0);
        expect(total).toBeCloseTo(1.0, 5);
      });
    }
  });

  describe('thresholds are in valid range', () => {
    for (const [domain, config] of Object.entries(DOMAIN_CONFIGS)) {
      it(`${domain} threshold is between 0 and 1`, () => {
        expect(config.threshold).toBeGreaterThan(0);
        expect(config.threshold).toBeLessThanOrEqual(1);
      });
    }
  });

  describe('NEWS domain — lower threshold to handle paywalls', () => {
    it('NEWS threshold is 0.50 (not 0.65+)', () => {
      expect(DOMAIN_CONFIGS.NEWS.threshold).toBe(0.50);
    });

    it('NEWS layers do not include doi or title_search', () => {
      const layerIds = DOMAIN_CONFIGS.NEWS.layers.map((l) => l.id);
      expect(layerIds).not.toContain('doi');
      expect(layerIds).not.toContain('title_search');
    });

    it('NEWS ai layer carries majority weight (≥ 0.60)', () => {
      const aiLayer = DOMAIN_CONFIGS.NEWS.layers.find((l) => l.id === 'ai');
      expect(aiLayer?.weight).toBeGreaterThanOrEqual(0.60);
    });
  });

  describe('ACADEMIC domain — strictest standard', () => {
    it('ACADEMIC threshold is the highest at 0.70', () => {
      const thresholds = Object.values(DOMAIN_CONFIGS).map((c) => c.threshold);
      expect(DOMAIN_CONFIGS.ACADEMIC.threshold).toBe(Math.max(...thresholds));
    });

    it('ACADEMIC includes doi layer', () => {
      const layerIds = DOMAIN_CONFIGS.ACADEMIC.layers.map((l) => l.id);
      expect(layerIds).toContain('doi');
    });

    it('ACADEMIC doi layer carries the highest weight', () => {
      const doiLayer = DOMAIN_CONFIGS.ACADEMIC.layers.find((l) => l.id === 'doi');
      const maxWeight = Math.max(...DOMAIN_CONFIGS.ACADEMIC.layers.map((l) => l.weight));
      expect(doiLayer?.weight).toBe(maxWeight);
    });
  });

  describe('aiInstruction', () => {
    for (const [domain, config] of Object.entries(DOMAIN_CONFIGS)) {
      it(`${domain} has a non-empty aiInstruction`, () => {
        expect(config.aiInstruction).toBeTruthy();
        expect(config.aiInstruction.length).toBeGreaterThan(20);
      });
    }

    it('NEWS aiInstruction mentions credible outlets', () => {
      expect(DOMAIN_CONFIGS.NEWS.aiInstruction.toLowerCase()).toMatch(/nyt|reuters|bbc/i);
    });

    it('GENERAL aiInstruction applies high scrutiny to anonymous sources', () => {
      expect(DOMAIN_CONFIGS.GENERAL.aiInstruction.toLowerCase()).toMatch(/scrutin|anonymous|rejection/i);
    });
  });
});
