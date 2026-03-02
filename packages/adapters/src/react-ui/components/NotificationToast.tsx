import React, { useEffect, useState } from 'react';

interface NotificationToastProps {
  readonly message: string;
  readonly duration?: number;
  readonly onDone: () => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({ message, duration = 2000, onDone }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDone();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onDone]);

  if (!visible) return null;

  return (
    <div style={{
      position: 'absolute', top: '50px', left: '50%', transform: 'translateX(-50%)',
      backgroundColor: 'rgba(0,0,0,0.85)', color: '#fff', padding: '12px 24px',
      borderRadius: '8px', fontSize: '16px', border: '2px solid #666',
    }}>
      {message}
    </div>
  );
};
