import { describe, it, expect } from 'vitest';
import { getEffectiveness, buildEffectivenessChart } from '../src/types/elemental';
import type { ElementalType } from '../src/types/elemental';

const testData: Array<{ attacker: ElementalType; defender: ElementalType; multiplier: number }> = [
  { attacker: 'fire', defender: 'grass', multiplier: 2 },
  { attacker: 'fire', defender: 'water', multiplier: 0.5 },
  { attacker: 'water', defender: 'fire', multiplier: 2 },
  { attacker: 'water', defender: 'grass', multiplier: 0.5 },
  { attacker: 'grass', defender: 'water', multiplier: 2 },
  { attacker: 'grass', defender: 'fire', multiplier: 0.5 },
  { attacker: 'electric', defender: 'ground', multiplier: 0 },
  { attacker: 'normal', defender: 'ghost', multiplier: 0 },
  { attacker: 'fighting', defender: 'ghost', multiplier: 0 },
  { attacker: 'ghost', defender: 'normal', multiplier: 0 },
];

const chart = buildEffectivenessChart(testData);

describe('getEffectiveness', () => {
  it('should return 2 for super-effective matchups', () => {
    expect(getEffectiveness(chart, 'fire', ['grass'])).toBe(2);
    expect(getEffectiveness(chart, 'water', ['fire'])).toBe(2);
    expect(getEffectiveness(chart, 'grass', ['water'])).toBe(2);
  });

  it('should return 0.5 for not-very-effective matchups', () => {
    expect(getEffectiveness(chart, 'fire', ['water'])).toBe(0.5);
    expect(getEffectiveness(chart, 'water', ['grass'])).toBe(0.5);
    expect(getEffectiveness(chart, 'grass', ['fire'])).toBe(0.5);
  });

  it('should return 0 for immunities', () => {
    expect(getEffectiveness(chart, 'electric', ['ground'])).toBe(0);
    expect(getEffectiveness(chart, 'normal', ['ghost'])).toBe(0);
    expect(getEffectiveness(chart, 'ghost', ['normal'])).toBe(0);
  });

  it('should return 1 for neutral matchups', () => {
    expect(getEffectiveness(chart, 'fire', ['fire'])).toBe(1);
    expect(getEffectiveness(chart, 'normal', ['normal'])).toBe(1);
  });

  it('should multiply for dual types', () => {
    // fire vs grass/water = 2 * 0.5 = 1
    expect(getEffectiveness(chart, 'fire', ['grass', 'water'])).toBe(1);
    // electric vs water/ground = 2 * 0 = 0
    expect(getEffectiveness(chart, 'electric', ['water', 'ground'])).toBe(0);
  });

  it('should handle 4x effectiveness for dual types', () => {
    // grass vs water/ground (if both are super effective)
    const chart2 = buildEffectivenessChart([
      ...testData,
      { attacker: 'grass', defender: 'ground', multiplier: 2 },
    ]);
    expect(getEffectiveness(chart2, 'grass', ['water', 'ground'])).toBe(4);
  });

  it('should handle 0.25x for dual types', () => {
    const chart2 = buildEffectivenessChart([
      ...testData,
      { attacker: 'fire', defender: 'dragon', multiplier: 0.5 },
    ]);
    expect(getEffectiveness(chart2, 'fire', ['water', 'dragon'])).toBe(0.25);
  });
});
