import React from 'react';
import type { BattleSide } from '@creature-chronicles/domain';

interface BattleHUDProps {
  readonly playerSide: BattleSide;
  readonly opponentSide: BattleSide;
  readonly playerMaxHp: number;
  readonly opponentMaxHp: number;
}

export const BattleHUD: React.FC<BattleHUDProps> = ({ playerSide, opponentSide, playerMaxHp, opponentMaxHp }) => {
  const playerHpPct = playerMaxHp > 0 ? playerSide.active.creature.currentHp / playerMaxHp : 0;
  const oppHpPct = opponentMaxHp > 0 ? opponentSide.active.creature.currentHp / opponentMaxHp : 0;

  const hpColor = (pct: number) => pct > 0.5 ? '#33cc33' : pct > 0.2 ? '#cccc33' : '#cc3333';

  return (
    <>
      {/* Opponent info - top right */}
      <div style={{ position: 'absolute', top: '80px', right: '80px', backgroundColor: 'rgba(0,0,0,0.7)', padding: '12px', borderRadius: '8px', minWidth: '200px' }}>
        <div style={{ color: '#fff', fontWeight: 'bold', marginBottom: '4px' }}>
          {opponentSide.active.creature.nickname ?? opponentSide.active.creature.speciesId} Lv.{opponentSide.active.creature.level}
        </div>
        <div style={{ backgroundColor: '#333', borderRadius: '4px', overflow: 'hidden', height: '12px' }}>
          <div style={{ width: `${Math.max(0, oppHpPct * 100)}%`, height: '100%', backgroundColor: hpColor(oppHpPct), transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Player info - bottom left */}
      <div style={{ position: 'absolute', bottom: '140px', left: '40px', backgroundColor: 'rgba(0,0,0,0.7)', padding: '12px', borderRadius: '8px', minWidth: '220px' }}>
        <div style={{ color: '#fff', fontWeight: 'bold', marginBottom: '4px' }}>
          {playerSide.active.creature.nickname ?? playerSide.active.creature.speciesId} Lv.{playerSide.active.creature.level}
        </div>
        <div style={{ backgroundColor: '#333', borderRadius: '4px', overflow: 'hidden', height: '12px', marginBottom: '4px' }}>
          <div style={{ width: `${Math.max(0, playerHpPct * 100)}%`, height: '100%', backgroundColor: hpColor(playerHpPct), transition: 'width 0.3s' }} />
        </div>
        <div style={{ color: '#aaa', fontSize: '12px' }}>
          HP: {playerSide.active.creature.currentHp}/{playerMaxHp}
        </div>
      </div>
    </>
  );
};
