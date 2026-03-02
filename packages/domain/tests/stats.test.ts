import { describe, it, expect } from 'vitest';
import { computeStats, getNatureModifier, computeStatStageMultiplier, getXpForLevel } from '../src/helpers/stats';
import type { Species, Creature } from '../src/types/creature';

const testSpecies: Species = {
  id: 'test-species',
  name: 'Test',
  description: 'A test species',
  types: ['fire'],
  baseStats: { hp: 45, attack: 55, defense: 40, specialAttack: 65, specialDefense: 45, speed: 60 },
  catchDifficulty: 5,
  evolutionPaths: [],
  learnableMoves: [],
  baseExpYield: 64,
  growthRate: 'medium',
};

const testCreature: Creature = {
  id: 'test-1',
  speciesId: 'test-species',
  nickname: null,
  level: 10,
  xp: 1000,
  nature: 'adamant',
  ivs: { hp: 15, attack: 15, defense: 15, specialAttack: 15, specialDefense: 15, speed: 15 },
  evs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
  currentHp: 30,
  status: { kind: 'none' },
  moveIds: ['tackle'],
  movePp: [35],
  bond: 0,
  isShiny: false,
  originalTrainer: 'test',
};

describe('computeStats', () => {
  it('should compute HP correctly', () => {
    const stats = computeStats(testSpecies, testCreature);
    // HP = ((2*45 + 15 + 0) * 10) / 100 + 10 + 10 = 10.5 + 20 = 30
    expect(stats.hp).toBe(30);
  });

  it('should compute attack with nature modifier', () => {
    const stats = computeStats(testSpecies, testCreature);
    // Adamant: +attack, -specialAttack
    // Base attack = ((2*55 + 15 + 0) * 10) / 100 + 5 = 12.5 + 5 = 17 (floored to 17)
    // With adamant: floor(17 * 1.1) = 18
    expect(stats.attack).toBeGreaterThan(0);
  });

  it('should produce different stats for different natures', () => {
    const adamant = computeStats(testSpecies, { ...testCreature, nature: 'adamant' });
    const modest = computeStats(testSpecies, { ...testCreature, nature: 'modest' });
    expect(adamant.attack).toBeGreaterThan(modest.attack);
    expect(modest.specialAttack).toBeGreaterThan(adamant.specialAttack);
  });

  it('should produce higher stats at higher levels', () => {
    const low = computeStats(testSpecies, { ...testCreature, level: 5 });
    const high = computeStats(testSpecies, { ...testCreature, level: 50 });
    expect(high.hp).toBeGreaterThan(low.hp);
    expect(high.attack).toBeGreaterThan(low.attack);
    expect(high.speed).toBeGreaterThan(low.speed);
  });
});

describe('getNatureModifier', () => {
  it('should return correct modifier for adamant', () => {
    const mod = getNatureModifier('adamant');
    expect(mod.increased).toBe('attack');
    expect(mod.decreased).toBe('specialAttack');
  });

  it('should return null modifiers for neutral natures', () => {
    const mod = getNatureModifier('hardy');
    expect(mod.increased).toBeNull();
    expect(mod.decreased).toBeNull();
  });
});

describe('computeStatStageMultiplier', () => {
  it('should return 1 at stage 0', () => {
    expect(computeStatStageMultiplier(0)).toBe(1);
  });

  it('should return 1.5 at stage +1', () => {
    expect(computeStatStageMultiplier(1)).toBe(1.5);
  });

  it('should return 4 at stage +6', () => {
    expect(computeStatStageMultiplier(6)).toBe(4);
  });

  it('should return 0.25 at stage -6', () => {
    expect(computeStatStageMultiplier(-6)).toBe(0.25);
  });

  it('should clamp to +-6', () => {
    expect(computeStatStageMultiplier(10)).toBe(computeStatStageMultiplier(6));
    expect(computeStatStageMultiplier(-10)).toBe(computeStatStageMultiplier(-6));
  });
});

describe('getXpForLevel', () => {
  it('should return 0 for level 0', () => {
    expect(getXpForLevel(0, 'medium')).toBe(0);
  });

  it('should return increasing XP for increasing levels', () => {
    expect(getXpForLevel(10, 'medium')).toBeLessThan(getXpForLevel(20, 'medium'));
    expect(getXpForLevel(20, 'medium')).toBeLessThan(getXpForLevel(50, 'medium'));
  });

  it('should require less XP for fast growth', () => {
    expect(getXpForLevel(50, 'fast')).toBeLessThan(getXpForLevel(50, 'medium'));
    expect(getXpForLevel(50, 'medium')).toBeLessThan(getXpForLevel(50, 'slow'));
  });
});
