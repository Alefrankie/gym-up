// src/components/rest-timer.tsx
//
// Story 2.5 — Rest Timer. React island component for the rest timer
// between sets. Per docs/architecture/components.md (RestTimer table) +
// docs/architecture/decisions/002-chartjs-react-island.md (React island).
//
// Per FR-WT-011: 90s default countdown, +30s extend, skip, vibration on end.
// Per AC-2.5-02: client-side only, no DB persistence. State is reset on
// page reload (acceptable — the spec is explicit).
//
// Triggered by the page's script via `window.dispatchEvent(
// new CustomEvent('rest-timer:start'))` when the completed checkbox is
// toggled to true. Decoupled from React — the page's script is vanilla
// TS, the timer is React.

import { useState, useEffect, useRef } from 'react';
import { WorkoutEntryRules } from '../lib/contexts/workout-tracking/domain/workout-tracking.constants';
import '../styles/rest-timer.css';

interface RestTimerProps {
  defaultSeconds?: number;
}

const TICK_MS = 1000;

export default function RestTimer({ defaultSeconds = WorkoutEntryRules.DefaultRestSeconds }: RestTimerProps) {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(defaultSeconds);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const intervalRef = useRef<number | null>(null);

  // Listen for the `rest-timer:start` event dispatched by the page's script
  // when the completed checkbox is toggled to true. Each event restarts
  // the countdown to `defaultSeconds`.
  useEffect(() => {
    function handleStart(): void {
      setSecondsRemaining(defaultSeconds);
      setIsRunning(true);
    }
    window.addEventListener('rest-timer:start', handleStart);
    return () => {
      window.removeEventListener('rest-timer:start', handleStart);
    };
  }, [defaultSeconds]);

  // Tick down every second. On reach 0, vibrate (mobile only — desktop
  // ignores gracefully) and stop.
  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = window.setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate(200);
          }
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, TICK_MS);
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning]);

  // Don't render until the first `rest-timer:start` event. This keeps the
  // DOM clean before the user marks a set as completed.
  if (!isRunning && secondsRemaining === defaultSeconds) {
    return null;
  }

  const handlePlus30 = (): void => {
    setSecondsRemaining((prev) => prev + 30);
  };

  const handleSkip = (): void => {
    setIsRunning(false);
    setSecondsRemaining(defaultSeconds);
  };

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="rest-timer" role="status" aria-live="polite">
      <span className="rest-timer-display" aria-label={`${secondsRemaining} segundos restantes`}>
        {display}
      </span>
      <button type="button" className="rest-timer-plus" onClick={handlePlus30}>
        +30s
      </button>
      <button type="button" className="rest-timer-skip" onClick={handleSkip}>
        Saltar
      </button>
    </div>
  );
}
