"use client";

import { createContext, useContext, useState, useCallback } from "react";

const PageHeaderContext = createContext(null);

export function PageHeaderProvider({ children }) {
  const [header, setHeaderState] = useState({
    title: null,
    description: null,
    action: null,
  });

  const setPageHeader = useCallback(({ title = null, description = null, action = null }) => {
    setHeaderState({ title, description, action });
  }, []);

  return (
    <PageHeaderContext.Provider value={{ ...header, setPageHeader }}>
      {children}
    </PageHeaderContext.Provider>
  );
}

export function usePageHeader() {
  const ctx = useContext(PageHeaderContext);
  if (!ctx) throw new Error("usePageHeader must be used within PageHeaderProvider");
  return ctx;
}
