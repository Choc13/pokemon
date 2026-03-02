import type { StatBlock, Species, Creature, Nature, NatureModifier } from '../types/creature.js';

const NATURE_MODIFIERS: Record<Nature, NatureModifier> = {
  hardy: { increased: null, decreased: null },
  lonely: { increased: 'attack', decreased: 'defense' },
  brave: { increased: 'attack', decreased: 'speed' },
  adamant: { increased: 'attack', decreased: 'specialAttack' },
  naughty: { increased: 'attack', decreased: 'specialDefense' },
  bold: { increased: 'defense', decreased: 'attack' },
  docile: { increased: null, decreased: null },
  relaxed: { increased: 'defense', decreased: 'speed' },
  impish: { increased: 'defense', decreased: 'specialAttack' },
  lax: { increased: 'defense', decreased: 'specialDefense' },
  timid: { increased: 'speed', decreased: 'attack' },
  hasty: { increased: 'speed', decreased: 'defense' },
  serious: { increased: null, decreased: null },
  jolly: { increased: 'speed', decreased: 'specialAttack' },
  naive: { increased: 'speed', decreased: 'specialDefense' },
  modest: { increased: 'specialAttack', decreased: 'attack' },
  mild: { increased: 'specialAttack', decreased: 'defense' },
  quiet: { increased: 'specialAttack', decreased: 'speed' },
  bashful: { increased: null, decreased: null },
  rash: { increased: 'specialAttack', decreased: 'specialDefense' },
  calm: { increased: 'specialDefense', decreased: 'attack' },
  gentle: { increased: 'specialDefense', decreased: 'defense' },
  sassy: { increased: 'specialDefense', decreased: 'speed' },
  careful: { increased: 'specialDefense', decreased: 'specialAttack' },
  quirky: { increased: null, decreased: null },
};

export function getNatureModifier(nature: Nature): NatureModifier {
  return NATURE_MODIFIERS[nature];
}

export function computeStats(species: Species, creature: Creature): StatBlock {
  const level = creature.level;
  const natureMod = getNatureModifier(creature.nature);

  const hp = computeHp(species.baseStats.hp, creature.ivs.hp, creature.evs.hp, level);

  const computeStat = (
    base: number,
    iv: number,
    ev: number,
    statName: keyof Omit<StatBlock, 'hp'>,
  ): number => {
    const raw = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5;
    let natureMultiplier = 1.0;
    if (natureMod.increased === statName) natureMultiplier = 1.1;
    if (natureMod.decreased === statName) natureMultiplier = 0.9;
    return Math.floor(raw * natureMultiplier);
  };

  return {
    hp,
    attack: computeStat(
      species.baseStats.attack,
      creature.ivs.attack,
      creature.evs.attack,
      'attack',
    ),
    defense: computeStat(
      species.baseStats.defense,
      creature.ivs.defense,
      creature.evs.defense,
      'defense',
    ),
    specialAttack: computeStat(
      species.baseStats.specialAttack,
      creature.ivs.specialAttack,
      creature.evs.specialAttack,
      'specialAttack',
    ),
    specialDefense: computeStat(
      species.baseStats.specialDefense,
      creature.ivs.specialDefense,
      creature.evs.specialDefense,
      'specialDefense',
    ),
    speed: computeStat(
      species.baseStats.speed,
      creature.ivs.speed,
      creature.evs.speed,
      'speed',
    ),
  };
}

function computeHp(base: number, iv: number, ev: number, level: number): number {
  return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
}

export function computeStatStageMultiplier(stage: number): number {
  const clamped = Math.max(-6, Math.min(6, stage));
  if (clamped >= 0) {
    return (2 + clamped) / 2;
  }
  return 2 / (2 - clamped);
}

export function getXpForLevel(level: number, growthRate: 'fast' | 'medium' | 'slow'): number {
  switch (growthRate) {
    case 'fast':
      return Math.floor((4 * Math.pow(level, 3)) / 5);
    case 'medium':
      return Math.pow(level, 3);
    case 'slow':
      return Math.floor((5 * Math.pow(level, 3)) / 4);
  }
}
