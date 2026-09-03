import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { nanoid } from "nanoid";

interface QuoteContextType {
  sessionToken: string;
  cartCount: number;
  setCartCount: (n: number) => void;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
}

const QuoteContext = createContext<QuoteContextType | null>(null);

const SESSION_KEY = "itt_quote_session";

export function QuoteProvider({ children }: { children: React.ReactNode }) {
  const [sessionToken] = useState<string>(() => {
    if (typeof window === "undefined") return nanoid();
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) return stored;
    const token = nanoid(32);
    localStorage.setItem(SESSION_KEY, token);
    return token;
  });

  const [cartCount, setCartCount] = useState(0);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);
  const toggleCart = useCallback(() => setIsCartOpen((v) => !v), []);

  return (
    <QuoteContext.Provider value={{ sessionToken, cartCount, setCartCount, isCartOpen, openCart, closeCart, toggleCart }}>
      {children}
    </QuoteContext.Provider>
  );
}

export function useQuote() {
  const ctx = useContext(QuoteContext);
  if (!ctx) throw new Error("useQuote must be used within QuoteProvider");
  return ctx;
}
