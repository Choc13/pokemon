import type {
  BattleState,
  BattleSide,
  BattleCreatureState,
  BattleAction,
  BattleEvent,
  BattleResolution,
  DamageResult,
  FieldConditions,
  StatStages,
} from '../types/battle.js';
import { DEFAULT_STAT_STAGES } from '../types/battle.js';
import type { Creature, Species } from '../types/creature.js';
import type { Move, MoveEffect, WeatherType } from '../types/move.js';
import type { Item } from '../types/item.js';
import type { EffectivenessChart } from '../types/elemental.js';
import type { GameData } from '../types/game-state.js';
import { getEffectiveness } from '../types/elemental.js';
import { computeStats, computeStatStageMultiplier } from '../helpers/stats.js';
import type { Rng } from './rng.js';

// ---- Initialize Battle ----

export function initBattle(
  playerTeam: readonly Creature[],
  opponentTeam: readonly Creature[],
  isWild: boolean,
  data: GameData,
): BattleState {
  return {
    phase: 'awaitingInput',
    playerSide: createBattleSide(playerTeam, data),
    opponentSide: createBattleSide(opponentTeam, data),
    field: { weather: 'clear', weatherTurnsRemaining: 0 },
    turnNumber: 1,
    isWild,
    log: [],
  };
}

function createBattleSide(team: readonly Creature[], data: GameData): BattleSide {
  const first = team[0]!;
  const species = data.species.get(first.speciesId)!;
  return {
    active: {
      creature: first,
      statStages: DEFAULT_STAT_STAGES,
      isProtected: false,
      computedStats: computeStats(species, first),
    },
    team,
    teamIndex: 0,
  };
}

// ---- Damage Calculation ----

export function calculateDamage(
  attacker: BattleCreatureState,
  defender: BattleCreatureState,
  move: Move,
  field: FieldConditions,
  chart: EffectivenessChart,
  rng: Rng,
  attackerSpecies: Species,
  defenderSpecies?: Species,
): DamageResult {
  if (move.category === 'status') {
    return { damage: 0, effectiveness: 1, critical: false };
  }

  const level = attacker.creature.level;
  const power = getDamagePower(move);
  if (power === 0) return { damage: 0, effectiveness: 1, critical: false };

  const isPhysical = move.category === 'physical';

  const rawAtk = isPhysical ? attacker.computedStats.attack : attacker.computedStats.specialAttack;
  const rawDef = isPhysical ? defender.computedStats.defense : defender.computedStats.specialDefense;

  const atkStage = isPhysical ? attacker.statStages.attack : attacker.statStages.specialAttack;
  const defStage = isPhysical ? defender.statStages.defense : defender.statStages.specialDefense;

  const atk = Math.floor(rawAtk * computeStatStageMultiplier(atkStage));
  const def = Math.floor(rawDef * computeStatStageMultiplier(defStage));

  // Critical hit
  const critRoll = rng.nextFloat();
  const critical = critRoll < 1 / 16;
  const critMultiplier = critical ? 1.5 : 1;

  // Type effectiveness
  const defenderTypes = defenderSpecies ? defenderSpecies.types : attackerSpecies.types;
  const effectiveness = getEffectiveness(chart, move.type, defenderTypes);

  if (effectiveness === 0) {
    return { damage: 0, effectiveness: 0, critical: false };
  }

  // STAB
  const attackerTypes = attackerSpecies.types;
  const stab = attackerTypes.includes(move.type) ? 1.5 : 1;

  // Weather modifier
  const weatherMod = getWeatherModifier(move.type, field.weather);

  // Random factor (0.85 to 1.0)
  const randomFactor = 0.85 + rng.nextFloat() * 0.15;

  // Damage formula
  const baseDamage = Math.floor(
    ((((2 * level) / 5 + 2) * power * (atk / def)) / 50 + 2) *
      critMultiplier *
      stab *
      effectiveness *
      weatherMod *
      randomFactor,
  );

  return {
    damage: Math.max(1, baseDamage),
    effectiveness,
    critical,
  };
}

function getDamagePower(move: Move): number {
  for (const effect of move.effects) {
    if (effect.kind === 'damage') return effect.power;
  }
  return move.power;
}

function getCreatureTypes(
  creature: Creature,
  _species: Species,
): readonly import('../types/elemental.js').ElementalType[] {
  // Types come from the species data; look up by species ID when needed
  // For now, we pass through from species
  return _species.types;
}

function getWeatherModifier(
  moveType: import('../types/elemental.js').ElementalType,
  weather: WeatherType,
): number {
  if (weather === 'rain') {
    if (moveType === 'water') return 1.5;
    if (moveType === 'fire') return 0.5;
  }
  if (weather === 'sun') {
    if (moveType === 'fire') return 1.5;
    if (moveType === 'water') return 0.5;
  }
  return 1;
}

// ---- Move Resolution ----

export function resolveMove(
  state: BattleState,
  userSide: 'player' | 'opponent',
  moveIndex: number,
  rng: Rng,
  data: GameData,
): BattleResolution {
  const events: BattleEvent[] = [];
  let currentState = state;

  const attSide = userSide === 'player' ? currentState.playerSide : currentState.opponentSide;
  const defSide = userSide === 'player' ? currentState.opponentSide : currentState.playerSide;
  const defSideName: 'player' | 'opponent' = userSide === 'player' ? 'opponent' : 'player';

  const moveId = attSide.active.creature.moveIds[moveIndex];
  if (!moveId) return { state: currentState, events };

  const move = data.moves.get(moveId);
  if (!move) return { state: currentState, events };

  events.push({ kind: 'moveUsed', side: userSide, moveName: move.name });

  // Protection check
  if (defSide.active.isProtected && move.target === 'opponent') {
    events.push({ kind: 'protected', side: defSideName });
    return { state: currentState, events };
  }

  // Accuracy check
  const accuracyStage = attSide.active.statStages.accuracy - defSide.active.statStages.evasion;
  const accuracyMod = computeStatStageMultiplier(Math.max(-6, Math.min(6, accuracyStage)));
  const hitChance = (move.accuracy / 100) * accuracyMod;

  if (move.accuracy > 0 && rng.nextFloat() > hitChance) {
    events.push({ kind: 'miss', side: userSide });
    return { state: currentState, events };
  }

  // Reduce PP
  const ppIndex = moveIndex;
  const currentPp = attSide.active.creature.movePp[ppIndex] ?? 0;
  const updatedPp = [...attSide.active.creature.movePp];
  updatedPp[ppIndex] = Math.max(0, currentPp - 1);

  let updatedAttacker = {
    ...attSide.active,
    creature: { ...attSide.active.creature, movePp: updatedPp },
  };
  let updatedDefender = { ...defSide.active };

  const attackerSpecies = data.species.get(updatedAttacker.creature.speciesId)!;
  const defenderSpecies = data.species.get(updatedDefender.creature.speciesId)!;

  // Apply effects sequentially
  for (const effect of move.effects) {
    const result = applyMoveEffect(
      effect,
      updatedAttacker,
      updatedDefender,
      move,
      currentState.field,
      data.effectivenessChart,
      rng,
      userSide,
      defSideName,
      attackerSpecies,
      defenderSpecies,
    );
    updatedAttacker = result.attacker;
    updatedDefender = result.defender;
    events.push(...result.events);

    // Check if defender fainted
    if (updatedDefender.creature.currentHp <= 0) {
      updatedDefender = {
        ...updatedDefender,
        creature: { ...updatedDefender.creature, currentHp: 0 },
      };
      events.push({ kind: 'fainted', side: defSideName });
      break;
    }
  }

  // Check attacker faint from recoil
  if (updatedAttacker.creature.currentHp <= 0) {
    updatedAttacker = {
      ...updatedAttacker,
      creature: { ...updatedAttacker.creature, currentHp: 0 },
    };
    events.push({ kind: 'fainted', side: userSide });
  }

  // Rebuild state
  const newPlayerSide =
    userSide === 'player'
      ? updateSideActive(currentState.playerSide, updatedAttacker)
      : updateSideActive(currentState.playerSide, updatedDefender);
  const newOpponentSide =
    userSide === 'opponent'
      ? updateSideActive(currentState.opponentSide, updatedAttacker)
      : updateSideActive(currentState.opponentSide, updatedDefender);

  currentState = {
    ...currentState,
    playerSide: newPlayerSide,
    opponentSide: newOpponentSide,
  };

  return { state: currentState, events };
}

function applyMoveEffect(
  effect: MoveEffect,
  attacker: BattleCreatureState,
  defender: BattleCreatureState,
  move: Move,
  field: FieldConditions,
  chart: EffectivenessChart,
  rng: Rng,
  attackerSide: 'player' | 'opponent',
  defenderSide: 'player' | 'opponent',
  attackerSpecies: Species,
  defenderSpecies: Species,
): {
  attacker: BattleCreatureState;
  defender: BattleCreatureState;
  events: BattleEvent[];
} {
  const events: BattleEvent[] = [];

  switch (effect.kind) {
    case 'damage': {
      const dmg = calculateDamage(attacker, defender, move, field, chart, rng, attackerSpecies, defenderSpecies);
      const newHp = Math.max(0, defender.creature.currentHp - dmg.damage);
      defender = {
        ...defender,
        creature: { ...defender.creature, currentHp: newHp },
      };

      const effLabel =
        dmg.effectiveness === 0
          ? 'immune'
          : dmg.effectiveness > 1
            ? 'super'
            : dmg.effectiveness < 1
              ? 'not-very'
              : 'normal';

      events.push({
        kind: 'damage',
        target: defenderSide,
        amount: dmg.damage,
        effectiveness: effLabel as 'super' | 'normal' | 'not-very' | 'immune',
        critical: dmg.critical,
      });
      break;
    }

    case 'applyStatus': {
      if (defender.creature.status.kind !== 'none') break;
      if (rng.nextFloat() > effect.chance / 100) break;

      const status =
        effect.status === 'sleep'
          ? { kind: 'sleep' as const, turnsRemaining: rng.nextInt(1, 3) }
          : { kind: effect.status as 'burn' | 'poison' | 'paralysis' | 'freeze' };

      defender = {
        ...defender,
        creature: { ...defender.creature, status },
      };
      events.push({ kind: 'statusApplied', target: defenderSide, status });
      break;
    }

    case 'statChange': {
      const target = effect.target === 'self' ? 'attacker' : 'defender';
      if (rng.nextFloat() > effect.chance / 100) break;

      if (target === 'attacker') {
        const newStages = applyStatStageChange(attacker.statStages, effect.stat, effect.stages);
        attacker = { ...attacker, statStages: newStages };
        events.push({
          kind: 'statChanged',
          target: attackerSide,
          stat: effect.stat,
          stages: effect.stages,
        });
      } else {
        const newStages = applyStatStageChange(defender.statStages, effect.stat, effect.stages);
        defender = { ...defender, statStages: newStages };
        events.push({
          kind: 'statChanged',
          target: defenderSide,
          stat: effect.stat,
          stages: effect.stages,
        });
      }
      break;
    }

    case 'heal': {
      const species = attackerSpecies;
      const maxHp = computeStats(species, attacker.creature).hp;
      const healAmount = Math.floor(maxHp * (effect.percentage / 100));
      const newHp = Math.min(maxHp, attacker.creature.currentHp + healAmount);
      attacker = {
        ...attacker,
        creature: { ...attacker.creature, currentHp: newHp },
      };
      events.push({
        kind: 'healed',
        target: attackerSide,
        amount: newHp - attacker.creature.currentHp + healAmount,
      });
      break;
    }

    case 'drain': {
      const dmg = calculateDamage(attacker, defender, move, field, chart, rng, attackerSpecies, defenderSpecies);
      const newDefHp = Math.max(0, defender.creature.currentHp - dmg.damage);
      defender = { ...defender, creature: { ...defender.creature, currentHp: newDefHp } };

      const drainAmount = Math.floor(dmg.damage * (effect.percentage / 100));
      const maxHp = computeStats(attackerSpecies, attacker.creature).hp;
      const newAtkHp = Math.min(maxHp, attacker.creature.currentHp + drainAmount);
      attacker = { ...attacker, creature: { ...attacker.creature, currentHp: newAtkHp } };

      events.push({
        kind: 'damage',
        target: defenderSide,
        amount: dmg.damage,
        effectiveness: 'normal',
        critical: dmg.critical,
      });
      events.push({ kind: 'healed', target: attackerSide, amount: drainAmount });
      break;
    }

    case 'recoil': {
      const dmg = calculateDamage(attacker, defender, move, field, chart, rng, attackerSpecies, defenderSpecies);
      const newDefHp = Math.max(0, defender.creature.currentHp - dmg.damage);
      defender = { ...defender, creature: { ...defender.creature, currentHp: newDefHp } };

      const recoilDmg = Math.floor(dmg.damage * (effect.percentage / 100));
      const newAtkHp = Math.max(0, attacker.creature.currentHp - recoilDmg);
      attacker = { ...attacker, creature: { ...attacker.creature, currentHp: newAtkHp } };

      events.push({
        kind: 'damage',
        target: defenderSide,
        amount: dmg.damage,
        effectiveness: 'normal',
        critical: dmg.critical,
      });
      events.push({ kind: 'damage', target: attackerSide, amount: recoilDmg, effectiveness: 'normal', critical: false });
      break;
    }

    case 'protect': {
      attacker = { ...attacker, isProtected: true };
      break;
    }

    case 'weather': {
      events.push({ kind: 'weatherChanged', weather: effect.weather });
      break;
    }
  }

  return { attacker, defender, events };
}

function applyStatStageChange(
  stages: StatStages,
  stat: string,
  change: number,
): StatStages {
  const key = stat as keyof StatStages;
  const current = stages[key] ?? 0;
  const newValue = Math.max(-6, Math.min(6, current + change));
  return { ...stages, [key]: newValue };
}

function updateSideActive(side: BattleSide, active: BattleCreatureState): BattleSide {
  const updatedTeam = side.team.map((c, i) =>
    i === side.teamIndex ? active.creature : c,
  );
  return {
    ...side,
    active,
    team: updatedTeam,
  };
}

// ---- Turn Resolution ----

export function resolveTurn(
  state: BattleState,
  playerAction: BattleAction,
  opponentAction: BattleAction,
  rng: Rng,
  data: GameData,
): BattleResolution {
  const allEvents: BattleEvent[] = [];
  let currentState = { ...state, phase: 'resolving' as const };

  // Determine action order
  const order = determineActionOrder(currentState, playerAction, opponentAction, rng);

  for (const { side, action } of order) {
    // Skip if the creature already fainted
    const activeSide =
      side === 'player' ? currentState.playerSide : currentState.opponentSide;
    if (activeSide.active.creature.currentHp <= 0) continue;

    const result = resolveAction(currentState, side, action, rng, data);
    currentState = result.state;
    allEvents.push(...result.events);
  }

  // End-of-turn processing
  const eotResult = processEndOfTurn(currentState, rng, data);
  currentState = eotResult.state;
  allEvents.push(...eotResult.events);

  // Determine phase
  const playerFainted = currentState.playerSide.active.creature.currentHp <= 0;
  const opponentFainted = currentState.opponentSide.active.creature.currentHp <= 0;

  const playerHasAlive = currentState.playerSide.team.some((c) => c.currentHp > 0);
  const opponentHasAlive = currentState.opponentSide.team.some((c) => c.currentHp > 0);

  if (!playerHasAlive) {
    currentState = { ...currentState, phase: 'ended' };
    allEvents.push({ kind: 'battleEnd', result: 'opponentWin' });
  } else if (!opponentHasAlive) {
    currentState = { ...currentState, phase: 'ended' };
    allEvents.push({ kind: 'battleEnd', result: 'playerWin' });
  } else if (playerFainted || opponentFainted) {
    currentState = { ...currentState, phase: 'creatureFainted' };
  } else {
    currentState = {
      ...currentState,
      phase: 'awaitingInput',
      turnNumber: currentState.turnNumber + 1,
    };
  }

  // Clear protection flags
  currentState = {
    ...currentState,
    playerSide: {
      ...currentState.playerSide,
      active: { ...currentState.playerSide.active, isProtected: false },
    },
    opponentSide: {
      ...currentState.opponentSide,
      active: { ...currentState.opponentSide.active, isProtected: false },
    },
  };

  return { state: currentState, events: allEvents };
}

function determineActionOrder(
  state: BattleState,
  playerAction: BattleAction,
  opponentAction: BattleAction,
  rng: Rng,
): readonly { side: 'player' | 'opponent'; action: BattleAction }[] {
  const playerPriority = getActionPriority(playerAction, state.playerSide, state, undefined);
  const opponentPriority = getActionPriority(opponentAction, state.opponentSide, state, undefined);

  // Higher priority goes first
  if (playerPriority > opponentPriority) {
    return [
      { side: 'player', action: playerAction },
      { side: 'opponent', action: opponentAction },
    ];
  }
  if (opponentPriority > playerPriority) {
    return [
      { side: 'opponent', action: opponentAction },
      { side: 'player', action: playerAction },
    ];
  }

  // Same priority: compare speed
  const playerSpeed =
    state.playerSide.active.computedStats.speed *
    computeStatStageMultiplier(state.playerSide.active.statStages.speed);
  const opponentSpeed =
    state.opponentSide.active.computedStats.speed *
    computeStatStageMultiplier(state.opponentSide.active.statStages.speed);

  // Paralysis halves speed
  if (state.playerSide.active.creature.status.kind === 'paralysis') {
    // Speed handled through stat already in combat stats
  }

  if (playerSpeed > opponentSpeed) {
    return [
      { side: 'player', action: playerAction },
      { side: 'opponent', action: opponentAction },
    ];
  }
  if (opponentSpeed > playerSpeed) {
    return [
      { side: 'opponent', action: opponentAction },
      { side: 'player', action: playerAction },
    ];
  }

  // Speed tie — random
  if (rng.nextFloat() < 0.5) {
    return [
      { side: 'player', action: playerAction },
      { side: 'opponent', action: opponentAction },
    ];
  }
  return [
    { side: 'opponent', action: opponentAction },
    { side: 'player', action: playerAction },
  ];
}

function getActionPriority(
  action: BattleAction,
  side: BattleSide,
  state: BattleState,
  data: GameData | undefined,
): number {
  switch (action.kind) {
    case 'switchCreature':
    case 'useItem':
    case 'flee':
    case 'befriend':
      return 100; // always go first
    case 'useMove': {
      // Move priority from move data
      // For now, return 0 (normal priority) — will be enhanced when wired to data
      return 0;
    }
  }
}

function resolveAction(
  state: BattleState,
  side: 'player' | 'opponent',
  action: BattleAction,
  rng: Rng,
  data: GameData,
): BattleResolution {
  switch (action.kind) {
    case 'useMove':
      return resolveMove(state, side, action.moveIndex, rng, data);
    case 'switchCreature':
      return resolveSwitchCreature(state, side, action.teamIndex, data);
    case 'flee':
      return resolveFlee(state, rng);
    case 'befriend':
      return resolveBefriend(state, action.itemId, rng, data);
    case 'useItem':
      return resolveUseItem(state, side, action.itemId, data);
  }
}

function resolveSwitchCreature(
  state: BattleState,
  side: 'player' | 'opponent',
  teamIndex: number,
  data: GameData,
): BattleResolution {
  const events: BattleEvent[] = [];
  const currentSide = side === 'player' ? state.playerSide : state.opponentSide;
  const newCreature = currentSide.team[teamIndex];

  if (!newCreature || newCreature.currentHp <= 0) {
    return { state, events };
  }

  const species = data.species.get(newCreature.speciesId)!;
  const newActive: BattleCreatureState = {
    creature: newCreature,
    statStages: DEFAULT_STAT_STAGES,
    isProtected: false,
    computedStats: computeStats(species, newCreature),
  };

  events.push({
    kind: 'switchedIn',
    side,
    creatureName: newCreature.nickname ?? species.name,
  });

  const newSide: BattleSide = {
    ...currentSide,
    active: newActive,
    teamIndex,
  };

  if (side === 'player') {
    return { state: { ...state, playerSide: newSide }, events };
  }
  return { state: { ...state, opponentSide: newSide }, events };
}

// ---- Befriending ----

export function resolveBefriend(
  state: BattleState,
  itemId: string,
  rng: Rng,
  data: GameData,
): BattleResolution {
  const events: BattleEvent[] = [];

  if (!state.isWild) {
    return { state, events };
  }

  const opponent = state.opponentSide.active.creature;
  const species = data.species.get(opponent.speciesId);
  if (!species) return { state, events };

  const item = data.items.get(itemId);
  const catchMod =
    item?.effect.kind === 'befriend' ? item.effect.catchModifier : 1;

  const maxHp = computeStats(species, opponent).hp;
  const hpFactor = 1 - opponent.currentHp / maxHp; // lower HP = higher chance
  const statusBonus =
    opponent.status.kind === 'sleep' || opponent.status.kind === 'freeze'
      ? 0.2
      : opponent.status.kind === 'paralysis' ||
          opponent.status.kind === 'burn' ||
          opponent.status.kind === 'poison'
        ? 0.1
        : 0;

  const baseCatchRate = 1 / species.catchDifficulty;
  const catchChance = Math.min(
    0.95,
    baseCatchRate * catchMod * (1 + hpFactor) * (1 + statusBonus) * (1 + opponent.bond / 100),
  );

  const roll = rng.nextFloat();
  const success = roll < catchChance;

  events.push({
    kind: 'befriendAttempt',
    success,
    creatureName: opponent.nickname ?? species.name,
  });

  if (success) {
    events.push({ kind: 'battleEnd', result: 'captured' });
    return {
      state: { ...state, phase: 'ended' },
      events,
    };
  }

  return { state, events };
}

// ---- Fleeing ----

export function resolveFlee(state: BattleState, rng: Rng): BattleResolution {
  const events: BattleEvent[] = [];
  const playerSpeed = state.playerSide.active.computedStats.speed;
  const oppSpeed = state.opponentSide.active.computedStats.speed;

  const fleeChance = state.isWild
    ? Math.min(0.95, 0.5 + (playerSpeed - oppSpeed) / 200)
    : 0;

  const success = rng.nextFloat() < fleeChance;

  events.push({ kind: 'fled', success });

  if (success) {
    events.push({ kind: 'battleEnd', result: 'fled' });
    return {
      state: { ...state, phase: 'ended' },
      events,
    };
  }

  return { state, events };
}

function resolveUseItem(
  state: BattleState,
  side: 'player' | 'opponent',
  itemId: string,
  data: GameData,
): BattleResolution {
  const item = data.items.get(itemId);
  if (!item) return { state, events: [] };

  const events: BattleEvent[] = [];
  const currentSide = side === 'player' ? state.playerSide : state.opponentSide;

  if (item.effect.kind === 'healHp') {
    const species = data.species.get(currentSide.active.creature.speciesId)!;
    const maxHp = computeStats(species, currentSide.active.creature).hp;
    const healed = Math.min(
      item.effect.amount,
      maxHp - currentSide.active.creature.currentHp,
    );
    const newCreature = {
      ...currentSide.active.creature,
      currentHp: currentSide.active.creature.currentHp + healed,
    };
    const newSide: BattleSide = {
      ...currentSide,
      active: { ...currentSide.active, creature: newCreature },
      team: currentSide.team.map((c, i) =>
        i === currentSide.teamIndex ? newCreature : c,
      ),
    };
    events.push({ kind: 'healed', target: side, amount: healed });

    if (side === 'player') {
      return { state: { ...state, playerSide: newSide }, events };
    }
    return { state: { ...state, opponentSide: newSide }, events };
  }

  return { state, events };
}

// ---- End-of-turn Processing ----

function processEndOfTurn(
  state: BattleState,
  rng: Rng,
  data: GameData,
): BattleResolution {
  const events: BattleEvent[] = [];
  let current = state;

  // Weather damage
  if (current.field.weather === 'sandstorm' || current.field.weather === 'hail') {
    for (const side of ['player', 'opponent'] as const) {
      const battleSide = side === 'player' ? current.playerSide : current.opponentSide;
      if (battleSide.active.creature.currentHp <= 0) continue;

      const species = data.species.get(battleSide.active.creature.speciesId);
      if (!species) continue;

      // Sandstorm doesn't affect rock/ground/steel; hail doesn't affect ice
      const immune =
        current.field.weather === 'sandstorm'
          ? species.types.some((t) => t === 'rock' || t === 'ground' || t === 'steel')
          : species.types.includes('ice');

      if (!immune) {
        const maxHp = computeStats(species, battleSide.active.creature).hp;
        const weatherDmg = Math.max(1, Math.floor(maxHp / 16));
        const newHp = Math.max(0, battleSide.active.creature.currentHp - weatherDmg);
        const newCreature = { ...battleSide.active.creature, currentHp: newHp };
        const newSide: BattleSide = {
          ...battleSide,
          active: { ...battleSide.active, creature: newCreature },
          team: battleSide.team.map((c, i) =>
            i === battleSide.teamIndex ? newCreature : c,
          ),
        };

        if (side === 'player') {
          current = { ...current, playerSide: newSide };
        } else {
          current = { ...current, opponentSide: newSide };
        }
        events.push({ kind: 'weatherDamage', target: side, amount: weatherDmg });
      }
    }
  }

  // Status damage (burn, poison)
  for (const side of ['player', 'opponent'] as const) {
    const battleSide = side === 'player' ? current.playerSide : current.opponentSide;
    const creature = battleSide.active.creature;
    if (creature.currentHp <= 0) continue;

    const species = data.species.get(creature.speciesId);
    if (!species) continue;
    const maxHp = computeStats(species, creature).hp;

    if (creature.status.kind === 'burn' || creature.status.kind === 'poison') {
      const dmg = Math.max(1, Math.floor(maxHp / 8));
      const newHp = Math.max(0, creature.currentHp - dmg);
      const newCreature = { ...creature, currentHp: newHp };
      const newSide: BattleSide = {
        ...battleSide,
        active: { ...battleSide.active, creature: newCreature },
        team: battleSide.team.map((c, i) =>
          i === battleSide.teamIndex ? newCreature : c,
        ),
      };

      if (side === 'player') {
        current = { ...current, playerSide: newSide };
      } else {
        current = { ...current, opponentSide: newSide };
      }
      events.push({ kind: 'statusDamage', target: side, amount: dmg });

      if (newHp <= 0) {
        events.push({ kind: 'fainted', side });
      }
    }

    // Sleep countdown
    if (creature.status.kind === 'sleep') {
      const remaining = creature.status.turnsRemaining - 1;
      if (remaining <= 0) {
        const newCreature = { ...creature, status: { kind: 'none' as const } };
        const newSide: BattleSide = {
          ...battleSide,
          active: { ...battleSide.active, creature: newCreature },
          team: battleSide.team.map((c, i) =>
            i === battleSide.teamIndex ? newCreature : c,
          ),
        };
        if (side === 'player') {
          current = { ...current, playerSide: newSide };
        } else {
          current = { ...current, opponentSide: newSide };
        }
        events.push({ kind: 'statusRecovered', target: side });
      } else {
        const newCreature = {
          ...creature,
          status: { kind: 'sleep' as const, turnsRemaining: remaining },
        };
        const newSide: BattleSide = {
          ...battleSide,
          active: { ...battleSide.active, creature: newCreature },
          team: battleSide.team.map((c, i) =>
            i === battleSide.teamIndex ? newCreature : c,
          ),
        };
        if (side === 'player') {
          current = { ...current, playerSide: newSide };
        } else {
          current = { ...current, opponentSide: newSide };
        }
      }
    }

    // Freeze thaw chance (20%)
    if (creature.status.kind === 'freeze' && rng.nextFloat() < 0.2) {
      const newCreature = { ...creature, status: { kind: 'none' as const } };
      const updatedSide = side === 'player' ? current.playerSide : current.opponentSide;
      const newSide: BattleSide = {
        ...updatedSide,
        active: { ...updatedSide.active, creature: newCreature },
        team: updatedSide.team.map((c, i) =>
          i === updatedSide.teamIndex ? newCreature : c,
        ),
      };
      if (side === 'player') {
        current = { ...current, playerSide: newSide };
      } else {
        current = { ...current, opponentSide: newSide };
      }
      events.push({ kind: 'statusRecovered', target: side });
    }
  }

  // Weather countdown
  if (current.field.weatherTurnsRemaining > 0) {
    const remaining = current.field.weatherTurnsRemaining - 1;
    if (remaining <= 0) {
      current = {
        ...current,
        field: { weather: 'clear', weatherTurnsRemaining: 0 },
      };
      events.push({ kind: 'weatherChanged', weather: 'clear' });
    } else {
      current = {
        ...current,
        field: { ...current.field, weatherTurnsRemaining: remaining },
      };
    }
  }

  return { state: current, events };
}

// ---- AI Opponent ----

export function chooseOpponentAction(
  state: BattleState,
  difficulty: 'naive' | 'tactical' | 'strategic',
  rng: Rng,
  data: GameData,
): BattleAction {
  const opponent = state.opponentSide.active;
  const availableMoves = opponent.creature.moveIds
    .map((_, i) => i)
    .filter((i) => (opponent.creature.movePp[i] ?? 0) > 0);

  if (availableMoves.length === 0) {
    return { kind: 'useMove', moveIndex: 0 };
  }

  switch (difficulty) {
    case 'naive':
      return {
        kind: 'useMove',
        moveIndex: availableMoves[rng.nextInt(0, availableMoves.length - 1)]!,
      };

    case 'tactical': {
      // Pick the move with best type effectiveness
      const playerSpecies = data.species.get(
        state.playerSide.active.creature.speciesId,
      );
      if (!playerSpecies) {
        return {
          kind: 'useMove',
          moveIndex: availableMoves[rng.nextInt(0, availableMoves.length - 1)]!,
        };
      }

      let bestMove = availableMoves[0]!;
      let bestScore = -1;

      for (const i of availableMoves) {
        const moveId = opponent.creature.moveIds[i];
        if (!moveId) continue;
        const move = data.moves.get(moveId);
        if (!move) continue;

        const eff = getEffectiveness(
          data.effectivenessChart,
          move.type,
          playerSpecies.types,
        );
        const power = move.power * eff;
        if (power > bestScore) {
          bestScore = power;
          bestMove = i;
        }
      }

      return { kind: 'useMove', moveIndex: bestMove };
    }

    case 'strategic': {
      // Consider switching if at type disadvantage
      const playerSpecies = data.species.get(
        state.playerSide.active.creature.speciesId,
      );
      if (!playerSpecies) {
        return {
          kind: 'useMove',
          moveIndex: availableMoves[rng.nextInt(0, availableMoves.length - 1)]!,
        };
      }

      // Check if switching would be beneficial
      const opponentSpecies = data.species.get(opponent.creature.speciesId);
      if (opponentSpecies) {
        const teamAlive = state.opponentSide.team
          .map((c, i) => ({ creature: c, index: i }))
          .filter(
            (e) =>
              e.creature.currentHp > 0 &&
              e.index !== state.opponentSide.teamIndex,
          );

        if (teamAlive.length > 0 && rng.nextFloat() < 0.3) {
          // 30% chance to consider switching
          for (const entry of teamAlive) {
            const altSpecies = data.species.get(entry.creature.speciesId);
            if (!altSpecies) continue;
            // Check if alt has type advantage
            for (const type of altSpecies.types) {
              const eff = getEffectiveness(
                data.effectivenessChart,
                type,
                playerSpecies.types,
              );
              if (eff > 1) {
                return { kind: 'switchCreature', teamIndex: entry.index };
              }
            }
          }
        }
      }

      // Fall back to tactical move selection
      let bestMove = availableMoves[0]!;
      let bestScore = -1;

      for (const i of availableMoves) {
        const moveId = opponent.creature.moveIds[i];
        if (!moveId) continue;
        const move = data.moves.get(moveId);
        if (!move) continue;

        const eff = getEffectiveness(
          data.effectivenessChart,
          move.type,
          playerSpecies.types,
        );
        const power = move.power * eff;
        if (power > bestScore) {
          bestScore = power;
          bestMove = i;
        }
      }

      return { kind: 'useMove', moveIndex: bestMove };
    }
  }
}
