import type { ElementalType } from './elemental.js';

export type MoveCategory = 'physical' | 'special' | 'status';

export type TargetType = 'opponent' | 'self' | 'all-opponents' | 'ally' | 'field';

export type MoveEffect =
  | { readonly kind: 'damage'; readonly power: number }
  | { readonly kind: 'applyStatus'; readonly status: StatusEffectType; readonly chance: number }
  | {
      readonly kind: 'statChange';
      readonly stat: StatTarget;
      readonly stages: number;
      readonly target: 'self' | 'opponent';
      readonly chance: number;
    }
  | { readonly kind: 'heal'; readonly percentage: number }
  | { readonly kind: 'drain'; readonly percentage: number }
  | { readonly kind: 'recoil'; readonly percentage: number }
  | { readonly kind: 'protect' }
  | { readonly kind: 'weather'; readonly weather: WeatherType };

export type StatusEffectType = 'burn' | 'poison' | 'paralysis' | 'sleep' | 'freeze';

export type StatTarget =
  | 'attack'
  | 'defense'
  | 'specialAttack'
  | 'specialDefense'
  | 'speed'
  | 'accuracy'
  | 'evasion';

export type WeatherType = 'clear' | 'rain' | 'sun' | 'sandstorm' | 'hail';

export interface Move {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly type: ElementalType;
  readonly category: MoveCategory;
  readonly power: number;
  readonly accuracy: number;
  readonly pp: number;
  readonly priority: number;
  readonly target: TargetType;
  readonly effects: readonly MoveEffect[];
  readonly makesContact: boolean;
}
