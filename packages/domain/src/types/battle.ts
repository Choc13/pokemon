import type { Creature, CreatureStatus, StatBlock } from './creature.js';
import type { WeatherType } from './move.js';

export type BattlePhase = 'awaitingInput' | 'resolving' | 'creatureFainted' | 'ended';

export interface BattleState {
  readonly phase: BattlePhase;
  readonly playerSide: BattleSide;
  readonly opponentSide: BattleSide;
  readonly field: FieldConditions;
  readonly turnNumber: number;
  readonly isWild: boolean;
  readonly log: readonly BattleEvent[];
}

export interface BattleSide {
  readonly active: BattleCreatureState;
  readonly team: readonly Creature[];
  readonly teamIndex: number;
}

export interface BattleCreatureState {
  readonly creature: Creature;
  readonly statStages: StatStages;
  readonly isProtected: boolean;
  readonly computedStats: StatBlock;
}

export interface StatStages {
  readonly attack: number;
  readonly defense: number;
  readonly specialAttack: number;
  readonly specialDefense: number;
  readonly speed: number;
  readonly accuracy: number;
  readonly evasion: number;
}

export const DEFAULT_STAT_STAGES: StatStages = {
  attack: 0,
  defense: 0,
  specialAttack: 0,
  specialDefense: 0,
  speed: 0,
  accuracy: 0,
  evasion: 0,
};

export interface FieldConditions {
  readonly weather: WeatherType;
  readonly weatherTurnsRemaining: number;
}

export type BattleAction =
  | { readonly kind: 'useMove'; readonly moveIndex: number }
  | { readonly kind: 'switchCreature'; readonly teamIndex: number }
  | { readonly kind: 'useItem'; readonly itemId: string }
  | { readonly kind: 'flee' }
  | { readonly kind: 'befriend'; readonly itemId: string };

export type BattleEvent =
  | { readonly kind: 'moveUsed'; readonly side: 'player' | 'opponent'; readonly moveName: string }
  | {
      readonly kind: 'damage';
      readonly target: 'player' | 'opponent';
      readonly amount: number;
      readonly effectiveness: 'super' | 'normal' | 'not-very' | 'immune';
      readonly critical: boolean;
    }
  | {
      readonly kind: 'statusApplied';
      readonly target: 'player' | 'opponent';
      readonly status: CreatureStatus;
    }
  | {
      readonly kind: 'statChanged';
      readonly target: 'player' | 'opponent';
      readonly stat: string;
      readonly stages: number;
    }
  | { readonly kind: 'healed'; readonly target: 'player' | 'opponent'; readonly amount: number }
  | { readonly kind: 'fainted'; readonly side: 'player' | 'opponent' }
  | { readonly kind: 'weatherChanged'; readonly weather: WeatherType }
  | { readonly kind: 'weatherDamage'; readonly target: 'player' | 'opponent'; readonly amount: number }
  | { readonly kind: 'statusDamage'; readonly target: 'player' | 'opponent'; readonly amount: number }
  | { readonly kind: 'statusRecovered'; readonly target: 'player' | 'opponent' }
  | { readonly kind: 'switchedIn'; readonly side: 'player' | 'opponent'; readonly creatureName: string }
  | { readonly kind: 'fled'; readonly success: boolean }
  | { readonly kind: 'befriendAttempt'; readonly success: boolean; readonly creatureName: string }
  | { readonly kind: 'miss'; readonly side: 'player' | 'opponent' }
  | { readonly kind: 'protected'; readonly side: 'player' | 'opponent' }
  | { readonly kind: 'battleEnd'; readonly result: BattleResult };

export type BattleResult = 'playerWin' | 'opponentWin' | 'fled' | 'captured';

export interface BattleResolution {
  readonly state: BattleState;
  readonly events: readonly BattleEvent[];
}

export interface DamageResult {
  readonly damage: number;
  readonly effectiveness: number;
  readonly critical: boolean;
}
