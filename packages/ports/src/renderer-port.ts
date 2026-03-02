import type { Creature, LocationId, WorldMap, Direction } from '@creature-chronicles/domain';
import type { BattleEvent, BattleSide } from '@creature-chronicles/domain';

export interface RendererPort {
  loadMap(map: WorldMap, locationId: LocationId): Promise<void>;
  movePlayer(direction: Direction): Promise<void>;
  transitionToLocation(locationId: LocationId): Promise<void>;

  startBattle(playerCreature: Creature, opponent: Creature, background: string): Promise<void>;
  renderBattleEvents(events: readonly BattleEvent[]): Promise<void>;
  endBattle(): Promise<void>;

  fadeOut(): Promise<void>;
  fadeIn(): Promise<void>;
}
