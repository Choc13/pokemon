import Phaser from 'phaser';
import type { RendererPort } from '@creature-chronicles/ports';
import type { Creature, LocationId, WorldMap, Direction, BattleEvent } from '@creature-chronicles/domain';

export class OverworldScene extends Phaser.Scene {
  private player: Phaser.GameObjects.Rectangle | null = null;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private moveCallback: ((direction: Direction) => void) | null = null;
  private interactCallback: (() => void) | null = null;
  private moveBlocked = false;

  constructor() {
    super({ key: 'OverworldScene' });
  }

  create(): void {
    // Create a colored background
    this.cameras.main.setBackgroundColor('#4a8c5c');

    // Create player sprite (placeholder rectangle)
    this.player = this.add.rectangle(400, 300, 32, 32, 0x3366ff);

    // Input
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.input.keyboard.on('keydown-SPACE', () => {
        if (this.interactCallback) this.interactCallback();
      });
      this.input.keyboard.on('keydown-Z', () => {
        if (this.interactCallback) this.interactCallback();
      });
    }
  }

  update(): void {
    if (!this.cursors || !this.player || this.moveBlocked) return;

    if (this.cursors.left.isDown) {
      this.player.x -= 4;
      if (this.moveCallback) this.moveCallback('left');
    } else if (this.cursors.right.isDown) {
      this.player.x += 4;
      if (this.moveCallback) this.moveCallback('right');
    } else if (this.cursors.up.isDown) {
      this.player.y -= 4;
      if (this.moveCallback) this.moveCallback('up');
    } else if (this.cursors.down.isDown) {
      this.player.y += 4;
      if (this.moveCallback) this.moveCallback('down');
    }
  }

  setMoveCallback(cb: (direction: Direction) => void): void {
    this.moveCallback = cb;
  }

  setInteractCallback(cb: () => void): void {
    this.interactCallback = cb;
  }

  setMoveBlocked(blocked: boolean): void {
    this.moveBlocked = blocked;
  }

  setPlayerPosition(x: number, y: number): void {
    if (this.player) {
      this.player.x = x * 32 + 16;
      this.player.y = y * 32 + 16;
    }
  }
}

export class BattleScene extends Phaser.Scene {
  private playerSprite: Phaser.GameObjects.Rectangle | null = null;
  private opponentSprite: Phaser.GameObjects.Rectangle | null = null;
  private playerHpBar: Phaser.GameObjects.Rectangle | null = null;
  private opponentHpBar: Phaser.GameObjects.Rectangle | null = null;
  private playerHpBg: Phaser.GameObjects.Rectangle | null = null;
  private opponentHpBg: Phaser.GameObjects.Rectangle | null = null;
  private playerNameText: Phaser.GameObjects.Text | null = null;
  private opponentNameText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: 'BattleScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#87CEEB');

    // Battle background
    this.add.rectangle(400, 450, 800, 200, 0x8B7355);

    // Player creature (back view — bottom left)
    this.playerSprite = this.add.rectangle(200, 350, 64, 64, 0x3366ff);

    // Opponent creature (front view — top right)
    this.opponentSprite = this.add.rectangle(600, 200, 64, 64, 0xff3333);

    // HP bars
    this.playerHpBg = this.add.rectangle(150, 420, 150, 12, 0x333333);
    this.playerHpBar = this.add.rectangle(150, 420, 148, 10, 0x33cc33);
    this.opponentHpBg = this.add.rectangle(550, 140, 150, 12, 0x333333);
    this.opponentHpBar = this.add.rectangle(550, 140, 148, 10, 0x33cc33);

    // Names
    this.playerNameText = this.add.text(80, 400, 'Your Creature', { fontSize: '14px', color: '#fff' });
    this.opponentNameText = this.add.text(480, 120, 'Wild Creature', { fontSize: '14px', color: '#fff' });
  }

  updateHp(side: 'player' | 'opponent', hpPercent: number): void {
    const bar = side === 'player' ? this.playerHpBar : this.opponentHpBar;
    if (bar) {
      const width = Math.max(0, 148 * hpPercent);
      bar.width = width;
      const color = hpPercent > 0.5 ? 0x33cc33 : hpPercent > 0.2 ? 0xcccc33 : 0xcc3333;
      bar.fillColor = color;
    }
  }

  setCreatureNames(playerName: string, opponentName: string): void {
    if (this.playerNameText) this.playerNameText.setText(playerName);
    if (this.opponentNameText) this.opponentNameText.setText(opponentName);
  }

  showDamageFlash(side: 'player' | 'opponent'): void {
    const sprite = side === 'player' ? this.playerSprite : this.opponentSprite;
    if (sprite) {
      this.tweens.add({
        targets: sprite,
        alpha: 0.3,
        duration: 100,
        yoyo: true,
        repeat: 2,
      });
    }
  }
}

export class TransitionScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TransitionScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#000000');
  }
}

export function createPhaserGame(parent: HTMLElement): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent,
    backgroundColor: '#000000',
    scene: [OverworldScene, BattleScene, TransitionScene],
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 } },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  };

  return new Phaser.Game(config);
}

export function createRendererAdapter(game: Phaser.Game): RendererPort {
  function getOverworldScene(): OverworldScene | null {
    return game.scene.getScene('OverworldScene') as OverworldScene | null;
  }

  function getBattleScene(): BattleScene | null {
    return game.scene.getScene('BattleScene') as BattleScene | null;
  }

  return {
    async loadMap(_map: WorldMap, _locationId: LocationId): Promise<void> {
      game.scene.start('OverworldScene');
      await new Promise((r) => setTimeout(r, 100));
    },

    async movePlayer(direction: Direction): Promise<void> {
      const scene = getOverworldScene();
      if (!scene) return;
      const delta = 32;
      const player = (scene as unknown as { player: Phaser.GameObjects.Rectangle | null }).player;
      if (!player) return;
      switch (direction) {
        case 'up': player.y -= delta; break;
        case 'down': player.y += delta; break;
        case 'left': player.x -= delta; break;
        case 'right': player.x += delta; break;
      }
    },

    async transitionToLocation(_locationId: LocationId): Promise<void> {
      game.scene.start('TransitionScene');
      await new Promise((r) => setTimeout(r, 500));
      game.scene.start('OverworldScene');
      await new Promise((r) => setTimeout(r, 100));
    },

    async startBattle(playerCreature: Creature, opponent: Creature, _background: string): Promise<void> {
      game.scene.start('BattleScene');
      await new Promise((r) => setTimeout(r, 200));
      const scene = getBattleScene();
      if (scene) {
        scene.setCreatureNames(
          playerCreature.nickname ?? playerCreature.speciesId,
          opponent.nickname ?? opponent.speciesId,
        );
      }
    },

    async renderBattleEvents(events: readonly BattleEvent[]): Promise<void> {
      const scene = getBattleScene();
      if (!scene) return;

      for (const event of events) {
        if (event.kind === 'damage') {
          scene.showDamageFlash(event.target);
          await new Promise((r) => setTimeout(r, 300));
        }
      }
    },

    async endBattle(): Promise<void> {
      game.scene.stop('BattleScene');
      game.scene.start('OverworldScene');
      await new Promise((r) => setTimeout(r, 200));
    },

    async fadeOut(): Promise<void> {
      game.scene.start('TransitionScene');
      await new Promise((r) => setTimeout(r, 300));
    },

    async fadeIn(): Promise<void> {
      game.scene.stop('TransitionScene');
      await new Promise((r) => setTimeout(r, 300));
    },
  };
}
