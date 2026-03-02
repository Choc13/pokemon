import React from 'react';

interface ChoiceMenuProps {
  readonly prompt: string;
  readonly choices: readonly string[];
  readonly onSelect: (index: number) => void;
}

export const ChoiceMenu: React.FC<ChoiceMenuProps> = ({ prompt, choices, onSelect }) => {
  return (
    <div style={{
      position: 'absolute', bottom: '140px', right: '20px',
      backgroundColor: 'rgba(0,0,0,0.9)', border: '2px solid #666',
      borderRadius: '8px', padding: '16px', minWidth: '200px',
    }}>
      <div style={{ color: '#ffdd57', marginBottom: '12px', fontSize: '16px' }}>{prompt}</div>
      {choices.map((choice, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          style={{
            display: 'block', width: '100%', padding: '10px 16px',
            margin: '4px 0', border: '1px solid #555', borderRadius: '4px',
            backgroundColor: '#2a2a3a', color: '#fff', fontSize: '15px',
            cursor: 'pointer', textAlign: 'left',
          }}
        >
          {choice}
        </button>
      ))}
    </div>
  );
};
