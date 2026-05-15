import { useEffect, useRef, useState } from 'react';
import { loadJSON, saveJSON } from '../lib/storage';

export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => loadJSON<T>(key, initial));
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    saveJSON(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}
