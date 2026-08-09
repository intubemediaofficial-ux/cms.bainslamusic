export type ForecastConfidence = "low" | "medium" | "high";

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateHealthScore(input: {
  tokenConnected: boolean;
  revenueAgeDays: number;
  statsAgeDays: number;
  hasCurrentMonthRow: boolean;
}): number {
  let score = 100;
  if (!input.tokenConnected) score -= 40;
  if (input.revenueAgeDays > 4) score -= 25;
  else if (input.revenueAgeDays > 2) score -= 12;
  if (input.statsAgeDays > 2) score -= 20;
  else if (input.statsAgeDays > 1) score -= 8;
  if (!input.hasCurrentMonthRow) score -= 10;
  return Math.max(0, score);
}

export function calculateForecast(input: {
  revenue: number;
  syncedDay: number;
  daysInMonth: number;
  coverage: number;
}): { revenue: number; confidence: ForecastConfidence } {
  const revenue = input.syncedDay > 0
    ? rounded((input.revenue / input.syncedDay) * input.daysInMonth)
    : 0;
  const confidence =
    input.syncedDay >= 14 && input.coverage >= 0.9
      ? "high"
      : input.syncedDay >= 7 && input.coverage >= 0.7
        ? "medium"
        : "low";
  return { revenue, confidence };
}

export function calculateRunRateTrend(input: {
  currentRevenue: number;
  currentDays: number;
  previousRevenue: number;
  previousDays: number;
}): number | null {
  if (input.currentDays <= 0 || input.previousDays <= 0 || input.previousRevenue <= 0) {
    return null;
  }
  const currentRate = input.currentRevenue / input.currentDays;
  const previousRate = input.previousRevenue / input.previousDays;
  return rounded(((currentRate - previousRate) / previousRate) * 100);
}
