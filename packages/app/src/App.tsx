import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { GameState, GameAction, GameData, BattleAction } from '@creature-chronicles/domain';
import { updateGame, createInitialPlayerState, createInitialGameState, createCreature, computeStats } from '@creature-chronicles/domain';
import { createRng } from '@creature-chronicles/domain';
import type { Rng } from '@creature-chronicles/domain';
import { loadGameData } from '@creature-chronicles/content';
import {
  DialogueBox,
  BattleMenu,
  ChoiceMenu,
  HUD,
  BattleHUD,
  NotificationToast,
} from '@creature-chronicles/adapters';
import type { DialogueLine, BattleMenuOptions } from '@creature-chronicles/ports';

export const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [dialogueLines, setDialogueLines] = useState<readonly DialogueLine[] | null>(null);
  const [choicePrompt, setChoicePrompt] = useState<{ prompt: string; choices: string[] } | null>(null);
  const rngRef = useRef<Rng>(createRng(Date.now()));
  const gameContainerRef = useRef<HTMLDivElement>(null);

  // Initialize game data
  useEffect(() => {
    const data = loadGameData();
    setGameData(data);

    // Create starter creature
    const starterSpecies = data.species.get('emberpup')!;
    const starter = createCreature(
      'starter-1', starterSpecies, 5, 'adamant',
      { hp: 20, attack: 25, defense: 15, specialAttack: 20, specialDefense: 15, speed: 22 },
      ['ember', 'tackle'], [25, 35], rngRef.current,
    );

    const player = createInitialPlayerState('Player', starter, 'haven-town', 'prologue-start');
    const state = createInitialGameState(player);
    setGameState(state);
  }, []);

  const dispatch = useCallback((action: GameAction) => {
    if (!gameState || !gameData) return;
    const result = updateGame(gameState, action, rngRef.current, gameData);
    setGameState(result.state);

    // Process events
    for (const event of result.events) {
      switch (event.kind) {
        case 'notification':
          setNotification(event.message);
          break;
        case 'encounterStarted':
          setNotification(`A wild ${event.creature.speciesId} appeared!`);
          break;
        case 'creatureJoined':
          setNotification(`${event.creature.speciesId} joined your team!`);
          break;
        case 'battleEnded':
          setNotification(`Battle ended: ${event.result}`);
          break;
        case 'locationChanged': {
          const loc = gameData.worldMap.locations.get(event.locationId);
          if (loc) setNotification(`Entered ${loc.name}`);
          break;
        }
      }
    }
  }, [gameState, gameData]);

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!gameState) return;

      if (gameState.phase === 'exploring') {
        switch (e.key) {
          case 'ArrowUp': case 'w': dispatch({ kind: 'move', direction: 'up' }); break;
          case 'ArrowDown': case 's': dispatch({ kind: 'move', direction: 'down' }); break;
          case 'ArrowLeft': case 'a': dispatch({ kind: 'move', direction: 'left' }); break;
          case 'ArrowRight': case 'd': dispatch({ kind: 'move', direction: 'right' }); break;
          case ' ': case 'Enter': dispatch({ kind: 'interact' }); break;
          case 'Escape': dispatch({ kind: 'openMenu' }); break;
        }
      } else if (gameState.phase === 'inDialogue') {
        if (e.key === ' ' || e.key === 'Enter') {
          dispatch({ kind: 'dialogueAdvance' });
        }
      } else if (gameState.phase === 'inMenu') {
        if (e.key === 'Escape') {
          dispatch({ kind: 'closeMenu' });
        }
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameState, dispatch]);

  if (!gameState || !gameData) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#1a1a2e', color: '#fff', fontFamily: 'sans-serif', fontSize: '24px' }}>Loading Creature Chronicles...</div>;
  }

  const currentLocation = gameData.worldMap.locations.get(gameState.player.currentLocationId);
  const locationName = currentLocation?.name ?? 'Unknown';

  // Get current story node for dialogue display
  const currentStoryNode = gameState.activeStoryNodeId
    ? gameData.storyGraph.nodes.get(gameState.activeStoryNodeId)
    : null;

  return (
    <div ref={gameContainerRef} style={{ position: 'relative', width: '800px', height: '600px', margin: '0 auto', overflow: 'hidden', backgroundColor: '#1a1a2e', fontFamily: '"Segoe UI", sans-serif' }}>

      {/* Game Canvas Area */}
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        {gameState.phase === 'exploring' && (
          <div style={{ width: '100%', height: '100%', backgroundColor: currentLocation?.type === 'town' ? '#4a8c5c' : currentLocation?.type === 'dungeon' ? '#2a2a4a' : '#6a9c4c', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            {/* Simple grid representation */}
            <div style={{ position: 'relative', width: '480px', height: '384px', backgroundColor: 'rgba(0,0,0,0.1)', border: '2px solid rgba(255,255,255,0.2)' }}>
              {/* Player */}
              <div style={{
                position: 'absolute',
                left: `${gameState.player.position.x * 32}px`,
                top: `${gameState.player.position.y * 32}px`,
                width: '32px', height: '32px',
                backgroundColor: '#3366ff', borderRadius: '4px',
                transition: 'left 0.1s, top 0.1s',
                border: '2px solid #fff',
              }} />

              {/* NPCs */}
              {currentLocation?.npcs.map((npc) => (
                <div key={npc.id} style={{
                  position: 'absolute',
                  left: `${npc.position.x * 32}px`,
                  top: `${npc.position.y * 32}px`,
                  width: '32px', height: '32px',
                  backgroundColor: npc.interaction.kind === 'trainer' ? '#ff6633' : npc.interaction.kind === 'service' ? '#33cc66' : '#ffcc33',
                  borderRadius: '50%', border: '2px solid #333',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', color: '#fff',
                }}>
                  {npc.name[0]}
                </div>
              ))}
            </div>

            <div style={{ color: '#fff', marginTop: '16px', fontSize: '14px', opacity: 0.8 }}>
              Arrow keys / WASD to move | Space to interact | Esc for menu
            </div>
          </div>
        )}

        {gameState.phase === 'inBattle' && gameState.battle && (
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(180deg, #87CEEB 0%, #87CEEB 60%, #8B7355 60%, #8B7355 100%)' }}>
            {/* Opponent creature */}
            <div style={{ position: 'absolute', top: '120px', right: '150px', width: '80px', height: '80px', backgroundColor: '#ff4444', borderRadius: '8px', border: '3px solid #cc0000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '12px' }}>
              {gameState.battle.opponentSide.active.creature.speciesId}
            </div>

            {/* Player creature */}
            <div style={{ position: 'absolute', bottom: '180px', left: '120px', width: '80px', height: '80px', backgroundColor: '#4444ff', borderRadius: '8px', border: '3px solid #0000cc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '12px' }}>
              {gameState.battle.playerSide.active.creature.speciesId}
            </div>

            {/* Battle HUD */}
            <BattleHUD
              playerSide={gameState.battle.playerSide}
              opponentSide={gameState.battle.opponentSide}
              playerMaxHp={computeStats(gameData.species.get(gameState.battle.playerSide.active.creature.speciesId)!, gameState.battle.playerSide.active.creature).hp}
              opponentMaxHp={computeStats(gameData.species.get(gameState.battle.opponentSide.active.creature.speciesId)!, gameState.battle.opponentSide.active.creature).hp}
            />

            {/* Battle Menu */}
            {gameState.battle.phase === 'awaitingInput' && (
              <BattleMenu
                options={{
                  moves: gameState.battle.playerSide.active.creature.moveIds.map((id, i) => {
                    const move = gameData.moves.get(id);
                    return { name: move?.name ?? id, pp: gameState.battle!.playerSide.active.creature.movePp[i] ?? 0, maxPp: move?.pp ?? 0, type: move?.type ?? 'normal' };
                  }),
                  canFlee: gameState.battle.isWild,
                  canBefriend: gameState.battle.isWild,
                  items: gameState.player.inventory.filter((e) => { const item = gameData.items.get(e.itemId); return item && (item.category === 'healing' || item.category === 'befriend'); }).map((e) => ({ id: e.itemId, name: gameData.items.get(e.itemId)?.name ?? e.itemId, quantity: e.quantity })),
                  team: gameState.player.team,
                }}
                onAction={(action: BattleAction) => dispatch({ kind: 'battleAction', action })}
              />
            )}
          </div>
        )}

        {gameState.phase === 'inMenu' && (
          <div style={{ width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <h2 style={{ marginBottom: '24px' }}>Menu</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '300px' }}>
              <div style={{ padding: '12px', backgroundColor: '#2a2a4a', borderRadius: '8px' }}>
                <h3>Team</h3>
                {gameState.player.team.map((c, i) => {
                  const species = gameData.species.get(c.speciesId);
                  const maxHp = species ? computeStats(species, c).hp : c.currentHp;
                  return (
                    <div key={i} style={{ padding: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{species?.name ?? c.speciesId} Lv.{c.level}</span>
                      <span>HP: {c.currentHp}/{maxHp}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ padding: '12px', backgroundColor: '#2a2a4a', borderRadius: '8px' }}>
                <h3>Inventory</h3>
                {gameState.player.inventory.map((e) => (
                  <div key={e.itemId} style={{ padding: '4px 0' }}>{gameData.items.get(e.itemId)?.name ?? e.itemId} x{e.quantity}</div>
                ))}
              </div>
              <div style={{ padding: '8px', textAlign: 'center', opacity: 0.6 }}>Money: ${gameState.player.money}</div>
              <button onClick={() => dispatch({ kind: 'closeMenu' })} style={{ padding: '12px', backgroundColor: '#4a4a6a', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '16px' }}>Close (Esc)</button>
            </div>
          </div>
        )}
      </div>

      {/* HUD Overlay */}
      {gameState.phase === 'exploring' && (
        <HUD team={gameState.player.team} locationName={locationName} money={gameState.player.money} />
      )}

      {/* Dialogue Overlay */}
      {gameState.phase === 'inDialogue' && currentStoryNode && currentStoryNode.kind === 'dialogue' && (
        <DialogueBox
          lines={currentStoryNode.lines.map((line) => ({ speaker: currentStoryNode.speaker, text: line }))}
          textSpeed={gameState.settings.textSpeed}
          onComplete={() => dispatch({ kind: 'dialogueAdvance' })}
        />
      )}

      {/* Choice Overlay */}
      {gameState.phase === 'inDialogue' && currentStoryNode && currentStoryNode.kind === 'choice' && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, top: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <ChoiceMenu
            prompt={currentStoryNode.prompt}
            choices={currentStoryNode.choices.map((c) => c.text)}
            onSelect={(i) => dispatch({ kind: 'dialogueChoice', choiceIndex: i })}
          />
        </div>
      )}

      {/* Notification */}
      {notification && (
        <NotificationToast message={notification} onDone={() => setNotification(null)} />
      )}
    </div>
  );
};
