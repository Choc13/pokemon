import React, { useState, useEffect, useCallback } from 'react';
import type { DialogueLine } from '@creature-chronicles/ports';

interface DialogueBoxProps {
  readonly lines: readonly DialogueLine[];
  readonly textSpeed: 'slow' | 'medium' | 'fast' | 'instant';
  readonly onComplete: () => void;
}

const SPEED_MAP = { slow: 60, medium: 30, fast: 15, instant: 0 };

export const DialogueBox: React.FC<DialogueBoxProps> = ({ lines, textSpeed, onComplete }) => {
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  const currentLine = lines[currentLineIndex];
  const charDelay = SPEED_MAP[textSpeed];

  useEffect(() => {
    if (!currentLine) return;
    if (charDelay === 0) {
      setDisplayedText(currentLine.text);
      setIsTyping(false);
      return;
    }

    setDisplayedText('');
    setIsTyping(true);
    let index = 0;
    const timer = setInterval(() => {
      index++;
      setDisplayedText(currentLine.text.slice(0, index));
      if (index >= currentLine.text.length) {
        clearInterval(timer);
        setIsTyping(false);
      }
    }, charDelay);

    return () => clearInterval(timer);
  }, [currentLine, charDelay]);

  const handleClick = useCallback(() => {
    if (isTyping) {
      setDisplayedText(currentLine?.text ?? '');
      setIsTyping(false);
      return;
    }
    if (currentLineIndex < lines.length - 1) {
      setCurrentLineIndex((i) => i + 1);
    } else {
      onComplete();
    }
  }, [isTyping, currentLine, currentLineIndex, lines.length, onComplete]);

  if (!currentLine) return null;

  return (
    <div onClick={handleClick} style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: 'rgba(0,0,0,0.85)', color: '#fff',
      padding: '16px 24px', minHeight: '120px',
      fontFamily: '"Segoe UI", sans-serif', fontSize: '18px',
      cursor: 'pointer', borderTop: '3px solid #666',
    }}>
      {currentLine.speaker && (
        <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#ffdd57' }}>
          {currentLine.speaker}
        </div>
      )}
      <div>{displayedText}{isTyping && <span style={{ opacity: 0.5 }}>|</span>}</div>
      {!isTyping && (
        <div style={{ position: 'absolute', bottom: '8px', right: '16px', fontSize: '12px', opacity: 0.6 }}>
          {currentLineIndex < lines.length - 1 ? 'Click to continue...' : 'Click to close'}
        </div>
      )}
    </div>
  );
};
