export type StoryNodeId = string;

export type FactionId = 'harmony' | 'liberation' | 'dominion';

export type StoryNode =
  | DialogueNode
  | ChoiceNode
  | BattleNode
  | EventNode
  | BranchNode
  | EndingNode;

export interface DialogueNode {
  readonly kind: 'dialogue';
  readonly id: StoryNodeId;
  readonly speaker: string;
  readonly portrait?: string;
  readonly lines: readonly string[];
  readonly next: StoryNodeId;
}

export interface ChoiceNode {
  readonly kind: 'choice';
  readonly id: StoryNodeId;
  readonly prompt: string;
  readonly choices: readonly StoryChoice[];
}

export interface StoryChoice {
  readonly text: string;
  readonly target: StoryNodeId;
  readonly requiredFlags?: readonly string[];
  readonly effects?: readonly StoryEffect[];
}

export interface BattleNode {
  readonly kind: 'battle';
  readonly id: StoryNodeId;
  readonly trainerData: {
    readonly name: string;
    readonly team: readonly { readonly speciesId: string; readonly level: number; readonly moveIds: readonly string[] }[];
    readonly difficulty: 'naive' | 'tactical' | 'strategic';
  };
  readonly onWin: StoryNodeId;
  readonly onLose: StoryNodeId;
}

export interface EventNode {
  readonly kind: 'event';
  readonly id: StoryNodeId;
  readonly effects: readonly StoryEffect[];
  readonly next: StoryNodeId;
}

export interface BranchNode {
  readonly kind: 'branch';
  readonly id: StoryNodeId;
  readonly branches: readonly {
    readonly condition: StoryCondition;
    readonly target: StoryNodeId;
  }[];
  readonly fallback: StoryNodeId;
}

export interface EndingNode {
  readonly kind: 'ending';
  readonly id: StoryNodeId;
  readonly endingType: string;
  readonly description: string;
}

export type StoryCondition =
  | { readonly kind: 'hasFlag'; readonly flag: string }
  | { readonly kind: 'lacksFlag'; readonly flag: string }
  | { readonly kind: 'factionAbove'; readonly faction: FactionId; readonly threshold: number }
  | { readonly kind: 'factionBelow'; readonly faction: FactionId; readonly threshold: number }
  | { readonly kind: 'hasCreature'; readonly speciesId: string }
  | { readonly kind: 'bondAbove'; readonly speciesId: string; readonly threshold: number }
  | { readonly kind: 'itemInInventory'; readonly itemId: string }
  | { readonly kind: 'and'; readonly conditions: readonly StoryCondition[] }
  | { readonly kind: 'or'; readonly conditions: readonly StoryCondition[] };

export type StoryEffect =
  | { readonly kind: 'setFlag'; readonly flag: string }
  | { readonly kind: 'removeFlag'; readonly flag: string }
  | { readonly kind: 'giveItem'; readonly itemId: string; readonly quantity: number }
  | { readonly kind: 'giveCreature'; readonly speciesId: string; readonly level: number }
  | { readonly kind: 'heal' }
  | { readonly kind: 'teleport'; readonly locationId: string }
  | { readonly kind: 'adjustFaction'; readonly faction: FactionId; readonly amount: number }
  | { readonly kind: 'setWeather'; readonly weather: string }
  | { readonly kind: 'evolveCreature'; readonly creatureId: string; readonly targetSpeciesId: string };

export interface StoryGraph {
  readonly nodes: ReadonlyMap<StoryNodeId, StoryNode>;
  readonly startNodeId: StoryNodeId;
}

export interface StoryState {
  readonly currentNodeId: StoryNodeId | null;
  readonly flags: ReadonlySet<string>;
  readonly factionStanding: ReadonlyMap<FactionId, number>;
  readonly completedNodes: ReadonlySet<StoryNodeId>;
}
