import type { ElementalType } from './elemental.js';

export interface StatBlock {
  readonly hp: number;
  readonly attack: number;
  readonly defense: number;
  readonly specialAttack: number;
  readonly specialDefense: number;
  readonly speed: number;
}

export interface Species {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly types: readonly ElementalType[];
  readonly baseStats: StatBlock;
  readonly catchDifficulty: number;
  readonly evolutionPaths: readonly EvolutionPath[];
  readonly learnableMoves: readonly LearnableMove[];
  readonly baseExpYield: number;
  readonly growthRate: GrowthRate;
}

export type GrowthRate = 'fast' | 'medium' | 'slow';

export interface EvolutionPath {
  readonly targetSpeciesId: string;
  readonly trigger: EvolutionTrigger;
}

export type EvolutionTrigger =
  | { readonly kind: 'level'; readonly level: number }
  | { readonly kind: 'item'; readonly itemId: string }
  | { readonly kind: 'bond'; readonly minBond: number }
  | { readonly kind: 'storyFlag'; readonly flag: string };

export interface LearnableMove {
  readonly moveId: string;
  readonly learnMethod: LearnMethod;
}

export type LearnMethod =
  | { readonly kind: 'levelUp'; readonly level: number }
  | { readonly kind: 'tutor' }
  | { readonly kind: 'item'; readonly itemId: string };

export const NATURES = [
  'hardy',
  'lonely',
  'brave',
  'adamant',
  'naughty',
  'bold',
  'docile',
  'relaxed',
  'impish',
  'lax',
  'timid',
  'hasty',
  'serious',
  'jolly',
  'naive',
  'modest',
  'mild',
  'quiet',
  'bashful',
  'rash',
  'calm',
  'gentle',
  'sassy',
  'careful',
  'quirky',
] as const;

export type Nature = (typeof NATURES)[number];

export interface NatureModifier {
  readonly increased: keyof Omit<StatBlock, 'hp'> | null;
  readonly decreased: keyof Omit<StatBlock, 'hp'> | null;
}

export type CreatureStatus =
  | { readonly kind: 'none' }
  | { readonly kind: 'burn' }
  | { readonly kind: 'poison' }
  | { readonly kind: 'paralysis' }
  | { readonly kind: 'sleep'; readonly turnsRemaining: number }
  | { readonly kind: 'freeze' };

export interface Creature {
  readonly id: string;
  readonly speciesId: string;
  readonly nickname: string | null;
  readonly level: number;
  readonly xp: number;
  readonly nature: Nature;
  readonly ivs: StatBlock;
  readonly evs: StatBlock;
  readonly currentHp: number;
  readonly status: CreatureStatus;
  readonly moveIds: readonly string[];
  readonly movePp: readonly number[];
  readonly bond: number;
  readonly isShiny: boolean;
  readonly originalTrainer: string;
}
