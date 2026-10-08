import React, { useState, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X, Check, Lock, Info, Flame } from 'lucide-react';
import { sounds } from '../utils/audio.js';
import { getDailyCalendarMonth, getTodayDateString } from '../services/dailyChallenge.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function DailyCalendarModal({
  isOpen,
  onClose,
  onSelectDate,
  todayDateStr = getTodayDateString(),
  refreshKey = 0
}) {
  const [todayYear, todayMonth] = useMemo(() => {
    return todayDateStr.split('-').map(Number);
  }, [todayDateStr]);

  const [currentYear, setCurrentYear] = useState(todayYear);
  const [currentMonth, setCurrentMonth] = useState(todayMonth); // 1-12

  const monthData = useMemo(() => {
    if (!isOpen) return { days: [], canGoPrev: false, canGoNext: false, startDayOfWeek: 0 };
    return getDailyCalendarMonth(currentYear, currentMonth, todayDateStr);
  }, [isOpen, currentYear, currentMonth, todayDateStr, refreshKey]);

  if (!isOpen) return null;

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (!monthData?.canGoPrev) return;
    try { sounds.playTap(); } catch (_) {}
    if (currentMonth === 1) {
      setCurrentYear(prev => prev - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (!monthData?.canGoNext) return;
    try { sounds.playTap(); } catch (_) {}
    if (currentMonth === 12) {
      setCurrentYear(prev => prev + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleDateClick = (day) => {
    if (!day.isActive || day.isCompleted) return;
    try { sounds.playTap(); } catch (_) {}
    if (onSelectDate) {
      onSelectDate(day.dateStr);
    }
    if (onClose) {
      onClose();
    }
  };

  const monthTitle = `${MONTH_NAMES[currentMonth - 1]} ${currentYear}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Past Daily Challenges Calendar"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '440px',
          background: 'linear-gradient(135deg, rgba(22, 28, 48, 0.96) 0%, rgba(12, 16, 32, 0.98) 100%)',
          border: '1.5px solid rgba(0, 240, 255, 0.4)',
          borderRadius: '24px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(0, 240, 255, 0.25)',
          padding: '22px 20px 18px 20px',
          color: '#ffffff',
          boxSizing: 'border-box'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #00f0ff, #7928ca)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 12px rgba(0, 240, 255, 0.5)'
              }}
            >
              <Calendar size={20} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontSize: '0.98rem', fontWeight: 900, letterSpacing: '0.4px', color: '#ffffff' }}>
                PAST CHALLENGES
              </div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: 600 }}>
                Play uncompleted sets • Unranked
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              try { sounds.playTap(); } catch (_) {}
              if (onClose) onClose();
            }}
            aria-label="Close calendar"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Month Navigation */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            background: 'rgba(0, 0, 0, 0.35)',
            borderRadius: '12px',
            marginBottom: '14px',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <button
            onClick={handlePrevMonth}
            disabled={!monthData.canGoPrev}
            aria-label="Previous month"
            style={{
              background: 'none',
              border: 'none',
              color: monthData.canGoPrev ? '#00f0ff' : 'rgba(255, 255, 255, 0.2)',
              cursor: monthData.canGoPrev ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px'
            }}
          >
            <ChevronLeft size={22} />
          </button>

          <span style={{ fontSize: '0.92rem', fontWeight: 800, letterSpacing: '0.5px' }}>
            {monthTitle}
          </span>

          <button
            onClick={handleNextMonth}
            disabled={!monthData.canGoNext}
            aria-label="Next month"
            style={{
              background: 'none',
              border: 'none',
              color: monthData.canGoNext ? '#00f0ff' : 'rgba(255, 255, 255, 0.2)',
              cursor: monthData.canGoNext ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px'
            }}
          >
            <ChevronRight size={22} />
          </button>
        </div>

        {/* Weekday Labels */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '6px',
            textAlign: 'center',
            fontSize: '0.72rem',
            fontWeight: 800,
            color: 'rgba(255, 255, 255, 0.45)',
            marginBottom: '6px',
            textTransform: 'uppercase'
          }}
        >
          {WEEKDAY_NAMES.map(w => (
            <div key={w}>{w}</div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '6px',
            marginBottom: '16px'
          }}
        >
          {/* Empty spacer cells before startDayOfWeek */}
          {Array.from({ length: monthData.startDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} style={{ height: '46px' }} />
          ))}

          {/* Month Days */}
          {monthData.days.map((day) => {
            const isCompleted = day.isCompleted;
            const isFuture = day.isFuture;
            const isActive = day.isActive;
            const isToday = day.isToday;

            let bg = 'rgba(255, 255, 255, 0.04)';
            let borderColor = 'rgba(255, 255, 255, 0.1)';
            let textColor = '#ffffff';
            let shadow = 'none';

            if (isCompleted) {
              bg = 'rgba(0, 255, 135, 0.12)';
              borderColor = 'rgba(0, 255, 135, 0.35)';
              textColor = 'var(--accent-green)';
            } else if (isActive) {
              bg = 'linear-gradient(135deg, rgba(0, 240, 255, 0.18), rgba(121, 40, 202, 0.18))';
              borderColor = 'rgba(0, 240, 255, 0.6)';
              textColor = '#ffffff';
              shadow = '0 0 10px rgba(0, 240, 255, 0.3)';
            } else if (isFuture) {
              bg = 'rgba(255, 255, 255, 0.02)';
              borderColor = 'rgba(255, 255, 255, 0.06)';
              textColor = 'rgba(255, 255, 255, 0.2)';
            }

            return (
              <button
                key={day.dateStr}
                onClick={() => handleDateClick(day)}
                disabled={!isActive}
                aria-label={`Date ${day.dateStr}${isCompleted ? ' completed' : isActive ? ' available to play' : ' locked'}`}
                style={{
                  position: 'relative',
                  height: '46px',
                  borderRadius: '10px',
                  background: bg,
                  border: `1.5px solid ${borderColor}`,
                  boxShadow: shadow,
                  color: textColor,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2px',
                  cursor: isActive ? 'pointer' : 'default',
                  opacity: isFuture ? 0.4 : 1,
                  transition: 'all 0.15s ease'
                }}
              >
                <span
                  style={{
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    lineHeight: 1
                  }}
                >
                  {day.dayNumber}
                </span>

                <div
                  style={{
                    height: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: '2px'
                  }}
                >
                  {isCompleted ? (
                    <Check size={13} color="var(--accent-green)" strokeWidth={3} />
                  ) : isActive ? (
                    <span
                      style={{
                        fontSize: '0.58rem',
                        fontWeight: 900,
                        letterSpacing: '0.5px',
                        color: 'var(--accent-cyan)',
                        textTransform: 'uppercase'
                      }}
                    >
                      PLAY
                    </span>
                  ) : isFuture ? (
                    <Lock size={10} color="rgba(255, 255, 255, 0.3)" />
                  ) : null}
                </div>

                {isToday && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '2px',
                      right: '3px',
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      background: 'var(--accent-gold)'
                    }}
                    title="Today"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            padding: '8px',
            background: 'rgba(0, 0, 0, 0.25)',
            borderRadius: '10px',
            fontSize: '0.72rem',
            color: 'rgba(255, 255, 255, 0.65)',
            marginBottom: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--accent-cyan)',
                boxShadow: '0 0 6px var(--accent-cyan)'
              }}
            />
            <span>Playable</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Check size={12} color="var(--accent-green)" strokeWidth={3} />
            <span>Completed</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Lock size={11} color="rgba(255, 255, 255, 0.4)" />
            <span>Locked</span>
          </div>
        </div>

        {/* Unranked Leaderboard Notice */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.68rem',
            color: 'rgba(255, 255, 255, 0.55)',
            lineHeight: 1.3,
            padding: '0 4px'
          }}
        >
          <Info size={13} color="var(--accent-gold)" style={{ flexShrink: 0 }} />
          <span>Past challenges do not count toward daily global leaderboards.</span>
        </div>
      </div>
    </div>
  );
}
