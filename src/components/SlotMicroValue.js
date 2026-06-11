import React from 'react';
import 'slot-text/style.css';
import { SlotText } from 'slot-text/react';

/** slot-text for call micro-bar — short strings, discrete ticks only. */
export const SlotMicroValue = ({ text, className = '' }) => (
  <SlotText
    text={text || ''}
    className={className}
    options={{
      duration: 180,
      stagger: 18,
      direction: 'up',
      skipUnchanged: true,
      interrupt: true,
    }}
    style={{ lineHeight: 'inherit' }}
  />
);
