import React, { useState } from 'react';
import type { BattleAction } from '@creature-chronicles/domain';
import type { BattleMenuOptions } from '@creature-chronicles/ports';

interface BattleMenuProps {
  readonly options: BattleMenuOptions;
  readonly onAction: (action: BattleAction) => void;
}

type MenuState = 'main' | 'fight' | 'bag' | 'creatures';

export const BattleMenu: React.FC<BattleMenuProps> = ({ options, onAction }) => {
  const [menuState, setMenuState] = useState<MenuState>('main');

  const buttonStyle: React.CSSProperties = {
    padding: '12px 20px', margin: '4px', border: '2px solid #555',
    borderRadius: '8px', backgroundColor: '#2a2a3a', color: '#fff',
    fontSize: '16px', cursor: 'pointer', minWidth: '120px', textAlign: 'center',
  };

  if (menuState === 'fight') {
    return (
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.9)', padding: '16px', display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
        {options.moves.map((move, i) => (
          <button key={i} style={buttonStyle} onClick={() => onAction({ kind: 'useMove', moveIndex: i })}>
            {move.name} ({move.pp}/{move.maxPp})
          </button>
        ))}
        <button style={buttonStyle} onClick={() => setMenuState('main')}>Back</button>
      </div>
    );
  }

  if (menuState === 'bag') {
    return (
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.9)', padding: '16px', display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
        {options.items.map((item) => (
          <button key={item.id} style={buttonStyle} onClick={() => onAction({ kind: 'useItem', itemId: item.id })}>
            {item.name} x{item.quantity}
          </button>
        ))}
        {options.canBefriend && (
          <button style={{ ...buttonStyle, backgroundColor: '#4a2a6a' }} onClick={() => onAction({ kind: 'befriend', itemId: 'befriend-crystal' })}>
            Befriend
          </button>
        )}
        <button style={buttonStyle} onClick={() => setMenuState('main')}>Back</button>
      </div>
    );
  }

  if (menuState === 'creatures') {
    return (
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.9)', padding: '16px', display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
        {options.team.map((c, i) => (
          <button key={c.id} style={{ ...buttonStyle, opacity: c.currentHp <= 0 ? 0.5 : 1 }} disabled={c.currentHp <= 0} onClick={() => onAction({ kind: 'switchCreature', teamIndex: i })}>
            {c.nickname ?? c.speciesId} HP:{c.currentHp}
          </button>
        ))}
        <button style={buttonStyle} onClick={() => setMenuState('main')}>Back</button>
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.9)', padding: '16px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
      <button style={buttonStyle} onClick={() => setMenuState('fight')}>Fight</button>
      <button style={buttonStyle} onClick={() => setMenuState('bag')}>Bag</button>
      <button style={buttonStyle} onClick={() => setMenuState('creatures')}>Creatures</button>
      {options.canFlee && (
        <button style={buttonStyle} onClick={() => onAction({ kind: 'flee' })}>Run</button>
      )}
    </div>
  );
};
