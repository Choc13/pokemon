import type {
  GameState,
  GameAction,
  GameUpdate,
  GameEvent,
  GameData,
  PlayerState,
  GameSettings,
  SaveFile,
} from '../types/game-state.js';
import type { Creature } from '../types/creature.js';
import type { StoryState, FactionId } from '../types/story.js';
import type { LocationId, TimeOfDay } from '../types/world.js';
import { initBattle, resolveTurn, chooseOpponentAction } from '../engines/battle-engine.js';
import { advanceStory, advanceStoryAfterBattle } from '../engines/narrative-engine.js';
import {
  getLocation,
  getAccessibleConnections,
  rollEncounter,
  generateWildCreature,
  healTeam,
  buyItem,
} from '../engines/world-engine.js';
import { computeStats } from '../helpers/stats.js';
import { applyXpGain } from '../helpers/creature-helpers.js';
import type { Rng } from '../engines/rng.js';

export function updateGame(
  state: GameState,
  action: GameAction,
  rng: Rng,
  data: GameData,
): GameUpdate {
  switch (state.phase) {
    case 'exploring':
      return handleExploring(state, action, rng, data);
    case 'inBattle':
      return handleBattle(state, action, rng, data);
    case 'inDialogue':
      return handleDialogue(state, action, rng, data);
    case 'inMenu':
      return handleMenu(state, action, data);
    case 'inShop':
      return handleShop(state, action, data);
    default:
      return { state, events: [] };
  }
}

function handleExploring(
  state: GameState,
  action: GameAction,
  rng: Rng,
  data: GameData,
): GameUpdate {
  const events: GameEvent[] = [];

  switch (action.kind) {
    case 'move': {
      const location = getLocation(data.worldMap, state.player.currentLocationId);
      if (!location) return { state, events };

      const connections = getAccessibleConnections(
        data.worldMap,
        state.player.currentLocationId,
        state.player.storyState.flags,
        state.player.inventory,
      );
      const connection = connections.find((c) => c.direction === action.direction);

      if (connection) {
        const newPlayer: PlayerState = {
          ...state.player,
          currentLocationId: connection.targetLocationId,
          position: { x: 0, y: 0 },
          stepsSinceEncounter: 0,
        };
        events.push({ kind: 'locationChanged', locationId: connection.targetLocationId });
        return { state: { ...state, player: newPlayer }, events };
      }

      const dx = action.direction === 'left' ? -1 : action.direction === 'right' ? 1 : 0;
      const dy = action.direction === 'up' ? -1 : action.direction === 'down' ? 1 : 0;
      const newPos = {
        x: Math.max(0, Math.min(location.width - 1, state.player.position.x + dx)),
        y: Math.max(0, Math.min(location.height - 1, state.player.position.y + dy)),
      };

      const newSteps = state.player.stepsSinceEncounter + 1;
      let newPlayer: PlayerState = { ...state.player, position: newPos, stepsSinceEncounter: newSteps };

      const encounter = rollEncounter(location, state.player.storyState.flags, 'day' as TimeOfDay, rng, newSteps);
      if (encounter) {
        const species = data.species.get(encounter.speciesId);
        if (species) {
          const wildCreature = generateWildCreature(encounter, species, data.moves, rng);
          const battle = initBattle(state.player.team, [wildCreature], true, data);
          const seen = new Set(newPlayer.creatureLog.seen);
          seen.add(encounter.speciesId);
          newPlayer = { ...newPlayer, stepsSinceEncounter: 0, creatureLog: { ...newPlayer.creatureLog, seen } };
          events.push({ kind: 'encounterStarted', creature: wildCreature }, { kind: 'battleStarted' });
          return { state: { ...state, phase: 'inBattle', player: newPlayer, battle }, events };
        }
      }
      return { state: { ...state, player: newPlayer }, events };
    }

    case 'interact': {
      const location = getLocation(data.worldMap, state.player.currentLocationId);
      if (!location) return { state, events };

      const npcsAtPos = location.npcs.filter(
        (npc) => Math.abs(npc.position.x - state.player.position.x) <= 1 && Math.abs(npc.position.y - state.player.position.y) <= 1,
      );
      if (npcsAtPos.length > 0) {
        const npc = npcsAtPos[0]!;
        if (npc.interaction.kind === 'dialogue' || npc.interaction.kind === 'trainer') {
          const storyNodeId = npc.interaction.storyNodeId;
          const newStoryState: StoryState = { ...state.player.storyState, currentNodeId: storyNodeId };
          return {
            state: { ...state, phase: 'inDialogue', player: { ...state.player, storyState: newStoryState }, activeStoryNodeId: storyNodeId },
            events: [{ kind: 'storyAdvanced', nodeId: storyNodeId }],
          };
        }
        if (npc.interaction.kind === 'service') {
          if (npc.interaction.serviceType.kind === 'healingCenter') {
            const healed = healTeam(state.player.team, data.species);
            return { state: { ...state, player: { ...state.player, team: healed } }, events: [{ kind: 'notification', message: 'Your team has been healed!' }] };
          }
          if (npc.interaction.serviceType.kind === 'shop') {
            return { state: { ...state, phase: 'inShop' }, events: [] };
          }
        }
      }
      return { state, events };
    }

    case 'openMenu':
      return { state: { ...state, phase: 'inMenu' }, events };

    default:
      return { state, events };
  }
}

function handleBattle(state: GameState, action: GameAction, rng: Rng, data: GameData): GameUpdate {
  if (action.kind !== 'battleAction' || !state.battle) return { state, events: [] };

  const battle = state.battle;
  const difficulty = battle.isWild ? ('naive' as const) : ('tactical' as const);
  const opponentAction = chooseOpponentAction(battle, difficulty, rng, data);
  const resolution = resolveTurn(battle, action.action, opponentAction, rng, data);
  const events: GameEvent[] = [];

  if (resolution.state.phase === 'ended') {
    const lastEvent = resolution.events[resolution.events.length - 1];
    const result = lastEvent?.kind === 'battleEnd' ? lastEvent.result : 'playerWin';
    let newPlayer = state.player;

    if (result === 'playerWin') {
      const opponent = battle.opponentSide.active.creature;
      const opponentSpecies = data.species.get(opponent.speciesId);
      const xpGain = opponentSpecies ? Math.floor((opponentSpecies.baseExpYield * opponent.level) / 7) : 50;
      const updatedTeam = newPlayer.team.map((creature) => {
        if (creature.currentHp <= 0) return creature;
        const species = data.species.get(creature.speciesId);
        if (!species) return creature;
        return applyXpGain(creature, xpGain, species, data.moves).creature;
      });
      newPlayer = { ...newPlayer, team: updatedTeam };
    }

    if (result === 'captured') {
      const captured = battle.opponentSide.active.creature;
      const caught = new Set(newPlayer.creatureLog.caught);
      caught.add(captured.speciesId);
      if (newPlayer.team.length < 6) {
        newPlayer = { ...newPlayer, team: [...newPlayer.team, captured], creatureLog: { ...newPlayer.creatureLog, caught } };
      } else {
        newPlayer = { ...newPlayer, storage: [...newPlayer.storage, captured], creatureLog: { ...newPlayer.creatureLog, caught } };
      }
      events.push({ kind: 'creatureJoined', creature: captured });
    }

    const battleTeam = resolution.state.playerSide.team;
    newPlayer = {
      ...newPlayer,
      team: newPlayer.team.map((c, i) => {
        const bc = battleTeam[i];
        return bc ? { ...c, currentHp: bc.currentHp, status: bc.status, movePp: bc.movePp } : c;
      }),
    };

    if (state.activeStoryNodeId) {
      newPlayer = { ...newPlayer, storyState: advanceStoryAfterBattle(newPlayer.storyState, data.storyGraph, result === 'playerWin') };
    }

    events.push({ kind: 'battleEnded', result });
    return { state: { ...state, phase: state.activeStoryNodeId ? 'inDialogue' : 'exploring', player: newPlayer, battle: null }, events };
  }

  return { state: { ...state, battle: resolution.state }, events };
}

function handleDialogue(state: GameState, action: GameAction, rng: Rng, data: GameData): GameUpdate {
  if (action.kind !== 'dialogueAdvance' && action.kind !== 'dialogueChoice') return { state, events: [] };
  const choiceIndex = action.kind === 'dialogueChoice' ? action.choiceIndex : undefined;
  const result = advanceStory(state.player.storyState, state.player, data.storyGraph, choiceIndex);

  let newState: GameState = {
    ...state,
    player: { ...result.playerState, storyState: result.state },
    activeStoryNodeId: result.state.currentNodeId,
  };

  if (result.completed || !result.state.currentNodeId) {
    newState = { ...newState, phase: 'exploring', activeStoryNodeId: null };
  }

  if (result.node.kind === 'battle') {
    const trainerTeam: Creature[] = result.node.trainerData.team.map((t, i) => {
      const species = data.species.get(t.speciesId);
      const creature: Creature = {
        id: `trainer-${i}`, speciesId: t.speciesId, nickname: null, level: t.level, xp: 0,
        nature: 'hardy', ivs: { hp: 15, attack: 15, defense: 15, specialAttack: 15, specialDefense: 15, speed: 15 },
        evs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
        currentHp: 0, status: { kind: 'none' }, moveIds: t.moveIds,
        movePp: t.moveIds.map((mid) => data.moves.get(mid)?.pp ?? 10),
        bond: 0, isShiny: false, originalTrainer: result.node.kind === 'battle' ? result.node.trainerData.name : 'NPC',
      };
      if (species) {
        const stats = computeStats(species, creature);
        return { ...creature, currentHp: stats.hp };
      }
      return { ...creature, currentHp: 50 };
    });

    const battle = initBattle(state.player.team, trainerTeam, false, data);
    newState = { ...newState, phase: 'inBattle', battle };
  }

  return { state: newState, events: result.state.currentNodeId ? [{ kind: 'storyAdvanced', nodeId: result.state.currentNodeId }] : [] };
}

function handleMenu(state: GameState, action: GameAction, data: GameData): GameUpdate {
  switch (action.kind) {
    case 'closeMenu':
      return { state: { ...state, phase: 'exploring' }, events: [] };
    case 'useItem': {
      const item = data.items.get(action.itemId);
      if (!item) return { state, events: [] };
      const creature = state.player.team[action.targetCreatureIndex];
      if (!creature) return { state, events: [] };

      if (item.effect.kind === 'healHp') {
        const species = data.species.get(creature.speciesId);
        if (!species) return { state, events: [] };
        const maxHp = computeStats(species, creature).hp;
        const newHp = Math.min(maxHp, creature.currentHp + item.effect.amount);
        const team = state.player.team.map((c, i) => i === action.targetCreatureIndex ? { ...c, currentHp: newHp } : c);
        const inventory = state.player.inventory.map((e) => e.itemId === action.itemId ? { ...e, quantity: e.quantity - 1 } : e).filter((e) => e.quantity > 0);
        return { state: { ...state, player: { ...state.player, team, inventory } }, events: [] };
      }
      if (item.effect.kind === 'healStatus') {
        const team = state.player.team.map((c, i) => i === action.targetCreatureIndex ? { ...c, status: { kind: 'none' as const } } : c);
        const inventory = state.player.inventory.map((e) => e.itemId === action.itemId ? { ...e, quantity: e.quantity - 1 } : e).filter((e) => e.quantity > 0);
        return { state: { ...state, player: { ...state.player, team, inventory } }, events: [] };
      }
      return { state, events: [] };
    }
    case 'switchPartyOrder': {
      const team = [...state.player.team];
      const temp = team[action.from];
      if (!temp || !team[action.to]) return { state, events: [] };
      team[action.from] = team[action.to]!;
      team[action.to] = temp;
      return { state: { ...state, player: { ...state.player, team } }, events: [] };
    }
    default:
      return { state, events: [] };
  }
}

function handleShop(state: GameState, action: GameAction, data: GameData): GameUpdate {
  if (action.kind === 'closeMenu') return { state: { ...state, phase: 'exploring' }, events: [] };
  if (action.kind === 'useItem') {
    const item = data.items.get(action.itemId);
    if (!item) return { state, events: [] };
    const result = buyItem(state.player.inventory, state.player.money, item.id, item.price, 1);
    if (!result) return { state, events: [] };
    return { state: { ...state, player: { ...state.player, inventory: result.inventory, money: result.money } }, events: [{ kind: 'itemReceived', itemId: item.id, quantity: 1 }] };
  }
  return { state, events: [] };
}

export function createSaveFile(playerState: PlayerState, settings: GameSettings, slot: number): SaveFile {
  return { version: 1, slot, player: playerState, settings, timestamp: Date.now(), playTime: playerState.playTime };
}

export function loadSaveFile(saveFile: SaveFile): { player: PlayerState; settings: GameSettings } {
  return { player: saveFile.player, settings: saveFile.settings };
}

export function createInitialPlayerState(
  name: string, starterCreature: Creature, startLocationId: LocationId, storyStartNodeId: string,
): PlayerState {
  return {
    name, team: [starterCreature], storage: [], inventory: [{ itemId: 'befriend-crystal', quantity: 5 }, { itemId: 'potion', quantity: 3 }],
    money: 1000, currentLocationId: startLocationId, position: { x: 5, y: 5 },
    storyState: { currentNodeId: storyStartNodeId, flags: new Set(), factionStanding: new Map<FactionId, number>([['harmony', 0], ['liberation', 0], ['dominion', 0]]), completedNodes: new Set() },
    creatureLog: { seen: new Set([starterCreature.speciesId]), caught: new Set([starterCreature.speciesId]) },
    badges: [], playTime: 0, stepsSinceEncounter: 0,
  };
}

export function createInitialGameState(player: PlayerState): GameState {
  return { phase: 'exploring', player, battle: null, activeStoryNodeId: null, settings: { textSpeed: 'medium', musicVolume: 0.7, sfxVolume: 0.8, reducedMotion: false } };
}
