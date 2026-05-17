import { writable } from 'svelte/store';

export type CelebrationLevel = 'small' | 'big';

export interface CelebrationPulse {
  id: number;
  level: CelebrationLevel;
}

export const celebrationPulses = writable<CelebrationPulse[]>([]);

let nextId = 1;
const PULSE_LIFETIME_MS = 1600;

export function celebrate(level: CelebrationLevel = 'small'): void {
  if (typeof window === 'undefined') return;
  const id = nextId++;
  celebrationPulses.update(arr => [...arr, { id, level }]);
  window.setTimeout(() => {
    celebrationPulses.update(arr => arr.filter(p => p.id !== id));
  }, PULSE_LIFETIME_MS);
}
