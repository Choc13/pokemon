import type {
  StoryGraph,
  StoryNode,
  StoryState,
  StoryCondition,
  StoryEffect,
  FactionId,
  StoryNodeId,
} from '../types/story.js';
import type { PlayerState } from '../types/game-state.js';

export interface StoryAdvanceResult {
  readonly state: StoryState;
  readonly playerState: PlayerState;
  readonly node: StoryNode;
  readonly completed: boolean;
}

// ---- Condition Evaluator ----

export function evaluateCondition(
  condition: StoryCondition,
  storyState: StoryState,
  playerState: PlayerState,
): boolean {
  switch (condition.kind) {
    case 'hasFlag':
      return storyState.flags.has(condition.flag);

    case 'lacksFlag':
      return !storyState.flags.has(condition.flag);

    case 'factionAbove': {
      const standing = storyState.factionStanding.get(condition.faction) ?? 0;
      return standing > condition.threshold;
    }

    case 'factionBelow': {
      const standing = storyState.factionStanding.get(condition.faction) ?? 0;
      return standing < condition.threshold;
    }

    case 'hasCreature':
      return playerState.team.some((c) => c.speciesId === condition.speciesId) ||
        playerState.storage.some((c) => c.speciesId === condition.speciesId);

    case 'bondAbove': {
      const creature = playerState.team.find((c) => c.speciesId === condition.speciesId) ??
        playerState.storage.find((c) => c.speciesId === condition.speciesId);
      return creature !== undefined && creature.bond > condition.threshold;
    }

    case 'itemInInventory':
      return playerState.inventory.some((e) => e.itemId === condition.itemId && e.quantity > 0);

    case 'and':
      return condition.conditions.every((c) => evaluateCondition(c, storyState, playerState));

    case 'or':
      return condition.conditions.some((c) => evaluateCondition(c, storyState, playerState));
  }
}

// ---- Story Advancement ----

export function advanceStory(
  storyState: StoryState,
  playerState: PlayerState,
  graph: StoryGraph,
  choiceIndex?: number,
): StoryAdvanceResult {
  const nodeId = storyState.currentNodeId;
  if (!nodeId) {
    return {
      state: storyState,
      playerState,
      node: { kind: 'ending', id: 'null', endingType: 'error', description: 'No active node' },
      completed: true,
    };
  }

  const node = graph.nodes.get(nodeId);
  if (!node) {
    return {
      state: storyState,
      playerState,
      node: { kind: 'ending', id: nodeId, endingType: 'error', description: 'Node not found' },
      completed: true,
    };
  }

  const completedNodes = new Set(storyState.completedNodes);
  completedNodes.add(nodeId);

  switch (node.kind) {
    case 'dialogue': {
      const newState: StoryState = {
        ...storyState,
        currentNodeId: node.next,
        completedNodes,
      };
      return { state: newState, playerState, node, completed: false };
    }

    case 'choice': {
      // Filter visible choices
      const visibleChoices = node.choices.filter((choice) => {
        if (!choice.requiredFlags || choice.requiredFlags.length === 0) return true;
        return choice.requiredFlags.every((flag) => storyState.flags.has(flag));
      });

      const selectedIndex = choiceIndex ?? 0;
      const selected = visibleChoices[selectedIndex];

      if (!selected) {
        return { state: storyState, playerState, node, completed: false };
      }

      // Apply effects
      let updatedPlayerState = playerState;
      let updatedStoryState: StoryState = {
        ...storyState,
        completedNodes,
      };

      if (selected.effects) {
        const result = applyStoryEffects(selected.effects, updatedPlayerState, updatedStoryState);
        updatedPlayerState = result.playerState;
        updatedStoryState = result.storyState;
      }

      updatedStoryState = {
        ...updatedStoryState,
        currentNodeId: selected.target,
      };

      return {
        state: updatedStoryState,
        playerState: updatedPlayerState,
        node,
        completed: false,
      };
    }

    case 'battle': {
      // Battle node returns itself — the game loop must trigger the battle
      // After battle, advanceStory should be called again with the result
      return { state: { ...storyState, completedNodes }, playerState, node, completed: false };
    }

    case 'event': {
      const result = applyStoryEffects(node.effects, playerState, {
        ...storyState,
        completedNodes,
      });
      const newState: StoryState = {
        ...result.storyState,
        currentNodeId: node.next,
      };
      return {
        state: newState,
        playerState: result.playerState,
        node,
        completed: false,
      };
    }

    case 'branch': {
      for (const branch of node.branches) {
        if (evaluateCondition(branch.condition, storyState, playerState)) {
          const newState: StoryState = {
            ...storyState,
            currentNodeId: branch.target,
            completedNodes,
          };
          return { state: newState, playerState, node, completed: false };
        }
      }
      // Fallback
      const newState: StoryState = {
        ...storyState,
        currentNodeId: node.fallback,
        completedNodes,
      };
      return { state: newState, playerState, node, completed: false };
    }

    case 'ending': {
      const newState: StoryState = {
        ...storyState,
        currentNodeId: null,
        completedNodes,
      };
      return { state: newState, playerState, node, completed: true };
    }
  }
}

// ---- Effect Application ----

export function applyStoryEffects(
  effects: readonly StoryEffect[],
  playerState: PlayerState,
  storyState: StoryState,
): { playerState: PlayerState; storyState: StoryState } {
  let ps = playerState;
  let ss = storyState;

  for (const effect of effects) {
    const result = applySingleEffect(effect, ps, ss);
    ps = result.playerState;
    ss = result.storyState;
  }

  return { playerState: ps, storyState: ss };
}

function applySingleEffect(
  effect: StoryEffect,
  playerState: PlayerState,
  storyState: StoryState,
): { playerState: PlayerState; storyState: StoryState } {
  switch (effect.kind) {
    case 'setFlag': {
      const flags = new Set(storyState.flags);
      flags.add(effect.flag);
      return { playerState, storyState: { ...storyState, flags } };
    }

    case 'removeFlag': {
      const flags = new Set(storyState.flags);
      flags.delete(effect.flag);
      return { playerState, storyState: { ...storyState, flags } };
    }

    case 'giveItem': {
      const inventory = [...playerState.inventory];
      const existing = inventory.findIndex((e) => e.itemId === effect.itemId);
      if (existing >= 0) {
        inventory[existing] = {
          itemId: effect.itemId,
          quantity: inventory[existing]!.quantity + effect.quantity,
        };
      } else {
        inventory.push({ itemId: effect.itemId, quantity: effect.quantity });
      }
      return { playerState: { ...playerState, inventory }, storyState };
    }

    case 'giveCreature': {
      // Creates a placeholder creature — full creation requires species data
      // The game loop should intercept this and create a proper creature
      return { playerState, storyState };
    }

    case 'heal': {
      const team = playerState.team.map((c) => ({
        ...c,
        currentHp: 999, // Will be clamped by the game loop to max HP
        status: { kind: 'none' as const },
      }));
      return { playerState: { ...playerState, team }, storyState };
    }

    case 'teleport': {
      return {
        playerState: {
          ...playerState,
          currentLocationId: effect.locationId,
          position: { x: 0, y: 0 },
        },
        storyState,
      };
    }

    case 'adjustFaction': {
      const standings = new Map(storyState.factionStanding);
      const current = standings.get(effect.faction) ?? 0;
      standings.set(effect.faction, current + effect.amount);
      return { playerState, storyState: { ...storyState, factionStanding: standings } };
    }

    case 'setWeather':
    case 'evolveCreature':
      // Handled by the game loop
      return { playerState, storyState };
  }
}

// ---- Story Advancement After Battle ----

export function advanceStoryAfterBattle(
  storyState: StoryState,
  graph: StoryGraph,
  won: boolean,
): StoryState {
  const nodeId = storyState.currentNodeId;
  if (!nodeId) return storyState;

  const node = graph.nodes.get(nodeId);
  if (!node || node.kind !== 'battle') return storyState;

  return {
    ...storyState,
    currentNodeId: won ? node.onWin : node.onLose,
  };
}
