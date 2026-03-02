export const ELEMENTAL_TYPES = [
  'normal',
  'fire',
  'water',
  'grass',
  'electric',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
  'dark',
  'steel',
  'fairy',
] as const;

export type ElementalType = (typeof ELEMENTAL_TYPES)[number];

export type Effectiveness = 0 | 0.25 | 0.5 | 1 | 2 | 4;

export type EffectivenessChart = ReadonlyMap<ElementalType, ReadonlyMap<ElementalType, number>>;

export function getEffectiveness(
  chart: EffectivenessChart,
  attackType: ElementalType,
  defenderTypes: readonly ElementalType[],
): number {
  const attackRow = chart.get(attackType);
  if (!attackRow) return 1;

  let multiplier = 1;
  for (const defType of defenderTypes) {
    const eff = attackRow.get(defType);
    multiplier *= eff ?? 1;
  }
  return multiplier;
}

export function buildEffectivenessChart(
  data: ReadonlyArray<{ attacker: ElementalType; defender: ElementalType; multiplier: number }>,
): EffectivenessChart {
  const chart = new Map<ElementalType, Map<ElementalType, number>>();

  for (const type of ELEMENTAL_TYPES) {
    const row = new Map<ElementalType, number>();
    for (const defType of ELEMENTAL_TYPES) {
      row.set(defType, 1);
    }
    chart.set(type, row);
  }

  for (const entry of data) {
    const row = chart.get(entry.attacker);
    if (row) {
      row.set(entry.defender, entry.multiplier);
    }
  }

  return chart;
}
