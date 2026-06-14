'use client';

import React, { createContext, useContext } from 'react';

// Create a simplified context that doesn't manipulate the DOM
const BackgroundContext = createContext<{
  // This is kept only for API compatibility but won't be used to manipulate DOM
  setBackgroundClass: (className: string | null) => void;
}>({
  setBackgroundClass: () => {},
});

// Hook to use the background context
export const useBackground = () => useContext(BackgroundContext);

// Provider component
export function BackgroundProvider({ children }: { children: React.ReactNode }) {
  // No-op function that doesn't change the DOM
  const setBackgroundClass = (className: string | null) => {
    // Intentionally left empty to avoid hydration mismatches
    console.log('Background class changes are disabled to avoid hydration mismatches');
  };

  return (
    <BackgroundContext.Provider value={{ setBackgroundClass }}>
      {children}
    </BackgroundContext.Provider>
  );
} 