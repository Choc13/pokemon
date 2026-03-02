import type { Creature } from './creature.js';
import type { BattleState, BattleAction } from './battle.js';
import type { StoryState } from './story.js';
import type { InventoryEntry } from './item.js';
import type { LocationId } from './world.js';

export type GamePhase =
  | 'exploring'
  | 'inBattle'
  | 'inDialogue'
  | 'inMenu'
  | 'inShop'
  | 'transition'
  | 'gameOver';

export interface PlayerState {
  readonly name: string;
  readonly team: readonly Creature[];
  readonly storage: readonly Creature[];
  readonly inventory: readonly InventoryEntry[];
  readonly money: number;
  readonly currentLocationId: LocationId;
  readonly position: { readonly x: number; readonly y: number };
  readonly storyState: StoryState;
  readonly creatureLog: CreatureLog;
  readonly badges: readonly string[];
  readonly playTime: number;
  readonly stepsSinceEncounter: number;
}

export interface CreatureLog {
  readonly seen: ReadonlySet<string>;
  readonly caught: ReadonlySet<string>;
}

export interface GameState {
  readonly phase: GamePhase;
  readonly player: PlayerState;
  readonly battle: BattleState | null;
  readonly activeStoryNodeId: string | null;
  readonly settings: GameSettings;
}

export interface GameSettings {
  readonly textSpeed: 'slow' | 'medium' | 'fast' | 'instant';
  readonly musicVolume: number;
  readonly sfxVolume: number;
  readonly reducedMotion: boolean;
}

export type GameAction =
  | { readonly kind: 'move'; readonly direction: 'up' | 'down' | 'left' | 'right' }
  | { readonly kind: 'interact' }
  | { readonly kind: 'openMenu' }
  | { readonly kind: 'closeMenu' }
  | { readonly kind: 'battleAction'; readonly action: BattleAction }
  | { readonly kind: 'dialogueAdvance' }
  | { readonly kind: 'dialogueChoice'; readonly choiceIndex: number }
  | { readonly kind: 'useItem'; readonly itemId: string; readonly targetCreatureIndex: number }
  | { readonly kind: 'switchPartyOrder'; readonly from: number; readonly to: number }
  | { readonly kind: 'saveGame'; readonly slot: number }
  | { readonly kind: 'loadGame'; readonly slot: number }
  | { readonly kind: 'updateSettings'; readonly settings: Partial<GameSettings> };

export type GameEvent =
  | { readonly kind: 'encounterStarted'; readonly creature: Creature }
  | { readonly kind: 'battleStarted' }
  | { readonly kind: 'battleEnded'; readonly result: string }
  | { readonly kind: 'storyAdvanced'; readonly nodeId: string }
  | { readonly kind: 'itemReceived'; readonly itemId: string; readonly quantity: number }
  | { readonly kind: 'creatureJoined'; readonly creature: Creature }
  | { readonly kind: 'locationChanged'; readonly locationId: LocationId }
  | { readonly kind: 'notification'; readonly message: string };

export interface GameUpdate {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

export interface SaveFile {
  readonly version: number;
  readonly slot: number;
  readonly player: PlayerState;
  readonly settings: GameSettings;
  readonly timestamp: number;
  readonly playTime: number;
}

export interface GameData {
  readonly species: ReadonlyMap<string, import('./creature.js').Species>;
  readonly moves: ReadonlyMap<string, import('./move.js').Move>;
  readonly items: ReadonlyMap<string, import('./item.js').Item>;
  readonly worldMap: import('./world.js').WorldMap;
  readonly storyGraph: import('./story.js').StoryGraph;
  readonly effectivenessChart: import('./elemental.js').EffectivenessChart;
}
