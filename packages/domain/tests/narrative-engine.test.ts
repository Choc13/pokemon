import { describe, it, expect } from 'vitest';
import {
  evaluateCondition,
  advanceStory,
  applyStoryEffects,
  advanceStoryAfterBattle,
} from '../src/engines/narrative-engine';
import type { StoryGraph, StoryNode, StoryState, StoryCondition, FactionId } from '../src/types/story';
import type { PlayerState } from '../src/types/game-state';

function makePlayerState(): PlayerState {
  return {
    name: 'Test', team: [], storage: [],
    inventory: [{ itemId: 'potion', quantity: 3 }],
    money: 1000, currentLocationId: 'test', position: { x: 0, y: 0 },
    storyState: {
      currentNodeId: null,
      flags: new Set(['has-badge']),
      factionStanding: new Map<FactionId, number>([['harmony', 5], ['liberation', 0], ['dominion', 0]]),
      completedNodes: new Set(),
    },
    creatureLog: { seen: new Set(), caught: new Set() },
    badges: [], playTime: 0, stepsSinceEncounter: 0,
  };
}

function makeStoryGraph(): StoryGraph {
  const nodes = new Map<string, StoryNode>([
    ['node-1', { kind: 'dialogue', id: 'node-1', speaker: 'NPC', lines: ['Hello!', 'Welcome!'], next: 'node-2' }],
    ['node-2', { kind: 'choice', id: 'node-2', prompt: 'What do you choose?', choices: [
      { text: 'Option A', target: 'node-3', effects: [{ kind: 'setFlag', flag: 'chose-a' }] },
      { text: 'Option B', target: 'node-4', effects: [{ kind: 'setFlag', flag: 'chose-b' }] },
      { text: 'Secret Option', target: 'node-5', requiredFlags: ['secret-key'] },
    ]}],
    ['node-3', { kind: 'event', id: 'node-3', effects: [{ kind: 'giveItem', itemId: 'reward', quantity: 1 }], next: 'node-end' }],
    ['node-4', { kind: 'dialogue', id: 'node-4', speaker: 'NPC', lines: ['You chose B!'], next: 'node-end' }],
    ['node-5', { kind: 'dialogue', id: 'node-5', speaker: 'NPC', lines: ['Secret!'], next: 'node-end' }],
    ['node-end', { kind: 'ending', id: 'node-end', endingType: 'test', description: 'Test ending' }],
    ['branch-node', { kind: 'branch', id: 'branch-node', branches: [
      { condition: { kind: 'hasFlag', flag: 'has-badge' }, target: 'node-3' },
      { condition: { kind: 'factionAbove', faction: 'harmony', threshold: 10 }, target: 'node-4' },
    ], fallback: 'node-end' }],
    ['battle-node', { kind: 'battle', id: 'battle-node', trainerData: { name: 'Test', team: [{ speciesId: 'test', level: 5, moveIds: ['tackle'] }], difficulty: 'naive' }, onWin: 'node-3', onLose: 'node-4' }],
  ]);

  return { nodes, startNodeId: 'node-1' };
}

describe('evaluateCondition', () => {
  const ps = makePlayerState();
  const ss = ps.storyState;

  it('should evaluate hasFlag correctly', () => {
    expect(evaluateCondition({ kind: 'hasFlag', flag: 'has-badge' }, ss, ps)).toBe(true);
    expect(evaluateCondition({ kind: 'hasFlag', flag: 'no-flag' }, ss, ps)).toBe(false);
  });

  it('should evaluate lacksFlag correctly', () => {
    expect(evaluateCondition({ kind: 'lacksFlag', flag: 'no-flag' }, ss, ps)).toBe(true);
    expect(evaluateCondition({ kind: 'lacksFlag', flag: 'has-badge' }, ss, ps)).toBe(false);
  });

  it('should evaluate factionAbove correctly', () => {
    expect(evaluateCondition({ kind: 'factionAbove', faction: 'harmony', threshold: 3 }, ss, ps)).toBe(true);
    expect(evaluateCondition({ kind: 'factionAbove', faction: 'harmony', threshold: 10 }, ss, ps)).toBe(false);
  });

  it('should evaluate itemInInventory correctly', () => {
    expect(evaluateCondition({ kind: 'itemInInventory', itemId: 'potion' }, ss, ps)).toBe(true);
    expect(evaluateCondition({ kind: 'itemInInventory', itemId: 'none' }, ss, ps)).toBe(false);
  });

  it('should evaluate AND conditions correctly', () => {
    const cond: StoryCondition = {
      kind: 'and',
      conditions: [
        { kind: 'hasFlag', flag: 'has-badge' },
        { kind: 'itemInInventory', itemId: 'potion' },
      ],
    };
    expect(evaluateCondition(cond, ss, ps)).toBe(true);
  });

  it('should evaluate OR conditions correctly', () => {
    const cond: StoryCondition = {
      kind: 'or',
      conditions: [
        { kind: 'hasFlag', flag: 'no-flag' },
        { kind: 'itemInInventory', itemId: 'potion' },
      ],
    };
    expect(evaluateCondition(cond, ss, ps)).toBe(true);
  });

  it('should evaluate deeply nested conditions', () => {
    const cond: StoryCondition = {
      kind: 'and',
      conditions: [
        { kind: 'or', conditions: [
          { kind: 'hasFlag', flag: 'no-flag' },
          { kind: 'hasFlag', flag: 'has-badge' },
        ]},
        { kind: 'lacksFlag', flag: 'missing-flag' },
      ],
    };
    expect(evaluateCondition(cond, ss, ps)).toBe(true);
  });
});

describe('advanceStory', () => {
  it('should advance through dialogue nodes', () => {
    const graph = makeStoryGraph();
    const storyState: StoryState = {
      currentNodeId: 'node-1', flags: new Set(), factionStanding: new Map(), completedNodes: new Set(),
    };
    const ps = makePlayerState();

    const result = advanceStory(storyState, ps, graph);
    expect(result.state.currentNodeId).toBe('node-2');
    expect(result.node.kind).toBe('dialogue');
    expect(result.completed).toBe(false);
  });

  it('should handle choices and apply effects', () => {
    const graph = makeStoryGraph();
    const storyState: StoryState = {
      currentNodeId: 'node-2', flags: new Set(), factionStanding: new Map(), completedNodes: new Set(),
    };
    const ps = makePlayerState();

    const result = advanceStory(storyState, ps, graph, 0);
    expect(result.state.currentNodeId).toBe('node-3');
    expect(result.state.flags.has('chose-a')).toBe(true);
  });

  it('should filter choices by required flags', () => {
    const graph = makeStoryGraph();
    const storyState: StoryState = {
      currentNodeId: 'node-2', flags: new Set(), factionStanding: new Map(), completedNodes: new Set(),
    };
    const ps = makePlayerState();

    // Option index 2 (secret) should not be available without 'secret-key' flag
    // So choosing index 2 when filtered will fallback
    const result = advanceStory(storyState, ps, graph, 1);
    expect(result.state.currentNodeId).toBe('node-4');
    expect(result.state.flags.has('chose-b')).toBe(true);
  });

  it('should handle branch nodes', () => {
    const graph = makeStoryGraph();
    const storyState: StoryState = {
      currentNodeId: 'branch-node',
      flags: new Set(['has-badge']),
      factionStanding: new Map(),
      completedNodes: new Set(),
    };
    const ps = makePlayerState();

    const result = advanceStory(storyState, ps, graph);
    expect(result.state.currentNodeId).toBe('node-3'); // first condition matches
  });

  it('should use fallback for branch when no condition matches', () => {
    const graph = makeStoryGraph();
    const storyState: StoryState = {
      currentNodeId: 'branch-node',
      flags: new Set(),
      factionStanding: new Map(),
      completedNodes: new Set(),
    };
    const ps = { ...makePlayerState(), storyState: { currentNodeId: 'branch-node', flags: new Set(), factionStanding: new Map<FactionId, number>(), completedNodes: new Set() } };

    const result = advanceStory(ps.storyState, ps, graph);
    expect(result.state.currentNodeId).toBe('node-end');
  });

  it('should handle ending nodes', () => {
    const graph = makeStoryGraph();
    const storyState: StoryState = {
      currentNodeId: 'node-end', flags: new Set(), factionStanding: new Map(), completedNodes: new Set(),
    };
    const ps = makePlayerState();

    const result = advanceStory(storyState, ps, graph);
    expect(result.completed).toBe(true);
    expect(result.state.currentNodeId).toBeNull();
  });
});

describe('advanceStoryAfterBattle', () => {
  it('should advance to onWin node when player wins', () => {
    const graph = makeStoryGraph();
    const storyState: StoryState = {
      currentNodeId: 'battle-node', flags: new Set(), factionStanding: new Map(), completedNodes: new Set(),
    };

    const result = advanceStoryAfterBattle(storyState, graph, true);
    expect(result.currentNodeId).toBe('node-3');
  });

  it('should advance to onLose node when player loses', () => {
    const graph = makeStoryGraph();
    const storyState: StoryState = {
      currentNodeId: 'battle-node', flags: new Set(), factionStanding: new Map(), completedNodes: new Set(),
    };

    const result = advanceStoryAfterBattle(storyState, graph, false);
    expect(result.currentNodeId).toBe('node-4');
  });
});

describe('applyStoryEffects', () => {
  it('should set and remove flags', () => {
    const ps = makePlayerState();
    const ss: StoryState = { currentNodeId: null, flags: new Set(), factionStanding: new Map(), completedNodes: new Set() };

    const result = applyStoryEffects(
      [{ kind: 'setFlag', flag: 'new-flag' }],
      ps, ss,
    );
    expect(result.storyState.flags.has('new-flag')).toBe(true);

    const result2 = applyStoryEffects(
      [{ kind: 'removeFlag', flag: 'new-flag' }],
      result.playerState, result.storyState,
    );
    expect(result2.storyState.flags.has('new-flag')).toBe(false);
  });

  it('should give items', () => {
    const ps = makePlayerState();
    const ss: StoryState = { currentNodeId: null, flags: new Set(), factionStanding: new Map(), completedNodes: new Set() };

    const result = applyStoryEffects(
      [{ kind: 'giveItem', itemId: 'new-item', quantity: 3 }],
      ps, ss,
    );
    const entry = result.playerState.inventory.find((e) => e.itemId === 'new-item');
    expect(entry).toBeDefined();
    expect(entry!.quantity).toBe(3);
  });

  it('should adjust faction standing', () => {
    const ps = makePlayerState();
    const ss: StoryState = { currentNodeId: null, flags: new Set(), factionStanding: new Map([['harmony', 0]]), completedNodes: new Set() };

    const result = applyStoryEffects(
      [{ kind: 'adjustFaction', faction: 'harmony', amount: 10 }],
      ps, ss,
    );
    expect(result.storyState.factionStanding.get('harmony')).toBe(10);
  });
});
