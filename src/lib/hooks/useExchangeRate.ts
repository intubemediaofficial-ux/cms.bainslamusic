"use client";

import { useState, useEffect, useCallback } from "react";

interface ExchangeRateData {
  rate: number;
  loading: boolean;
  date: string;
  lastFetched: string;
}

const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

const rateCache: Record<string, { rate: number; date: string; fetchedAt: number }> = {};

export function useExchangeRate(currency: string = "USD"): ExchangeRateData {
  const [rate, setRate] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [lastFetched, setLastFetched] = useState("");

  const fetchRate = useCallback(async (key: string) => {
    try {
      const res = await fetch(`/api/exchange-rate?action=getTodayRate&currencies=${key}`);
      if (res.ok) {
        const json = await res.json();
        const r = json.data?.rates?.[key];
        if (r) {
          const now = Date.now();
          rateCache[key] = { rate: r, date: json.data?.date || "", fetchedAt: now };
          setRate(r);
          setDate(json.data?.date || "");
          setLastFetched(new Date(now).toLocaleTimeString());
        }
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    const key = currency.toUpperCase();
    if (key === "INR") {
      setRate(1);
      setLoading(false);
      return;
    }

    const cached = rateCache[key];
    const isStale = !cached || (Date.now() - cached.fetchedAt > REFRESH_INTERVAL);

    if (cached && !isStale) {
      setRate(cached.rate);
      setDate(cached.date);
      setLastFetched(new Date(cached.fetchedAt).toLocaleTimeString());
      setLoading(false);
    } else {
      if (cached) {
        setRate(cached.rate);
        setDate(cached.date);
        setLastFetched(new Date(cached.fetchedAt).toLocaleTimeString());
        setLoading(false);
      }
      fetchRate(key);
    }

    const interval = setInterval(() => fetchRate(key), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [currency, fetchRate]);

  return { rate, loading, date, lastFetched };
}

export function toINR(amount: number, rate: number): number {
  return Math.round(amount * rate);
}

export const SUPPORTED_CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
] as const;

export function getCurrencySymbol(code: string): string {
  const c = SUPPORTED_CURRENCIES.find((s) => s.code === code);
  return c?.symbol || code;
}
