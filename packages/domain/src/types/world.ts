import type { ElementalType } from './elemental.js';

export type LocationId = string;
export type Direction = 'up' | 'down' | 'left' | 'right';

export type LocationType = 'town' | 'route' | 'dungeon' | 'landmark';

export interface Location {
  readonly id: LocationId;
  readonly name: string;
  readonly description: string;
  readonly type: LocationType;
  readonly encounters: readonly WildEncounterEntry[];
  readonly npcs: readonly Npc[];
  readonly services: readonly LocationService[];
  readonly music: string;
  readonly tilemap: string;
  readonly width: number;
  readonly height: number;
}

export interface WildEncounterEntry {
  readonly speciesId: string;
  readonly minLevel: number;
  readonly maxLevel: number;
  readonly weight: number;
  readonly timeOfDay?: readonly TimeOfDay[];
  readonly requiredFlag?: string;
}

export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night';

export interface Connection {
  readonly targetLocationId: LocationId;
  readonly direction: Direction;
  readonly requiredFlags?: readonly string[];
  readonly requiredItems?: readonly string[];
  readonly description: string;
}

export interface WorldMap {
  readonly locations: ReadonlyMap<LocationId, Location>;
  readonly connections: ReadonlyMap<LocationId, readonly Connection[]>;
}

export type LocationService =
  | { readonly kind: 'healingCenter' }
  | { readonly kind: 'shop'; readonly inventory: readonly string[] }
  | { readonly kind: 'moveTutor'; readonly moves: readonly string[] };

export interface Npc {
  readonly id: string;
  readonly name: string;
  readonly sprite: string;
  readonly position: { readonly x: number; readonly y: number };
  readonly visibleWhen?: readonly string[];
  readonly hiddenWhen?: readonly string[];
  readonly interaction: NpcInteraction;
}

export type NpcInteraction =
  | { readonly kind: 'dialogue'; readonly storyNodeId: string }
  | { readonly kind: 'trainer'; readonly trainerData: TrainerData; readonly storyNodeId: string }
  | { readonly kind: 'service'; readonly serviceType: LocationService };

export interface TrainerData {
  readonly name: string;
  readonly team: readonly TrainerCreature[];
  readonly difficulty: AiDifficulty;
  readonly defeatFlag: string;
  readonly rematchable: boolean;
  readonly rewardMoney: number;
}

export interface TrainerCreature {
  readonly speciesId: string;
  readonly level: number;
  readonly moveIds: readonly string[];
  readonly nature?: string;
}

export type AiDifficulty = 'naive' | 'tactical' | 'strategic';
