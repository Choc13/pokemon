import type { Creature, BattleAction, BattleSide, PlayerState, GameData } from '@creature-chronicles/domain';

export interface DialogueLine {
  readonly speaker: string;
  readonly text: string;
  readonly portrait?: string;
}

export type MenuType = 'party' | 'inventory' | 'save' | 'settings' | 'creatureLog';

export interface BattleMenuOptions {
  readonly moves: readonly { readonly name: string; readonly pp: number; readonly maxPp: number; readonly type: string }[];
  readonly canFlee: boolean;
  readonly canBefriend: boolean;
  readonly items: readonly { readonly id: string; readonly name: string; readonly quantity: number }[];
  readonly team: readonly Creature[];
}

export interface UIPort {
  showDialogue(lines: readonly DialogueLine[]): Promise<void>;
  showChoice(prompt: string, choices: readonly string[]): Promise<number>;

  updatePartyDisplay(team: readonly Creature[]): void;
  showNotification(message: string): void;

  openMenu(menu: MenuType, state: PlayerState, data: GameData): Promise<import('@creature-chronicles/domain').GameAction | null>;

  showBattleMenu(options: BattleMenuOptions): Promise<BattleAction>;
  updateBattleHUD(playerSide: BattleSide, opponentSide: BattleSide): void;
}
