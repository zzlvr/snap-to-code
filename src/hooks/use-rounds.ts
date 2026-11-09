"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "snap-to-code:rounds";
export const MAX_ROUNDS = 3;
const DEFAULT_ROUNDS = 1;

/** How many correction rounds run after a generation (0 = off). Remembered in this browser only. */
export function useRounds() {
  const [rounds, setRoundsState] = useState(DEFAULT_ROUNDS);

  useEffect(() => {
    try {
      const n = Number(localStorage.getItem(KEY));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage after mount
      if (localStorage.getItem(KEY) !== null && Number.isInteger(n) && n >= 0 && n <= MAX_ROUNDS) setRoundsState(n);
    } catch {
      /* storage unavailable: keep the default */
    }
  }, []);

  const setRounds = useCallback((n: number) => {
    setRoundsState(n);
    try {
      localStorage.setItem(KEY, String(n));
    } catch {
      /* ignore */
    }
  }, []);

  return { rounds, setRounds };
}
