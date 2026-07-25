import { kv } from "@/lib/redis";

export const dynamic = "force-dynamic";

const RATE_PREFIX = "exchange_rate:";
const CACHE_TTL = 21600; // 6 hours

function isKVAvailable(): boolean {
  return true; // Always available — using DigitalOcean Redis
}

interface DailyRate {
  currency: string;
  date: string;
  rateToInr: number;
  source: string;
  lastUpdatedAt: string;
}

async function fetchRateFromAPI(currency: string, date: string): Promise<number | null> {
  // Try exchangerate-api.com (free, no key needed for historical)
  try {
    const [year, month, day] = date.split("-");
    const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${year}-${month}-${day}/v1/currencies/${currency.toLowerCase()}.json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      const rate = data?.[currency.toLowerCase()]?.inr;
      if (rate && typeof rate === "number") return rate;
    }
  } catch { /* fallback below */ }

  // Fallback: latest rate from open API
  try {
    const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${currency.toLowerCase()}.json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      const rate = data?.[currency.toLowerCase()]?.inr;
      if (rate && typeof rate === "number") return rate;
    }
  } catch { /* fallback below */ }

  // Final fallback: exchangerate.host
  try {
    const url = `https://api.exchangerate.host/convert?from=${currency}&to=INR&date=${date}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      if (data?.result && typeof data.result === "number") return data.result;
    }
  } catch { /* ignore */ }

  return null;
}

async function getStoredRate(currency: string, date: string): Promise<DailyRate | null> {
  if (!isKVAvailable()) return null;
  try {
    return await kv.get<DailyRate>(`${RATE_PREFIX}${currency}:${date}`);
  } catch {
    return null;
  }
}

async function storeRate(rate: DailyRate): Promise<void> {
  if (!isKVAvailable()) return;
  try {
    await kv.set(`${RATE_PREFIX}${rate.currency}:${rate.date}`, rate, { ex: CACHE_TTL });
  } catch { /* ignore */ }
}

async function getDailyRate(currency: string, date: string): Promise<number> {
  if (currency.toUpperCase() === "INR") return 1;

  // Check KV cache first
  const stored = await getStoredRate(currency.toUpperCase(), date);
  if (stored) return stored.rateToInr;

  // Fetch from API
  const rate = await fetchRateFromAPI(currency.toUpperCase(), date);
  if (rate) {
    await storeRate({
      currency: currency.toUpperCase(),
      date,
      rateToInr: rate,
      source: "fawazahmed0/currency-api",
      lastUpdatedAt: new Date().toISOString(),
    });
    return rate;
  }

  // If no rate found, try to find nearest previous date
  const dateObj = new Date(date);
  for (let i = 1; i <= 7; i++) {
    const prevDate = new Date(dateObj);
    prevDate.setDate(prevDate.getDate() - i);
    const prevDateStr = prevDate.toISOString().split("T")[0];
    const prevStored = await getStoredRate(currency.toUpperCase(), prevDateStr);
    if (prevStored) {
      console.log(`[ExchangeRate] Using nearest rate from ${prevDateStr} for ${currency}:${date}`);
      return prevStored.rateToInr;
    }
  }

  // Absolute fallback — fetch latest rate
  const latestRate = await fetchRateFromAPI(currency.toUpperCase(), new Date().toISOString().split("T")[0]);
  if (latestRate) return latestRate;

  // If nothing works, use reasonable defaults
  const defaults: Record<string, number> = { USD: 84.5, GBP: 107, EUR: 92, CAD: 62, AUD: 55 };
  return defaults[currency.toUpperCase()] || 84.5;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (action === "getRate") {
    const currency = url.searchParams.get("currency") || "USD";
    const date = url.searchParams.get("date") || new Date().toISOString().split("T")[0];
    const rate = await getDailyRate(currency, date);
    return Response.json({ data: { currency, date, rateToInr: rate } });
  }

  if (action === "getTodayRate") {
    const currencies = (url.searchParams.get("currencies") || "USD").split(",");
    const today = new Date().toISOString().split("T")[0];
    const rates: Record<string, number> = {};
    for (const curr of currencies) {
      rates[curr.trim().toUpperCase()] = await getDailyRate(curr.trim(), today);
    }
    return Response.json({ data: { date: today, rates } });
  }

  if (action === "convertRevenue") {
    const amount = Number(url.searchParams.get("amount") || 0);
    const currency = url.searchParams.get("currency") || "USD";
    const date = url.searchParams.get("date") || new Date().toISOString().split("T")[0];

    if (currency.toUpperCase() === "INR") {
      return Response.json({ data: { original: amount, currency, inr: amount, rate: 1, date } });
    }

    const rate = await getDailyRate(currency, date);
    return Response.json({
      data: {
        original: amount,
        currency,
        inr: Math.round(amount * rate * 100) / 100,
        rate,
        date,
      },
    });
  }

  return Response.json({ error: "Invalid action. Use getRate, getTodayRate, or convertRevenue" }, { status: 400 });
}
