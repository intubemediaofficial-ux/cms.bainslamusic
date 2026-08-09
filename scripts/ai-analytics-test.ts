import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  calculateForecast,
  calculateHealthScore,
  calculateRunRateTrend,
} from "../src/lib/ai/analytics";

assert.equal(
  calculateHealthScore({
    tokenConnected: true,
    revenueAgeDays: 0,
    statsAgeDays: 0,
    hasCurrentMonthRow: true,
  }),
  100
);
assert.equal(
  calculateHealthScore({
    tokenConnected: false,
    revenueAgeDays: 5,
    statsAgeDays: 3,
    hasCurrentMonthRow: false,
  }),
  5
);
assert.equal(
  calculateHealthScore({
    tokenConnected: true,
    revenueAgeDays: 3,
    statsAgeDays: 1.5,
    hasCurrentMonthRow: true,
  }),
  80
);

assert.deepEqual(
  calculateForecast({ revenue: 100, syncedDay: 10, daysInMonth: 30, coverage: 0.95 }),
  { revenue: 300, confidence: "medium" }
);
assert.deepEqual(
  calculateForecast({ revenue: 140, syncedDay: 14, daysInMonth: 31, coverage: 0.9 }),
  { revenue: 310, confidence: "high" }
);
assert.deepEqual(
  calculateForecast({ revenue: 0, syncedDay: 0, daysInMonth: 31, coverage: 0 }),
  { revenue: 0, confidence: "low" }
);

assert.equal(
  calculateRunRateTrend({
    currentRevenue: 70,
    currentDays: 7,
    previousRevenue: 300,
    previousDays: 30,
  }),
  0
);
assert.equal(
  calculateRunRateTrend({
    currentRevenue: 35,
    currentDays: 7,
    previousRevenue: 300,
    previousDays: 30,
  }),
  -50
);
assert.equal(
  calculateRunRateTrend({
    currentRevenue: 105,
    currentDays: 7,
    previousRevenue: 300,
    previousDays: 30,
  }),
  50
);
assert.equal(
  calculateRunRateTrend({
    currentRevenue: 10,
    currentDays: 1,
    previousRevenue: 0,
    previousDays: 30,
  }),
  null
);

const aiRoute = readFileSync("src/app/api/ai/route.ts", "utf8");
const gemini = readFileSync("src/lib/ai/gemini.ts", "utf8");
const context = readFileSync("src/lib/ai/context.ts", "utf8");
const reportRoute = readFileSync("src/app/api/ai/reports/route.ts", "utf8");

assert.doesNotMatch(aiRoute, /export async function (PUT|PATCH|DELETE)/);
assert.match(aiRoute, /if \(!context\.access\.isAdmin\)/);
assert.match(gemini, /"x-goog-api-key": apiKey/);
assert.doesNotMatch(gemini, /[?&]key=/);
assert.doesNotMatch(context, /from\s+["'][^"']*(youtube|googleapis|backend-api)/i);
assert.match(reportRoute, /ai_report_delivery:/);
assert.match(reportRoute, /setIfNotExists/);

console.log("AI deterministic and security tests passed");
