import React, { useState } from 'react';

// ─── EmojiRow ─────────────────────────────────────────────────────────────────
// Renders fullCount full emojis + one partially-cropped emoji representing the
// fractional remainder. Uses CSS clip-path on a wrapper for zero-DOM overhead.
const EmojiRow = ({ emoji, value, unitValue, maxValue, color = '#fff', label, sublabel, warnThreshold = 0.3 }) => {
  const fullCount  = Math.floor(value / unitValue);
  const fraction   = (value % unitValue) / unitValue; // 0–1
  const maxCount   = Math.ceil(maxValue / unitValue);
  const emptyCount = Math.max(0, maxCount - fullCount - (fraction > 0 ? 1 : 0));

  // Colour the row based on progress ratio
  const ratio = maxValue > 0 ? value / maxValue : 0;
  const rowColor = ratio >= 1 ? '#10b981'           // done – green
                : ratio >= 0.7 ? '#34d399'          // near – light green
                : ratio >= 0.4 ? '#fcd34d'          // mid  – amber
                : ratio >= warnThreshold ? '#f97316'// low  – orange
                : '#ef4444';                         // danger – red

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
      {/* Row label */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.55rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        <span>{label}</span>
        <span style={{ color: rowColor, fontWeight: 700 }}>{sublabel}</span>
      </div>

      {/* Emoji track */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1px', lineHeight: 1 }}>

        {/* Full emojis */}
        {Array.from({ length: Math.min(fullCount, maxCount) }).map((_, i) => (
          <span key={`f${i}`} style={{ fontSize: '1.2rem', filter: `drop-shadow(0 0 4px ${rowColor}88)` }}>
            {emoji}
          </span>
        ))}

        {/* Partial emoji – clipped by fraction using inline overflow trick */}
        {fraction > 0.04 && fullCount < maxCount && (
          <span style={{
            display: 'inline-block',
            overflow: 'hidden',
            width:  `calc(${fraction} * 1.3rem)`, // clip to fraction of full width
            fontSize: '1.2rem',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            filter: `drop-shadow(0 0 3px ${rowColor}66)`,
            opacity: 0.85
          }}>
            {emoji}
          </span>
        )}

        {/* Ghost (empty) emojis to show remaining capacity */}
        {Array.from({ length: Math.min(emptyCount, 30) }).map((_, i) => (
          <span key={`e${i}`} style={{ fontSize: '1.2rem', opacity: 0.1 }}>
            {emoji}
          </span>
        ))}
      </div>
    </div>
  );
};

// ─── DirectionalCue ──────────────────────────────────────────────────────────
// A single punchy line telling the player what to do next.
const DirectionalCue = ({ pacePrediction, dailyGoal, totalDailyMins, breakLeft, qualityScore, cutoffWarning }) => {
  if (cutoffWarning?.pulse) return (
    <div style={{ color: '#ef4444', fontWeight: 900, fontSize: '0.75rem', animation: 'pulseWarning 1s infinite' }}>
      🚨 HARD STOP {cutoffWarning.label} — LOG OUT NOW
    </div>
  );
  if (totalDailyMins >= dailyGoal) return (
    <div style={{ color: '#10b981', fontWeight: 800, fontSize: '0.75rem' }}>✅ Daily bounty secured — every min now is pure bonus!</div>
  );
  if (pacePrediction?.detail === 'past 20:00 cutoff') return (
    <div style={{ color: '#f59e0b', fontWeight: 800, fontSize: '0.75rem' }}>⚡ Behind pace — push hard to hit daily target before cutoff</div>
  );
  if (qualityScore?.goalUnreachable) return (
    <div style={{ color: '#f97316', fontWeight: 800, fontSize: '0.75rem' }}>⚡ Cap hit — adapt target to ~{qualityScore.suggestedGoal}m and give it all</div>
  );
  if (breakLeft <= 0) return (
    <div style={{ color: '#ef4444', fontWeight: 800, fontSize: '0.75rem' }}>⚠️ Break budget gone — stay on calls to protect your score</div>
  );
  if (qualityScore && qualityScore.pct >= 100) return (
    <div style={{ color: '#34d399', fontWeight: 800, fontSize: '0.75rem' }}>🔥 On pace — ETA {pacePrediction?.label}. Keep the streak alive.</div>
  );
  return (
    <div style={{ color: '#93c5fd', fontWeight: 700, fontSize: '0.75rem' }}>
      🎯 Need {Math.round(Math.max(0, dailyGoal - totalDailyMins))}m more — projected done by {pacePrediction?.label || '?'}
    </div>
  );
};

// ─── GameScoreboard ───────────────────────────────────────────────────────────
// Props mirror the computed values already in DashboardHeader.
export const GameScoreboard = ({
  // Money
  liveDailyArs, dailyTargetArs, monthlyArs, monthlyTargetArs,
  // Time
  stats, dailyGoal, totalDailyMins, shiftElapsedMins,
  // Intelligence
  pacePrediction, qualityScore, cutoffWarning,
  // Break
  breakLeft, breakLimit,
  // Ladder
  nextGoalLabel, nextMilestone,
  // Monthly
  daysInMonth, currentDay, remainingDays,
  // onSwitch back to numbers
  onSwitchToNumbers
}) => {
  const [tab, setTab] = useState('day'); // 'day' | 'month'

  // ── UNIT VALUES ─────────────────────────────────────────────────────────────
  const ARS_UNIT    = 10000;  // 1 💰 = 10k ARS
  const MIN_UNIT    = 30;     // 1 ⏱️ = 30 productive mins

  // Day view
  const dayArsMax   = Math.max(dailyTargetArs, liveDailyArs, ARS_UNIT);
  const dayMinMax   = Math.max(dailyGoal, totalDailyMins, MIN_UNIT);
  const breakUsed   = Math.max(0, breakLimit - breakLeft);

  // Month view
  const moArsMax    = Math.max(monthlyTargetArs, monthlyArs, ARS_UNIT);
  const moMinMax    = Math.max(stats.goalMinutes, stats.monthlyMinutes, MIN_UNIT);

  // Progress pct labels
  const dayArsPct   = dailyTargetArs > 0 ? Math.round((liveDailyArs  / dailyTargetArs)  * 100) : 0;
  const dayMinPct   = dailyGoal      > 0 ? Math.round((totalDailyMins / dailyGoal)        * 100) : 0;
  const moArsPct    = monthlyTargetArs > 0 ? Math.round((monthlyArs    / monthlyTargetArs) * 100) : 0;
  const moMinPct    = stats.goalMinutes  > 0 ? Math.round((stats.monthlyMinutes / stats.goalMinutes) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', padding: '0.35rem 0.5rem', fontFamily: 'inherit' }}>

      {/* Header row — tabs + numeric toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.2rem' }}>
          {['day', 'month'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              fontSize: '0.58rem', padding: '0.15rem 0.45rem', borderRadius: '4px',
              border: tab === t ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.08)',
              background: tab === t ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: tab === t ? '#fff' : 'rgba(255,255,255,0.35)',
              cursor: 'pointer', fontWeight: tab === t ? 700 : 400, textTransform: 'uppercase'
            }}>{t === 'day' ? '☀️ Day' : '🗓️ Month'}</button>
          ))}
        </div>
        <button onClick={onSwitchToNumbers} style={{
          fontSize: '0.52rem', padding: '0.1rem 0.35rem', borderRadius: '3px',
          border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
          color: 'rgba(255,255,255,0.25)', cursor: 'pointer'
        }} title="Switch to number view">123</button>
      </div>

      {/* ── DAY TAB ── */}
      {tab === 'day' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>

          <EmojiRow
            emoji="💰" value={liveDailyArs} unitValue={ARS_UNIT}
            maxValue={dailyTargetArs > 0 ? dayArsMax : ARS_UNIT * 5}
            label={`earned   AR$${Math.round(liveDailyArs / 1000)}k / AR$${Math.round(dailyTargetArs / 1000)}k`}
            sublabel={`${dayArsPct}%`}
          />

          <EmojiRow
            emoji="⏱️" value={totalDailyMins} unitValue={MIN_UNIT}
            maxValue={dayMinMax}
            label={`mins   ${Math.round(totalDailyMins)}m / ${Math.round(dailyGoal)}m`}
            sublabel={`${dayMinPct}%`}
          />

          {/* Break budget — inverted: empty = good (more left) */}
          <EmojiRow
            emoji="☕" value={breakLeft} unitValue={15}
            maxValue={breakLimit}
            label={`break left   ${Math.round(breakLeft)}m / ${breakLimit}m`}
            sublabel={breakLeft > 30 ? 'OK' : breakLeft > 0 ? 'LOW' : 'GONE'}
            warnThreshold={0.5}
          />

          {/* Directional cue */}
          <DirectionalCue
            pacePrediction={pacePrediction} dailyGoal={dailyGoal}
            totalDailyMins={totalDailyMins} breakLeft={breakLeft}
            qualityScore={qualityScore} cutoffWarning={cutoffWarning}
          />
        </div>
      )}

      {/* ── MONTH TAB ── */}
      {tab === 'month' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>

          <EmojiRow
            emoji="💰" value={monthlyArs} unitValue={ARS_UNIT * 5}
            maxValue={moArsMax}
            label={`monthly ARS   $${Math.round(monthlyArs / 1000)}k / $${Math.round(monthlyTargetArs / 1000)}k`}
            sublabel={`${moArsPct}%`}
          />

          <EmojiRow
            emoji="⏱️" value={stats.monthlyMinutes} unitValue={MIN_UNIT * 4}
            maxValue={moMinMax}
            label={`monthly mins   ${Math.round(stats.monthlyMinutes)}m / ${stats.goalMinutes}m`}
            sublabel={`${moMinPct}%`}
          />

          {/* Days consumed */}
          <EmojiRow
            emoji="📅" value={currentDay} unitValue={1}
            maxValue={daysInMonth}
            label={`day ${currentDay} of ${daysInMonth}   (${remainingDays}d left)`}
            sublabel={`${Math.round((currentDay / daysInMonth) * 100)}% thru month`}
          />

          {/* Next ladder step */}
          <div style={{ fontSize: '0.6rem', color: '#a855f7', fontWeight: 700, padding: '0.15rem 0', letterSpacing: '0.04em' }}>
            🪜 NEXT — {nextGoalLabel} ({nextMilestone}m)
          </div>
        </div>
      )}
    </div>
  );
};
