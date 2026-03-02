import { describe, it, expect } from 'vitest';
import {
  initBattle,
  calculateDamage,
  resolveTurn,
  chooseOpponentAction,
  resolveBefriend,
  resolveFlee,
} from '../src/engines/battle-engine';
import { buildEffectivenessChart } from '../src/types/elemental';
import { DEFAULT_STAT_STAGES } from '../src/types/battle';
import { computeStats } from '../src/helpers/stats';
import { createRng } from '../src/engines/rng';
import type { Species, Creature } from '../src/types/creature';
import type { Move } from '../src/types/move';
import type { GameData } from '../src/types/game-state';

const fireSpecies: Species = {
  id: 'fire-creature', name: 'FireCreature', description: '', types: ['fire'],
  baseStats: { hp: 50, attack: 60, defense: 45, specialAttack: 70, specialDefense: 50, speed: 65 },
  catchDifficulty: 3, evolutionPaths: [], learnableMoves: [], baseExpYield: 64, growthRate: 'medium',
};

const waterSpecies: Species = {
  id: 'water-creature', name: 'WaterCreature', description: '', types: ['water'],
  baseStats: { hp: 55, attack: 50, defense: 55, specialAttack: 65, specialDefense: 60, speed: 45 },
  catchDifficulty: 3, evolutionPaths: [], learnableMoves: [], baseExpYield: 64, growthRate: 'medium',
};

const tackle: Move = {
  id: 'tackle', name: 'Tackle', description: '', type: 'normal', category: 'physical',
  power: 40, accuracy: 100, pp: 35, priority: 0, target: 'opponent',
  effects: [{ kind: 'damage', power: 40 }], makesContact: true,
};

const ember: Move = {
  id: 'ember', name: 'Ember', description: '', type: 'fire', category: 'special',
  power: 40, accuracy: 100, pp: 25, priority: 0, target: 'opponent',
  effects: [{ kind: 'damage', power: 40 }], makesContact: false,
};

const waterGun: Move = {
  id: 'water-gun', name: 'Water Gun', description: '', type: 'water', category: 'special',
  power: 40, accuracy: 100, pp: 25, priority: 0, target: 'opponent',
  effects: [{ kind: 'damage', power: 40 }], makesContact: false,
};

function makeCreature(speciesId: string, level: number, moves: string[], species: Species): Creature {
  const creature: Creature = {
    id: `${speciesId}-1`, speciesId, nickname: null, level, xp: 0, nature: 'hardy',
    ivs: { hp: 15, attack: 15, defense: 15, specialAttack: 15, specialDefense: 15, speed: 15 },
    evs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
    currentHp: 0, status: { kind: 'none' }, moveIds: moves, movePp: moves.map(() => 35),
    bond: 0, isShiny: false, originalTrainer: 'test',
  };
  const stats = computeStats(species, creature);
  return { ...creature, currentHp: stats.hp };
}

function makeGameData(): GameData {
  const species = new Map<string, Species>([['fire-creature', fireSpecies], ['water-creature', waterSpecies]]);
  const moves = new Map<string, Move>([['tackle', tackle], ['ember', ember], ['water-gun', waterGun]]);
  const items = new Map();
  const effectivenessChart = buildEffectivenessChart([
    { attacker: 'fire', defender: 'water', multiplier: 0.5 },
    { attacker: 'fire', defender: 'grass', multiplier: 2 },
    { attacker: 'water', defender: 'fire', multiplier: 2 },
    { attacker: 'water', defender: 'grass', multiplier: 0.5 },
  ]);

  return {
    species, moves, items,
    worldMap: { locations: new Map(), connections: new Map() },
    storyGraph: { nodes: new Map(), startNodeId: '' },
    effectivenessChart,
  };
}

describe('initBattle', () => {
  it('should create a valid battle state', () => {
    const data = makeGameData();
    const playerCreature = makeCreature('fire-creature', 10, ['tackle', 'ember'], fireSpecies);
    const opponentCreature = makeCreature('water-creature', 10, ['tackle', 'water-gun'], waterSpecies);

    const state = initBattle([playerCreature], [opponentCreature], true, data);

    expect(state.phase).toBe('awaitingInput');
    expect(state.playerSide.active.creature.speciesId).toBe('fire-creature');
    expect(state.opponentSide.active.creature.speciesId).toBe('water-creature');
    expect(state.isWild).toBe(true);
    expect(state.turnNumber).toBe(1);
  });
});

describe('calculateDamage', () => {
  it('should deal non-zero damage for a damaging move', () => {
    const data = makeGameData();
    const rng = createRng(42);
    const playerCreature = makeCreature('fire-creature', 10, ['tackle'], fireSpecies);
    const stats = computeStats(fireSpecies, playerCreature);
    const attacker = { creature: playerCreature, statStages: DEFAULT_STAT_STAGES, isProtected: false, computedStats: stats };

    const opponentCreature = makeCreature('water-creature', 10, ['tackle'], waterSpecies);
    const oppStats = computeStats(waterSpecies, opponentCreature);
    const defender = { creature: opponentCreature, statStages: DEFAULT_STAT_STAGES, isProtected: false, computedStats: oppStats };

    const result = calculateDamage(attacker, defender, tackle, { weather: 'clear', weatherTurnsRemaining: 0 }, data.effectivenessChart, rng, fireSpecies);
    expect(result.damage).toBeGreaterThan(0);
    expect(result.effectiveness).toBe(1);
  });

  it('should compute super-effective damage', () => {
    const data = makeGameData();
    const rng = createRng(42);
    const attCreature = makeCreature('water-creature', 10, ['water-gun'], waterSpecies);
    const attStats = computeStats(waterSpecies, attCreature);
    const attacker = { creature: attCreature, statStages: DEFAULT_STAT_STAGES, isProtected: false, computedStats: attStats };

    const defCreature = makeCreature('fire-creature', 10, ['tackle'], fireSpecies);
    const defStats = computeStats(fireSpecies, defCreature);
    const defender = { creature: defCreature, statStages: DEFAULT_STAT_STAGES, isProtected: false, computedStats: defStats };

    const result = calculateDamage(attacker, defender, waterGun, { weather: 'clear', weatherTurnsRemaining: 0 }, data.effectivenessChart, rng, waterSpecies, fireSpecies);
    expect(result.effectiveness).toBe(2);
    expect(result.damage).toBeGreaterThan(0);
  });
});

describe('resolveTurn', () => {
  it('should resolve a full turn with both sides attacking', () => {
    const data = makeGameData();
    const rng = createRng(42);
    const playerCreature = makeCreature('fire-creature', 10, ['tackle'], fireSpecies);
    const opponentCreature = makeCreature('water-creature', 10, ['tackle'], waterSpecies);
    const state = initBattle([playerCreature], [opponentCreature], true, data);

    const result = resolveTurn(
      state,
      { kind: 'useMove', moveIndex: 0 },
      { kind: 'useMove', moveIndex: 0 },
      rng, data,
    );

    expect(result.events.length).toBeGreaterThan(0);
    // Both should have taken damage
    const playerHp = result.state.playerSide.active.creature.currentHp;
    const oppHp = result.state.opponentSide.active.creature.currentHp;
    expect(playerHp).toBeLessThan(playerCreature.currentHp);
    expect(oppHp).toBeLessThan(opponentCreature.currentHp);
  });
});

describe('chooseOpponentAction', () => {
  it('should return a valid action for naive AI', () => {
    const data = makeGameData();
    const rng = createRng(42);
    const playerCreature = makeCreature('fire-creature', 10, ['tackle'], fireSpecies);
    const opponentCreature = makeCreature('water-creature', 10, ['tackle', 'water-gun'], waterSpecies);
    const state = initBattle([playerCreature], [opponentCreature], true, data);

    const action = chooseOpponentAction(state, 'naive', rng, data);
    expect(action.kind).toBe('useMove');
  });

  it('should prefer type-advantaged moves at tactical difficulty', () => {
    const data = makeGameData();
    const rng = createRng(42);
    const playerCreature = makeCreature('fire-creature', 10, ['tackle'], fireSpecies);
    const opponentCreature = makeCreature('water-creature', 10, ['tackle', 'water-gun'], waterSpecies);
    const state = initBattle([playerCreature], [opponentCreature], true, data);

    const action = chooseOpponentAction(state, 'tactical', rng, data);
    expect(action.kind).toBe('useMove');
    if (action.kind === 'useMove') {
      // Should prefer water-gun (super effective against fire) = index 1
      expect(action.moveIndex).toBe(1);
    }
  });
});

describe('resolveFlee', () => {
  it('should return success or failure event', () => {
    const data = makeGameData();
    const rng = createRng(42);
    const playerCreature = makeCreature('fire-creature', 10, ['tackle'], fireSpecies);
    const opponentCreature = makeCreature('water-creature', 10, ['tackle'], waterSpecies);
    const state = initBattle([playerCreature], [opponentCreature], true, data);

    const result = resolveFlee(state, rng);
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.events[0]!.kind).toBe('fled');
  });
});
