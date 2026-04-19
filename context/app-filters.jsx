"use client";

import { createContext, useContext, useState, useCallback } from "react";

const now = new Date();
const AppFiltersContext = createContext(null);

export function AppFiltersProvider({ children }) {
  const [month, setMonthState] = useState(now.getMonth() + 1);
  const [year, setYearState] = useState(now.getFullYear());
  const setMonth = useCallback((m) => setMonthState(Number(m)), []);
  const setYear = useCallback((y) => setYearState(Number(y)), []);

  return (
    <AppFiltersContext.Provider value={{ month, year, setMonth, setYear }}>
      {children}
    </AppFiltersContext.Provider>
  );
}

export function useAppFilters() {
  const ctx = useContext(AppFiltersContext);
  if (!ctx) {
    const now = new Date();
    return {
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      setMonth: () => {},
      setYear: () => {},
    };
  }
  return ctx;
}
