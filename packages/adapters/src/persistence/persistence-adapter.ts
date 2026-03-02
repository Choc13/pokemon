import type { PersistencePort, SaveSlotInfo } from '@creature-chronicles/ports';
import type { SaveFile, GameSettings } from '@creature-chronicles/domain';

const DB_NAME = 'creature-chronicles';
const DB_VERSION = 1;
const SAVES_STORE = 'saves';
const SETTINGS_STORE = 'settings';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SAVES_STORE)) {
        db.createObjectStore(SAVES_STORE, { keyPath: 'slot' });
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function serializeSaveFile(file: SaveFile): unknown {
  return {
    ...file,
    player: {
      ...file.player,
      storyState: {
        ...file.player.storyState,
        flags: [...file.player.storyState.flags],
        factionStanding: [...file.player.storyState.factionStanding],
        completedNodes: [...file.player.storyState.completedNodes],
      },
      creatureLog: {
        seen: [...file.player.creatureLog.seen],
        caught: [...file.player.creatureLog.caught],
      },
    },
  };
}

function deserializeSaveFile(data: Record<string, unknown>): SaveFile {
  const raw = data as unknown as SaveFile & {
    player: SaveFile['player'] & {
      storyState: {
        flags: string[];
        factionStanding: [string, number][];
        completedNodes: string[];
      };
      creatureLog: { seen: string[]; caught: string[] };
    };
  };
  return {
    ...raw,
    player: {
      ...raw.player,
      storyState: {
        ...raw.player.storyState,
        flags: new Set(raw.player.storyState.flags),
        factionStanding: new Map(raw.player.storyState.factionStanding),
        completedNodes: new Set(raw.player.storyState.completedNodes),
      },
      creatureLog: {
        seen: new Set(raw.player.creatureLog.seen),
        caught: new Set(raw.player.creatureLog.caught),
      },
    },
  } as SaveFile;
}

export function createPersistenceAdapter(): PersistencePort {
  return {
    async save(file: SaveFile): Promise<void> {
      const db = await openDB();
      const tx = db.transaction(SAVES_STORE, 'readwrite');
      tx.objectStore(SAVES_STORE).put(serializeSaveFile(file));
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },

    async load(slot: number): Promise<SaveFile | null> {
      const db = await openDB();
      const tx = db.transaction(SAVES_STORE, 'readonly');
      const request = tx.objectStore(SAVES_STORE).get(slot);
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          if (request.result) {
            resolve(deserializeSaveFile(request.result));
          } else {
            resolve(null);
          }
        };
        request.onerror = () => reject(request.error);
      });
    },

    async delete(slot: number): Promise<void> {
      const db = await openDB();
      const tx = db.transaction(SAVES_STORE, 'readwrite');
      tx.objectStore(SAVES_STORE).delete(slot);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },

    async listSaves(): Promise<readonly SaveSlotInfo[]> {
      const db = await openDB();
      const tx = db.transaction(SAVES_STORE, 'readonly');
      const request = tx.objectStore(SAVES_STORE).getAll();
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const saves = (request.result as Array<Record<string, unknown>>).map((raw) => {
            const file = deserializeSaveFile(raw);
            return {
              slot: file.slot,
              playerName: file.player.name,
              playTime: file.playTime,
              timestamp: file.timestamp,
              badges: file.player.badges.length,
            };
          });
          resolve(saves);
        };
        request.onerror = () => reject(request.error);
      });
    },

    async saveSettings(settings: GameSettings): Promise<void> {
      const db = await openDB();
      const tx = db.transaction(SETTINGS_STORE, 'readwrite');
      tx.objectStore(SETTINGS_STORE).put({ id: 'settings', ...settings });
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },

    async loadSettings(): Promise<GameSettings | null> {
      const db = await openDB();
      const tx = db.transaction(SETTINGS_STORE, 'readonly');
      const request = tx.objectStore(SETTINGS_STORE).get('settings');
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          if (request.result) {
            const { id, ...settings } = request.result;
            resolve(settings as GameSettings);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => reject(request.error);
      });
    },
  };
}
