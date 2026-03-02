import type { SaveFile, GameSettings } from '@creature-chronicles/domain';

export interface SaveSlotInfo {
  readonly slot: number;
  readonly playerName: string;
  readonly playTime: number;
  readonly timestamp: number;
  readonly badges: number;
}

export interface PersistencePort {
  save(file: SaveFile): Promise<void>;
  load(slot: number): Promise<SaveFile | null>;
  delete(slot: number): Promise<void>;
  listSaves(): Promise<readonly SaveSlotInfo[]>;
  saveSettings(settings: GameSettings): Promise<void>;
  loadSettings(): Promise<GameSettings | null>;
}
