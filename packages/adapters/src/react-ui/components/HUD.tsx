import React from 'react';
import type { Creature } from '@creature-chronicles/domain';

interface HUDProps {
  readonly team: readonly Creature[];
  readonly locationName: string;
  readonly money: number;
}

export const HUD: React.FC<HUDProps> = ({ team, locationName, money }) => {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: '8px 16px', backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: '14px' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        {team.map((c, i) => (
          <div key={i} style={{
            width: '24px', height: '24px', borderRadius: '50%',
            backgroundColor: c.currentHp > 0 ? '#33cc33' : '#cc3333',
            border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px',
          }}>
            {i + 1}
          </div>
        ))}
      </div>
      <div>{locationName}</div>
      <div>${money}</div>
    </div>
  );
};
