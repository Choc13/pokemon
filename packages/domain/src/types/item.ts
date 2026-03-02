export type ItemCategory = 'befriend' | 'healing' | 'battle' | 'key' | 'evolution';

export interface Item {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: ItemCategory;
  readonly price: number;
  readonly sellPrice: number;
  readonly effect: ItemEffect;
}

export type ItemEffect =
  | { readonly kind: 'befriend'; readonly catchModifier: number }
  | { readonly kind: 'healHp'; readonly amount: number }
  | { readonly kind: 'healStatus' }
  | { readonly kind: 'healAll' }
  | { readonly kind: 'revive'; readonly hpPercentage: number }
  | { readonly kind: 'ppRestore'; readonly amount: number }
  | { readonly kind: 'evolution'; readonly targetSpeciesId: string }
  | { readonly kind: 'statBoost'; readonly stat: string; readonly stages: number }
  | { readonly kind: 'keyItem' };

export interface InventoryEntry {
  readonly itemId: string;
  readonly quantity: number;
}
