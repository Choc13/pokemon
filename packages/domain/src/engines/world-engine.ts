import type {
  WorldMap,
  Location,
  Connection,
  LocationId,
  WildEncounterEntry,
  TimeOfDay,
  Npc,
} from '../types/world.js';
import type { Creature, Species } from '../types/creature.js';
import { NATURES } from '../types/creature.js';
import type { Move } from '../types/move.js';
import type { InventoryEntry } from '../types/item.js';
import { createCreature } from '../helpers/creature-helpers.js';
import { computeStats } from '../helpers/stats.js';
import type { Rng } from './rng.js';

// ---- Map Graph ----

export function getLocation(map: WorldMap, locationId: LocationId): Location | undefined {
  return map.locations.get(locationId);
}

export function getAccessibleConnections(
  map: WorldMap,
  currentLocation: LocationId,
  storyFlags: ReadonlySet<string>,
  inventory: readonly InventoryEntry[],
): readonly Connection[] {
  const connections = map.connections.get(currentLocation);
  if (!connections) return [];

  return connections.filter((conn) => {
    if (conn.requiredFlags && conn.requiredFlags.length > 0) {
      if (!conn.requiredFlags.every((flag) => storyFlags.has(flag))) return false;
    }
    if (conn.requiredItems && conn.requiredItems.length > 0) {
      if (
        !conn.requiredItems.every((itemId) =>
          inventory.some((e) => e.itemId === itemId && e.quantity > 0),
        )
      )
        return false;
    }
    return true;
  });
}

// ---- Encounter System ----

export function rollEncounter(
  location: Location,
  storyFlags: ReadonlySet<string>,
  timeOfDay: TimeOfDay,
  rng: Rng,
  stepsSinceEncounter: number,
): WildEncounterEntry | null {
  if (location.encounters.length === 0) return null;

  // Encounter probability increases with steps
  const baseRate = 0.1;
  const encounterChance = Math.min(0.9, baseRate + stepsSinceEncounter * 0.02);

  if (rng.nextFloat() > encounterChance) return null;

  // Filter eligible encounters
  const eligible = location.encounters.filter((e) => {
    if (e.requiredFlag && !storyFlags.has(e.requiredFlag)) return false;
    if (e.timeOfDay && e.timeOfDay.length > 0 && !e.timeOfDay.includes(timeOfDay)) return false;
    return true;
  });

  if (eligible.length === 0) return null;

  // Weighted random selection
  const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);
  let roll = rng.nextFloat() * totalWeight;

  for (const entry of eligible) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }

  return eligible[eligible.length - 1] ?? null;
}

export function generateWildCreature(
  entry: WildEncounterEntry,
  species: Species,
  allMoves: ReadonlyMap<string, Move>,
  rng: Rng,
): Creature {
  const level = rng.nextInt(entry.minLevel, entry.maxLevel);

  // Random IVs (0-31)
  const ivs = {
    hp: rng.nextInt(0, 31),
    attack: rng.nextInt(0, 31),
    defense: rng.nextInt(0, 31),
    specialAttack: rng.nextInt(0, 31),
    specialDefense: rng.nextInt(0, 31),
    speed: rng.nextInt(0, 31),
  };

  // Pick nature randomly
  const nature = NATURES[rng.nextInt(0, NATURES.length - 1)] as Creature['nature'];

  // Pick moves: up to 4 highest-level moves the creature can learn at this level
  const learnableMoveIds = species.learnableMoves
    .filter((lm) => lm.learnMethod.kind === 'levelUp' && lm.learnMethod.level <= level)
    .sort((a, b) => {
      const aLevel = a.learnMethod.kind === 'levelUp' ? a.learnMethod.level : 0;
      const bLevel = b.learnMethod.kind === 'levelUp' ? b.learnMethod.level : 0;
      return bLevel - aLevel;
    })
    .slice(0, 4)
    .map((lm) => lm.moveId);

  const movePp = learnableMoveIds.map((id) => {
    const move = allMoves.get(id);
    return move?.pp ?? 10;
  });

  const id = `wild-${species.id}-${rng.nextInt(0, 99999)}`;

  return createCreature(id, species, level, nature, ivs, learnableMoveIds, movePp, rng);
}

// ---- NPC System ----

export function getVisibleNpcs(
  location: Location,
  storyFlags: ReadonlySet<string>,
): readonly Npc[] {
  return location.npcs.filter((npc) => {
    if (npc.visibleWhen && npc.visibleWhen.length > 0) {
      if (!npc.visibleWhen.every((flag) => storyFlags.has(flag))) return false;
    }
    if (npc.hiddenWhen && npc.hiddenWhen.length > 0) {
      if (npc.hiddenWhen.some((flag) => storyFlags.has(flag))) return false;
    }
    return true;
  });
}

export function isTrainerDefeated(npc: Npc, storyFlags: ReadonlySet<string>): boolean {
  if (npc.interaction.kind !== 'trainer') return false;
  return storyFlags.has(npc.interaction.trainerData.defeatFlag);
}

// ---- Location Services ----

export function healTeam(team: readonly Creature[], speciesMap: ReadonlyMap<string, Species>): readonly Creature[] {
  return team.map((creature) => {
    const species = speciesMap.get(creature.speciesId);
    if (!species) return creature;

    const maxHp = computeStats(species, creature).hp;

    return {
      ...creature,
      currentHp: maxHp,
      status: { kind: 'none' as const },
      movePp: creature.moveIds.map((moveId) => {
        // Restore PP to max — we'd need move data here ideally
        return creature.movePp[creature.moveIds.indexOf(moveId)] ?? 10;
      }),
    };
  });
}

export function buyItem(
  inventory: readonly InventoryEntry[],
  money: number,
  itemId: string,
  price: number,
  quantity: number,
): { inventory: readonly InventoryEntry[]; money: number } | null {
  const totalCost = price * quantity;
  if (money < totalCost) return null;

  const updated = [...inventory];
  const existing = updated.findIndex((e) => e.itemId === itemId);
  if (existing >= 0) {
    updated[existing] = {
      itemId,
      quantity: updated[existing]!.quantity + quantity,
    };
  } else {
    updated.push({ itemId, quantity });
  }

  return { inventory: updated, money: money - totalCost };
}

export function sellItem(
  inventory: readonly InventoryEntry[],
  money: number,
  itemId: string,
  sellPrice: number,
  quantity: number,
): { inventory: readonly InventoryEntry[]; money: number } | null {
  const updated = [...inventory];
  const existing = updated.findIndex((e) => e.itemId === itemId);
  if (existing < 0 || updated[existing]!.quantity < quantity) return null;

  const newQuantity = updated[existing]!.quantity - quantity;
  if (newQuantity <= 0) {
    updated.splice(existing, 1);
  } else {
    updated[existing] = { itemId, quantity: newQuantity };
  }

  return { inventory: updated, money: money + sellPrice * quantity };
}
