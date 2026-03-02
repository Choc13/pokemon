import { describe, it, expect } from 'vitest';
import {
  getLocation,
  getAccessibleConnections,
  rollEncounter,
  getVisibleNpcs,
  healTeam,
  buyItem,
  sellItem,
} from '../src/engines/world-engine';
import type { WorldMap, Location, Connection } from '../src/types/world';
import type { Creature, Species } from '../src/types/creature';
import { computeStats } from '../src/helpers/stats';
import { createRng } from '../src/engines/rng';

const testLocation: Location = {
  id: 'test-town', name: 'Test Town', description: 'A test town', type: 'town',
  encounters: [
    { speciesId: 'test-species', minLevel: 3, maxLevel: 5, weight: 100 },
  ],
  npcs: [
    { id: 'npc-1', name: 'Visible NPC', sprite: 's', position: { x: 3, y: 3 }, interaction: { kind: 'dialogue', storyNodeId: 'test' } },
    { id: 'npc-2', name: 'Gated NPC', sprite: 's', position: { x: 5, y: 5 }, visibleWhen: ['has-key'], interaction: { kind: 'dialogue', storyNodeId: 'test' } },
    { id: 'npc-3', name: 'Hidden NPC', sprite: 's', position: { x: 7, y: 7 }, hiddenWhen: ['defeated'], interaction: { kind: 'dialogue', storyNodeId: 'test' } },
  ],
  services: [], music: '', tilemap: '', width: 10, height: 10,
};

const testMap: WorldMap = {
  locations: new Map([['test-town', testLocation], ['route-1', { ...testLocation, id: 'route-1', name: 'Route 1' }]]),
  connections: new Map([
    ['test-town', [
      { targetLocationId: 'route-1', direction: 'right', description: 'East' },
      { targetLocationId: 'locked-area', direction: 'up', requiredFlags: ['has-key'], description: 'North (locked)' },
    ]],
  ]),
};

describe('getLocation', () => {
  it('should return the location for valid id', () => {
    expect(getLocation(testMap, 'test-town')?.name).toBe('Test Town');
  });

  it('should return undefined for invalid id', () => {
    expect(getLocation(testMap, 'nonexistent')).toBeUndefined();
  });
});

describe('getAccessibleConnections', () => {
  it('should return ungated connections', () => {
    const conns = getAccessibleConnections(testMap, 'test-town', new Set(), []);
    expect(conns.length).toBe(1);
    expect(conns[0]!.targetLocationId).toBe('route-1');
  });

  it('should include gated connections when flag is present', () => {
    const conns = getAccessibleConnections(testMap, 'test-town', new Set(['has-key']), []);
    expect(conns.length).toBe(2);
  });

  it('should return empty for location with no connections', () => {
    const conns = getAccessibleConnections(testMap, 'route-1', new Set(), []);
    expect(conns.length).toBe(0);
  });
});

describe('getVisibleNpcs', () => {
  it('should return unconditional NPCs', () => {
    const npcs = getVisibleNpcs(testLocation, new Set());
    expect(npcs.some((n) => n.id === 'npc-1')).toBe(true);
  });

  it('should hide NPCs requiring flags', () => {
    const npcs = getVisibleNpcs(testLocation, new Set());
    expect(npcs.some((n) => n.id === 'npc-2')).toBe(false);
  });

  it('should show NPCs when required flags are present', () => {
    const npcs = getVisibleNpcs(testLocation, new Set(['has-key']));
    expect(npcs.some((n) => n.id === 'npc-2')).toBe(true);
  });

  it('should hide NPCs when hiddenWhen flags are present', () => {
    const npcs = getVisibleNpcs(testLocation, new Set(['defeated']));
    expect(npcs.some((n) => n.id === 'npc-3')).toBe(false);
  });
});

describe('rollEncounter', () => {
  it('should eventually return an encounter with enough steps', () => {
    const rng = createRng(42);
    let found = false;
    for (let i = 0; i < 100; i++) {
      const result = rollEncounter(testLocation, new Set(), 'day', rng, 20);
      if (result) {
        found = true;
        expect(result.speciesId).toBe('test-species');
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('should return null for locations with no encounters', () => {
    const emptyLocation = { ...testLocation, encounters: [] };
    const rng = createRng(42);
    const result = rollEncounter(emptyLocation, new Set(), 'day', rng, 50);
    expect(result).toBeNull();
  });
});

describe('buyItem', () => {
  it('should add item and deduct money', () => {
    const result = buyItem([], 1000, 'potion', 200, 1);
    expect(result).not.toBeNull();
    expect(result!.money).toBe(800);
    expect(result!.inventory).toHaveLength(1);
    expect(result!.inventory[0]!.quantity).toBe(1);
  });

  it('should return null if not enough money', () => {
    const result = buyItem([], 100, 'potion', 200, 1);
    expect(result).toBeNull();
  });

  it('should stack existing items', () => {
    const result = buyItem([{ itemId: 'potion', quantity: 3 }], 1000, 'potion', 200, 2);
    expect(result!.inventory[0]!.quantity).toBe(5);
    expect(result!.money).toBe(600);
  });
});

describe('sellItem', () => {
  it('should remove item and add money', () => {
    const result = sellItem([{ itemId: 'potion', quantity: 3 }], 500, 'potion', 100, 1);
    expect(result).not.toBeNull();
    expect(result!.money).toBe(600);
    expect(result!.inventory[0]!.quantity).toBe(2);
  });

  it('should remove entry when quantity reaches 0', () => {
    const result = sellItem([{ itemId: 'potion', quantity: 1 }], 500, 'potion', 100, 1);
    expect(result!.inventory).toHaveLength(0);
  });

  it('should return null if not enough items', () => {
    const result = sellItem([{ itemId: 'potion', quantity: 1 }], 500, 'potion', 100, 5);
    expect(result).toBeNull();
  });
});
