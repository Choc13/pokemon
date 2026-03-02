import type { Creature, Species, EvolutionPath } from '../types/creature.js';
import type { Move } from '../types/move.js';
import { computeStats, getXpForLevel } from './stats.js';

export function canEvolve(
  creature: Creature,
  species: Species,
  storyFlags: ReadonlySet<string>,
  inventory: readonly { readonly itemId: string }[],
): EvolutionPath | null {
  for (const path of species.evolutionPaths) {
    switch (path.trigger.kind) {
      case 'level':
        if (creature.level >= path.trigger.level) return path;
        break;
      case 'bond':
        if (creature.bond >= path.trigger.minBond) return path;
        break;
      case 'storyFlag':
        if (storyFlags.has(path.trigger.flag)) return path;
        break;
      case 'item':
        if (inventory.some((e) => e.itemId === path.trigger.itemId)) return path;
        break;
    }
  }
  return null;
}

export function applyXpGain(
  creature: Creature,
  xp: number,
  species: Species,
  allMoves: ReadonlyMap<string, Move>,
): { readonly creature: Creature; readonly leveledUp: boolean; readonly newMoves: readonly string[] } {
  const newXp = creature.xp + xp;
  const nextLevelXp = getXpForLevel(creature.level + 1, species.growthRate);

  if (newXp < nextLevelXp) {
    return {
      creature: { ...creature, xp: newXp },
      leveledUp: false,
      newMoves: [],
    };
  }

  const newLevel = creature.level + 1;
  const newMoves: string[] = [];

  for (const lm of species.learnableMoves) {
    if (lm.learnMethod.kind === 'levelUp' && lm.learnMethod.level === newLevel) {
      newMoves.push(lm.moveId);
    }
  }

  let updatedMoveIds = [...creature.moveIds];
  let updatedMovePp = [...creature.movePp];

  for (const moveId of newMoves) {
    const move = allMoves.get(moveId);
    if (!move) continue;
    if (updatedMoveIds.length < 4) {
      updatedMoveIds.push(moveId);
      updatedMovePp.push(move.pp);
    }
  }

  const newCreature: Creature = {
    ...creature,
    level: newLevel,
    xp: newXp,
    moveIds: updatedMoveIds,
    movePp: updatedMovePp,
  };

  const updatedWithStats: Creature = {
    ...newCreature,
    currentHp: computeStats(species, newCreature).hp,
  };

  return {
    creature: updatedWithStats,
    leveledUp: true,
    newMoves,
  };
}

export function applyEvolution(creature: Creature, targetSpeciesId: string): Creature {
  return {
    ...creature,
    speciesId: targetSpeciesId,
  };
}

export function createCreature(
  id: string,
  species: Species,
  level: number,
  nature: Creature['nature'],
  ivs: Creature['ivs'],
  moveIds: readonly string[],
  movePp: readonly number[],
  rng: { next: () => number },
): Creature {
  const creature: Creature = {
    id,
    speciesId: species.id,
    nickname: null,
    level,
    xp: getXpForLevel(level, species.growthRate),
    nature,
    ivs,
    evs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
    currentHp: 0,
    status: { kind: 'none' },
    moveIds,
    movePp,
    bond: 0,
    isShiny: rng.next() < 1 / 4096,
    originalTrainer: 'wild',
  };

  const stats = computeStats(species, creature);
  return { ...creature, currentHp: stats.hp };
}
