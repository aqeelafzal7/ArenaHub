import React, { useMemo } from 'react';

interface SecureTextProps {
  children: React.ReactNode;
  className?: string;
}

export const SecureText: React.FC<SecureTextProps> = ({ children, className = '' }) => {
  // Generate random values on mount to prevent AI caching/calibration
  const { angle, shadowOffset } = useMemo(() => {
    return {
      angle: (Math.random() * 0.6 - 0.3).toFixed(2),
      shadowOffset: (Math.random() * 1 + 1).toFixed(1)
    };
  }, []); // Empty dependency array ensures it only generates once per mount

  const antiAiStyle = {
    textShadow: `${shadowOffset}px ${shadowOffset}px 0px rgba(0,255,255,0.3), -${shadowOffset}px -${shadowOffset}px 0px rgba(255,0,255,0.3)`,
    letterSpacing: '-0.03em',
    transform: `rotate(${angle}deg)`,
    display: 'inline-block' // Required for transform to work on spans
  };

  return (
    <span style={antiAiStyle} className={`select-none ${className}`}>
      {children}
    </span>
  );
};
