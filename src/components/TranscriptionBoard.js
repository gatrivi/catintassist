import React, { useEffect, useRef, useState } from 'react';

import { useTTS } from '../hooks/useTTS';
import { useTranslate } from '../hooks/useTranslate';
import { useSession, safeSet } from '../contexts/SessionContext';
import { useProgressiveAudio } from '../hooks/useProgressiveAudio';
import { useRewardAudio } from '../hooks/useRewardAudio';

// EL TABLERO DE TEXTO: Aquí es donde aparece todo lo que dicen en la llamada.
// Muestra quién habla, lo traduce y te deja copiar los números con un clic.
const getBubbleStyle = (text, isCurrent, lang) => {
  if (!text) return {};
  const wordCount = text.trim().split(/\s+/).length;
  
  let baseBorder = lang === 'es' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(59, 130, 246, 0.4)';
  let baseBg = lang === 'es' ? 'rgba(16, 185, 129, 0.03)' : 'rgba(59, 130, 246, 0.03)';

  if (wordCount >= 40) {
    baseBorder = 'rgba(239, 68, 68, 0.6)';
    baseBg = 'rgba(239, 68, 68, 0.03)';
  } else if (wordCount >= 34) {
    baseBorder = 'rgba(245, 158, 11, 0.6)';
    baseBg = 'rgba(245, 158, 11, 0.03)';
  }

  return { borderLeft: `3px solid ${baseBorder}`, backgroundColor: baseBg };
};

const convertNumberWords = (text) => {
  const map = {
    'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
    'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
    'eleven': '11', 'twelve': '12', 'thirteen': '13', 'fourteen': '14', 'fifteen': '15',
    'sixteen': '16', 'seventeen': '17', 'eighteen': '18', 'nineteen': '19', 'twenty': '20',
    'thirty': '30', 'forty': '40', 'fifty': '50', 'sixty': '60', 'seventy': '70', 'eighty': '80', 'ninety': '90'
  };
  return text.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/gi, (matched) => map[matched.toLowerCase()] || matched);
};

const InteractiveText = ({ text }) => {
  if (!text) return null;
  // GROUP PHONE NUMBERS: If we see 9 or 10 digits read out singly (with spaces), join them.
  // This version is a robust one-liner that matches 9 or 10 digits with optional spaces.
  const groupedDigits = text.replace(/\b(\d[\s.,-:]*){9,12}\b/g, (m) => m.replace(/[\s.,-:]+/g, ''));
  const processedText = convertNumberWords(groupedDigits);
  
  // NYC ZIP REPAIR: In NYC, people often say "one hundred thirty four" for 10034.
  // Deepgram might transcribe "New York 134". We fix it to "New York 10034".
  const repairedText = processedText.replace(/\b(New York|NY|N\.Y\.)\s*,?\s*(\d{3})\b/gi, (m, city, zip) => {
    const suffix = zip.slice(-2);
    return `${city} 100${suffix}`;
  });

  // NÚMEROS MÁGICOS: Detectamos números de teléfono, años y códigos.
  // Los resaltamos para que puedas copiarlos rápido si haces clic.
  const numRegex = /(\+?\(?\d{1,4}?\)?[\s.-]?\(?\d{2,4}?\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}|\b\d+[\d.,/\\-]*\b)/g;

  const parts = repairedText.split(numRegex);

  const handleCopy = (num) => {
    const clean = num.trim();
    if (!clean) return;
    navigator.clipboard.writeText(clean);
  };

  return (
    <>
      {parts.map((p, i) => {
        if (p && p.match(numRegex)) {
          return (
            <span 
              key={i} 
              className="phone-number highlight-number" 
              onClick={(e) => { e.stopPropagation(); handleCopy(p); }} 
              title={`Click to copy number: ${p}`}
              style={{ cursor: 'copy', backgroundColor: 'rgba(252, 211, 77, 0.1)', color: '#fcd34d', padding: '0 2px', borderRadius: '2px', fontWeight: 600 }}
            >
              {p}
            </span>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
};

const StatusProgress = ({ status }) => {
  const steps = ['translating', 'processing', 'ready'];
  const currentIndex = steps.indexOf(status === 'buffering' ? 'processing' : status);
  const labels = ['T', 'P', 'R'];
  const tooltips = [
    'Transcribing: Converting audio to text...',
    'Processing: Routing through translation engines...',
    'Ready: Translation delivered and ready for playback'
  ];
  
  return (
    <div style={{ display: 'flex', gap: '2px', alignItems: 'center', height: '6px', width: '100%', marginBottom: '4px' }}>
      {steps.map((step, i) => (
        <div 
          key={step} 
          title={tooltips[i]}
          className="status-bar-segment"
          style={{ 
            flex: 1, 
            height: '100%', 
            borderRadius: '1px',
            background: i <= currentIndex ? (step === 'ready' ? '#10b981' : '#3b82f6') : 'rgba(255,255,255,0.1)',
            boxShadow: (i === currentIndex && step !== 'ready') ? '0 0 4px #3b82f6' : 'none',
            transition: 'all 0.3s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.4rem',
            color: 'rgba(255,255,255,0.8)',
            fontWeight: 900,
            cursor: 'help'
          }}
        >
          {labels[i]}
        </div>
      ))}
    </div>
  );
};

const TranslatedBubble = ({ id, text, lang, playTTS, stopTTS, playingUrl, prefetchTTS, reverse = false, ttsMode, wordCount, turnWordCount, shouldPrefetch, emphasisMode, isPinned, onTogglePin, isRedundantCount }) => {
  const { translationMood } = useSession();
  const { translation, audioUrl, engineStatus, targetLang } = useTranslate(text, lang, prefetchTTS, shouldPrefetch, translationMood);
  const hasAutoPlayedRef = useRef(false);

  useEffect(() => {
    if (ttsMode === 'auto' && translation && audioUrl && !hasAutoPlayedRef.current) {
      hasAutoPlayedRef.current = true;
      playTTS(translation, targetLang, audioUrl);
    }
    if (!translation) hasAutoPlayedRef.current = false;
  }, [translation, ttsMode, playTTS, targetLang, audioUrl]);

  const isThisPlaying = playingUrl && audioUrl && playingUrl === audioUrl;
  const transcriptColor = emphasisMode === 'flipped' ? '#93c5fd' : '#ffffff';
  const translationColor = emphasisMode === 'flipped' ? '#bfdbfe' : 'rgba(255,255,255,0.65)';

  return (
    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.1rem', flexDirection: reverse ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
      <div style={{ flex: 1, textAlign: reverse ? 'right' : 'left', minWidth: 0 }}>
        <div style={{ color: transcriptColor, fontWeight: 400, lineHeight: 1.25, fontSize: '0.9rem', wordBreak: 'break-word' }}>
          <InteractiveText text={text} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '28px', flexShrink: 0, marginTop: '2px' }}>
        <StatusProgress status={engineStatus} />
        {(!isRedundantCount && (turnWordCount || wordCount) > 0) && (
          <span 
            style={{ fontSize: '0.55rem', fontWeight: 700, color: (turnWordCount || wordCount) >= 40 ? 'var(--danger)' : (turnWordCount || wordCount) >= 34 ? '#f59e0b' : 'var(--text-muted)', marginBottom: '1px' }}
            title={turnWordCount ? `Current Turn: ${turnWordCount} words (Bubble: ${wordCount})` : ""}
          >
            {turnWordCount || wordCount}
          </span>
        )}
        <button 
          onClick={() => isThisPlaying ? stopTTS() : playTTS(translation, targetLang, audioUrl)} 
          disabled={!isThisPlaying && (!translation || !audioUrl)}
          style={{ background: 'transparent', border: 'none', cursor: (!isThisPlaying && (!translation || !audioUrl)) ? 'not-allowed' : 'pointer', fontSize: '1.1rem', padding: 0, opacity: (!isThisPlaying && (!translation || !audioUrl)) ? 0.3 : 1 }}
          title={isThisPlaying ? "Stop" : (!audioUrl ? "Engine working..." : "Play")}
        >
          🔊
        </button>
      </div>

      <div style={{ flex: 1, color: translationColor, textAlign: reverse ? 'left' : 'right', minWidth: 0 }}>
        <div style={{ fontWeight: 400, fontStyle: 'italic', lineHeight: 1.25, fontSize: '0.85rem', wordBreak: 'break-word' }}>
          {translation ? <InteractiveText text={translation} /> : <span style={{ opacity: 0.2 }}>...</span>}
        </div>
      </div>
    </div>
  );
};

// (Removed raw playChime - now uses useRewardAudio)

// ─── CoinRain Component ───────────────────────────────────────────────────────
// Gamification: One coin zigzags down every minute of active call.
// Refactored to prevent 'teleporting'—the coin that falls is the coin that stacks.
const CoinRain = ({ isActive, onCollect }) => {
  const { playChaChing } = useRewardAudio();
  const [coins, setCoins] = useState([]); // [{id, status, index}]
  const coinIdRef = useRef(0);
  const startTimeRef = useRef(Date.now());

  const cleanupRef = useRef(null);

  useEffect(() => {
    if (isActive) {
      if (cleanupRef.current) clearTimeout(cleanupRef.current);
      setCoins([]); // Instant reset for new call
      startTimeRef.current = Date.now();
      
      const spawn = () => {
        const id = ++coinIdRef.current;
        setCoins(prev => {
          const index = prev.filter(c => c.status !== 'collecting').length;
          playChaChing(index + 1);
          return [...prev, { id, status: 'falling', index }];
        });
        
        setTimeout(() => {
          setCoins(current => current.map(c => {
            if (c.id === id && c.status === 'falling') {
              return { ...c, status: 'stacked' };
            }
            return c;
          }));
        }, 60000);
      };
      
      spawn();
      const iv = setInterval(spawn, 60000);
      return () => {
        clearInterval(iv);
      };
    } else {
      // End of call: all existing coins fly to wallet
      setCoins(current => {
        const toCollect = current.filter(c => c.status !== 'collecting');
        if (toCollect.length > 0) {
          // Play synthesized reward sound
          onCollect?.();
          
          toCollect.forEach((c, i) => {
            setTimeout(() => {
              playChaChing(i + 1);
            }, i * 150);
          });
        }
        return current.map(c => 
          c.status !== 'collecting' ? { ...c, status: 'collecting' } : c
        );
      });
      
      cleanupRef.current = setTimeout(() => {
        setCoins([]);
        coinIdRef.current = 0;
      }, 15000); 
      return () => {
        if (cleanupRef.current) clearTimeout(cleanupRef.current);
      };
    }
  }, [isActive, onCollect, playChaChing]);

  return (
    <div id="coin-rain-overlay" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      {coins.map(coin => {
        const COINS_PER_ROW = 30; // 30 mins per row for easy visual estimation (rows = 0.5hr units)
        const xPos = 15 + (coin.index % COINS_PER_ROW) * 12; // Stacking offset
        const yPos = 8 + Math.floor(coin.index / COINS_PER_ROW) * 16; // Upward stacking
        
        let style = {};
        if (coin.status === 'falling') {
          style = {
            top: '-10%', left: '10%',
            animation: 'zigzagFall 60s linear forwards',
            '--end-x': `${xPos}px`,
            opacity: 1
          };
        } else if (coin.status === 'stacked') {
          style = {
            bottom: `${yPos}px`,
            left: `${xPos}px`,
            opacity: 0.2
          };
        } else if (coin.status === 'collecting') {
          style = {
            bottom: `${yPos}px`,
            left: `${xPos}px`,
            animation: 'flyToTop 1.2s ease-in forwards',
            animationDelay: `${(coin.index % 20) * 0.1}s`, // Staggered fly
            opacity: 1
          };
        }

        return (
          <div key={coin.id} className="coin-instance" style={{ 
            position: 'absolute', fontSize: '1.4rem', 
            filter: 'drop-shadow(0 0 8px rgba(252, 211, 77, 0.4))',
            transition: 'opacity 0.5s ease',
            ...style
          }}>💰</div>
        );
      })}
    </div>
  );
};

const ReminderMessage = ({ isActive }) => {
  const [pulse, setPulse] = useState(false);
  const [pulseConfig, setPulseConfig] = useState({ hue: 45, delayMs: 60000 });

  useEffect(() => {
    if (!isActive) return;

    let timeoutId;
    
    const triggerPulse = () => {
      // Calculate position of sun based on hour (0-23.99)
      const d = new Date();
      const hour = d.getHours() + d.getMinutes() / 60;
      
      let hue;
      let delayMs;

      // Map hour to sun progression (approx)
      if (hour >= 6 && hour < 18) {
         // Daytime (6am to 6pm): 6am = Gold (60), 12pm = Yellow (50), 6pm = Red/Orange (15)
         const sunRatio = (hour - 6) / 12; // 0 to 1
         hue = 60 - (sunRatio * 45); // 60 down to 15
         // Rhythm: morning is steady 60s, lazy afternoon slows to 65s
         delayMs = 58000 + (sunRatio * 7000); 
      } else {
         // Nighttime: Deep Blue (220) to Purple (280)
         hue = 220 + Math.random() * 40; 
         // Rhythm: Night is slower, relaxed
         delayMs = 65000 + Math.random() * 5000;
      }

      setPulseConfig({ hue, delayMs });
      setPulse(true);
      
      setTimeout(() => setPulse(false), 2500); // 2.5s fade out
      
      timeoutId = setTimeout(triggerPulse, delayMs);
    };

    triggerPulse();
    return () => clearTimeout(timeoutId);
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10000,
      opacity: pulse ? 1 : 0.4,
      transition: 'opacity 2500ms ease-out, color 2500ms ease-out, text-shadow 2500ms ease-out',
      color: `hsl(${pulseConfig.hue}, 90%, 65%)`,
      fontSize: '0.8rem',
      fontWeight: 600,
      fontStyle: 'italic',
      pointerEvents: 'none',
      textShadow: pulse ? `0 0 12px hsl(${pulseConfig.hue}, 90%, 65%)` : `0 0 2px rgba(0,0,0,0.5)`,
      letterSpacing: '0.05em',
      whiteSpace: 'nowrap'
    }}>
      te pagan por hora: estira la llamada
    </div>
  );
};
const PSALMS = [
  { ref: "Psalm 1:1", text: "Blessed is the man that walketh not in the counsel of the ungodly, nor standeth in the way of sinners, nor sitteth in the seat of the scornful." },
  { ref: "Psalm 23:1", text: "The LORD is my shepherd; I shall not want. He maketh me to lie down in green pastures: he leadeth me beside the still waters." },
  { ref: "Psalm 34:1", text: "I will bless the LORD at all times: his praise shall continually be in my mouth. My soul shall make her boast in the LORD." },
  { ref: "Psalm 46:1", text: "God is our refuge and strength, a very present help in trouble. Therefore will not we fear, though the earth be removed." },
  { ref: "Psalm 91:1", text: "He that dwelleth in the secret place of the most High shall abide under the shadow of the Almighty. I will say of the LORD, He is my refuge." },
  { ref: "Psalm 100:1", text: "Make a joyful noise unto the LORD, all ye lands. Serve the LORD with gladness: come before his presence with singing." },
  { ref: "Psalm 121:1", text: "I will lift up mine eyes unto the hills, from whence cometh my help. My help cometh from the LORD, which made heaven and earth." },
  { ref: "Psalm 133:1", text: "Behold, how good and how pleasant it is for brethren to dwell together in unity! It is like the precious ointment upon the head." }
];

const GuidanceHeader = ({ isActive, isBreakActive, stats, dailyGoal }) => {
  const currentMins = Math.round(stats.dailyMinutes || 0);
  const remaining = Math.max(0, dailyGoal - currentMins);
  const pct = Math.round((currentMins / (dailyGoal || 1)) * 100);
  
  const [psalmIdx, setPsalmIdx] = React.useState(() => Math.floor(Math.random() * PSALMS.length));
  
  const nextPsalm = () => setPsalmIdx(prev => (prev + 1) % PSALMS.length);

  const currentHour = new Date().getHours();
  const minsLeftInDay = Math.max(1, (24 - currentHour) * 60);
  const isUnreachable = remaining > minsLeftInDay;
  const safeGoal = Math.floor(minsLeftInDay * 0.9); // 90% utilization limit

  return (
    <div id="guidance-overlay" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', opacity: 0.9 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center' }}>
        <div className="guidance-stat-card glass-panel" style={{ padding: '0.8rem 1.2rem', border: '1px solid rgba(255,255,255,0.1)', minWidth: '180px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>Daily Progress</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#6ee7b7' }}>{pct}% <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>Done</span></div>
          <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>Mapped: {currentMins}m / {dailyGoal}m</div>
        </div>
        
        <div className="guidance-stat-card glass-panel" style={{ padding: '0.8rem 1.2rem', border: '1px solid rgba(255,255,255,0.1)', minWidth: '180px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>Target Action</div>
          {remaining > 0 ? (
            <>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: isUnreachable ? '#f87171' : '#fcd34d' }}>
                {isUnreachable ? `${safeGoal}m` : `${remaining}m`} 
                <span style={{ fontSize: '0.7rem', opacity: 0.5 }}> {isUnreachable ? 'Limit' : 'Left'}</span>
              </div>
              <div style={{ fontSize: '0.65rem', opacity: 0.8, color: isUnreachable ? '#f87171' : 'inherit' }}>
                {isUnreachable ? `⚠️ Goal unreachable today. Aim for ${safeGoal}m.` : 'to hit today\'s yield target'}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#10b981' }}>GOAL MET</div>
              <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>Exceeding today's quota!</div>
            </>
          )}
        </div>
      </div>

      <div className="psalm-study-card glass-panel" onClick={nextPsalm} style={{ padding: '2rem', maxWidth: '600px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', position: 'relative', transition: 'transform 0.2s', textAlign: 'center' }}>
        <div style={{ position: 'absolute', top: '0.5rem', right: '1rem', fontSize: '0.6rem', opacity: 0.3 }}>[Click for Next]</div>
        <div style={{ fontSize: '0.7rem', color: '#a855f7', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.8rem' }}>Study: {PSALMS[psalmIdx].ref}</div>
        <div style={{ fontSize: '1.1rem', fontStyle: 'italic', lineHeight: 1.5, color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
          "{PSALMS[psalmIdx].text}"
        </div>
      </div>

      <div style={{ animation: 'encouragePulse 3s infinite', fontSize: '0.9rem', color: isBreakActive ? '#fb923c' : 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
        {isBreakActive ? '⏸️ Recharge Mode: Break timer is active.' : '📡 Ready to connect. Awaiting incoming call.'}
      </div>
    </div>
  );
};


export const TranscriptionBoard = ({ captions, onClearAll, onReconnect, lastDataTime }) => {
  const bottomRef = useRef(null);
  const scrollAreaRef = useRef(null);
  const isScrolledUpRef = useRef(false);
  const scrollTimeoutRef = useRef(null);
  const [ttsMode, setTtsMode] = useState('manual');
  const [emphasisMode, setEmphasisMode] = useState('original'); 
  const [pinnedIds, setPinnedIds] = useState(() => JSON.parse(localStorage.getItem('catint_pinned')) || []);
  const { playTTS, stopTTS, isPlaying, playingUrl, prefetchTTS } = useTTS();
  const { playWarningPing } = useProgressiveAudio();
  const { playChaChing } = useRewardAudio();
  const { isEditingScoreboard, visibleCards, toggleCard, isActive, isBreakActive, isToolbarVisible, stats, dailyGoal } = useSession();
  const warnedBubblesRef = useRef(new Set());
  
  const [popover, setPopover] = useState({ show: false, x: 0, y: 0, text: '' });
  const popoverTimerRef = useRef(null);

  useEffect(() => {
    safeSet('catint_pinned', JSON.stringify(pinnedIds));
  }, [pinnedIds]);

  const togglePin = (id) => {
    setPinnedIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  useEffect(() => {
    if (!isScrolledUpRef.current) {
      // Instant scroll is much better for high-frequency updates to avoid 'fighting' the user
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    }

    const lastCap = captions[captions.length - 1];
    if (lastCap && lastCap.text) {
      const words = lastCap.text.trim().split(/\s+/).length;
      if (words >= 40 && !warnedBubblesRef.current.has(lastCap.id)) {
        playWarningPing();
        warnedBubblesRef.current.add(lastCap.id);
      }
    }
  }, [captions, playWarningPing]);

  const resetScrollTimer = () => {
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      // Automatic resume: If user hasn't scrolled for 15s, resume following the bottom
      isScrolledUpRef.current = false;
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 15000); 
  };

  const handleScroll = () => {
    if (!scrollAreaRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current;
    
    // We are at bottom if within 35px of the edge (allowing for bit of slack)
    const isAtBottom = scrollHeight - scrollTop - clientHeight <= 35;
    
    if (isAtBottom) {
      isScrolledUpRef.current = false;
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    } else {
      // User is looking at history
      isScrolledUpRef.current = true;
      resetScrollTimer();
    }
  };

  const handleWheel = (e) => {
    // ONLY lock if scrolling UP (deltaY < 0)
    // Scrolling down (deltaY > 0) should not lock, allowing handleScroll to unlock at bottom
    if (e.deltaY < 0) {
      isScrolledUpRef.current = true;
      resetScrollTimer();
    }
  };

  useEffect(() => {
    const handleSelectionChange = () => {
      if (popoverTimerRef.current) clearTimeout(popoverTimerRef.current);
      
      const selection = window.getSelection();
      const text = selection.toString().trim();
      
      if (text && text.length < 50) { // Limit to words/short phrases
        popoverTimerRef.current = setTimeout(() => {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setPopover({
            show: true,
            x: rect.left + window.scrollX,
            y: rect.top + window.scrollY - 40,
            text
          });
        }, 800); // Wait 800ms
      } else {
        if (popover.show) setPopover(p => ({ ...p, show: false }));
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      if (popoverTimerRef.current) clearTimeout(popoverTimerRef.current);
    };
  }, [popover.show]);

  const handleLookup = (text) => {
    const url = `https://www.linguee.com/english-spanish/search?source=auto&query=${encodeURIComponent(text)}`;
    window.open(url, 'LingueeLookup', 'width=800,height=600,scrollbars=yes');
    setPopover(p => ({ ...p, show: false }));
  };

  return (
    <div className="glass-panel transcription-area" style={{ position: 'relative' }}>
      <CoinRain isActive={isActive} onCollect={playChaChing} />
      <ReminderMessage isActive={isActive} />
      {popover.show && (
        <div style={{
          position: 'fixed',
          top: popover.y,
          left: popover.x,
          zIndex: 10000,
          background: '#3b82f6',
          color: 'white',
          padding: '4px 10px',
          borderRadius: '4px',
          fontSize: '0.8rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          cursor: 'pointer',
          animation: 'fadeSlideIn 0.2s ease-out'
        }} onClick={() => handleLookup(popover.text)}>
          🔍 Look up "{popover.text}"
        </div>
      )}

      {isToolbarVisible && (isEditingScoreboard || visibleCards.transcription) && (
      <div className="notepad-header transcription-toolbar" style={{ borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.4rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.5rem', opacity: (!visibleCards.transcription && isEditingScoreboard) ? 0.3 : 1, position: 'relative' }}>
        {isEditingScoreboard && <input type="checkbox" checked={visibleCards.transcription} onChange={() => toggleCard('transcription')} style={{ position: 'absolute', top: 4, right: 4, transform: 'scale(1.2)', cursor: 'pointer', zIndex: 10 }} />}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingRight: isEditingScoreboard ? '1.5rem' : '0' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Livestream 
          </h2>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <button 
              onClick={() => setEmphasisMode(m => m === 'original' ? 'flipped' : 'original')}
              className="btn"
              style={{
                background: emphasisMode === 'flipped' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)',
                color: emphasisMode === 'flipped' ? '#93c5fd' : 'var(--text-muted)',
                border: emphasisMode === 'flipped' ? '1px solid rgba(59,130,246,0.4)' : '1px solid var(--panel-border)',
                padding: '0.2rem 0.5rem',
                fontSize: '0.7rem'
              }}
              title="Toggle text emphasis: original (white) vs translation-first (blue)"
            >
              {emphasisMode === 'flipped' ? '🔵 Transl. Focus' : '⚪ Source Focus'}
            </button>
            <button
              onClick={() => setTtsMode(m => m === 'manual' ? 'auto' : 'manual')}
              className="btn" 
              style={{ 
                background: ttsMode === 'auto' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)', 
                color: ttsMode === 'auto' ? '#10b981' : 'var(--text-muted)', 
                border: ttsMode === 'auto' ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid var(--panel-border)',
                boxShadow: ttsMode === 'auto' ? '0 0 8px rgba(16, 185, 129, 0.3)' : 'none',
                padding: '0.2rem 0.5rem', 
                fontSize: '0.7rem' 
              }}
              title="Toggle Auto TTS Mode"
            >
              {ttsMode === 'auto' ? '🤖 Auto AI' : '⚙️ Auto OFF'}
            </button>
            <button 
              onClick={stopTTS} 
              className="btn" 
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', opacity: isPlaying ? 1 : 0.5 }}
              disabled={!isPlaying}
            >
              🛑 Stop AI
            </button>
            {onClearAll && (
              <button onClick={onClearAll} className="btn" style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--panel-border)', padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>
                🗑️ Clear
              </button>
            )}
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', opacity: 0.6, marginLeft: '0.2rem' }} title="Translating long bubbles over 40 words is not recommended. Turns orange at 34 words.">
              ⚠️ 40 words limit
            </span>
          </div>
        </div>
      </div>
      )}
      <div 
        className="scroll-area" 
        style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }} 
        onScroll={handleScroll}
        onWheel={handleWheel}
        ref={scrollAreaRef}
        title="Selecting any word will show a dictionary popover after a brief moment"
      >
        <div style={{ flex: '1 1 auto' }} />
        

        {/* Pinned Reference Section REMOVED - Pins now highlight in-place */}

        {captions.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {!isActive ? (
              <GuidanceHeader isActive={isActive} isBreakActive={isBreakActive} stats={stats} dailyGoal={dailyGoal} />
            ) : (
              <div id="offline-messenger" style={{ 
                color: 'var(--text-muted)', 
                fontStyle: 'italic', 
                fontWeight: 400, 
                textAlign: 'center', 
                marginBottom: '20vh'
              }}>
                📡 Standing by... waiting for patient audio.
              </div>
            )}
            {(!isActive && !isBreakActive && (Date.now() - (lastDataTime || 0) < 5000)) && (
              <div id="call-detected-reminder" onClick={onReconnect} style={{
                position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)',
                background: 'rgba(16, 185, 129, 0.95)', color: '#fff', padding: '1.5rem 3rem', borderRadius: '1rem',
                boxShadow: '0 0 30px rgba(16, 185, 129, 0.5)', cursor: 'pointer', zIndex: 1000,
                textAlign: 'center', animation: 'pulseReminder 1s infinite alternate'
              }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>📞 CALL DETECTED!</div>
                <div style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: '0.5rem' }}>Click here to connect app & start session</div>
              </div>
            )}
          </div>
        )}
        {captions.map((cap, i) => {
          if (!cap.text || !cap.text.trim()) return null;
          const isSameAsPrevious = i > 0 && captions[i-1].lang === cap.lang;
          const wordCount = cap.text.trim().split(/\s+/).length;
          const isPinned = pinnedIds.includes(cap.id);
          const isSplitContinuation = isSameAsPrevious && wordCount < 50; // Simple heuristic for split segments
          
          return (
            <div key={cap.id || i} className="transcript-bubble" style={{ 
              opacity: cap.isFinal === false ? 0.8 : 1,
              marginTop: isSplitContinuation ? '0rem' : '0.1rem',
              padding: '0rem',
              position: 'relative',
              border: isPinned ? '2px solid #3b82f6' : 'none',
              borderRadius: isPinned ? '8px' : '6px',
              backgroundColor: isPinned ? 'rgba(59, 130, 246, 0.08)' : (getBubbleStyle(cap.text, cap.isFinal === false, cap.lang).backgroundColor),
              boxShadow: isPinned ? '0 0 15px rgba(59, 130, 246, 0.2)' : 'none',
              ...getBubbleStyle(cap.text, cap.isFinal === false, cap.lang)
            }}>
              {/* PIN EMOJI - Centered at top */}
              {isPinned && (
                <div style={{ 
                  position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', 
                  fontSize: '0.6rem', filter: 'drop-shadow(0 0 2px #3b82f6)',
                  zIndex: 5
                }}>📌</div>
              )}
              {(!isSameAsPrevious && !cap.isSplit) && (
                <div style={{ position: 'absolute', top: '2px', left: '4px', zIndex: 5, pointerEvents: 'none' }}>
                  <span style={{ fontSize: '0.45rem', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 900 }}>
                    {cap.lang === 'es' ? 'SPA' : 'ENG'}
                  </span>
                </div>
              )}
              
              <button 
                onClick={() => togglePin(cap.id)} 
                className="pin-bubble-btn"
                style={{ 
                  position: 'absolute', top: '-10px', right: '-10px', zIndex: 20,
                  background: isPinned ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '50%', width: '22px', height: '22px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem', cursor: 'pointer',
                  opacity: isPinned ? 1 : 0,
                  transition: 'all 0.2s',
                  boxShadow: isPinned ? '0 0 10px rgba(59,130,246,0.5)' : 'none'
                }}
                title={isPinned ? "Unpin" : "Pin"}
              >
                📌
              </button>
              <TranslatedBubble 
                id={cap.id} text={cap.text} lang={cap.lang} playTTS={playTTS} stopTTS={stopTTS} playingUrl={playingUrl} prefetchTTS={prefetchTTS} 
                reverse={cap.lang === 'es'} ttsMode={ttsMode} wordCount={wordCount} turnWordCount={cap.turnWordCount} shouldPrefetch={i >= captions.length - 3} 
                emphasisMode={emphasisMode} isPinned={isPinned} onTogglePin={togglePin} 
                isRedundantCount={i > 0 && captions[i-1].turnWordCount === cap.turnWordCount}
              />
            </div>
          );
        })}
        <div id="scroll-bottom-anchor" ref={bottomRef} style={{ height: '24px', flexShrink: 0, pointerEvents: 'none' }} />
      </div>
    </div>
  );
};
