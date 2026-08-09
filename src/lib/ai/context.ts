import "server-only";

import { kv } from "@/lib/redis";
import {
  getAllCachedClientData,
  type CachedChannelData,
  type CachedClientData,
} from "@/lib/client-data-cache";
import {
  calculateForecast,
  calculateHealthScore,
  calculateRunRateTrend,
} from "@/lib/ai/analytics";

const USERS_KEY = "bainsla_users";
const PAYMENTS_KEY = "bainsla_payments";
const WITHDRAWALS_KEY = "bainsla_withdrawals";
const NETWORKS_KEY = "bainsla_networks";
const MONTHLY_PREFIX = "monthly_channel_analytics:";
const TOKEN_PREFIX = "channel_token:";
const ADMIN_EMAILS = new Set([
  "ajeetgurjarofficial@gmail.com",
  "bainslamusicofficial@gmail.com",
  "shivlalbainslaofficial@gmail.com",
]);

export interface AiScopeUser {
  id: string;
  name: string;
  email: string;
  role: "client" | "company";
  status: "active" | "inactive" | "pending";
  parentId?: string;
  channels?: string[];
  channelNetworks?: Array<{ channelId: string; networkName: string }>;
  joinedDate?: string;
  phone?: string;
  category?: string;
  revenueSharePercent?: number;
}

interface StoredPayment {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  networkName: string;
  revenueSharePercent: number;
  month: string;
  fromDate: string;
  toDate: string;
  totalAmount: number;
  tdsPercent: number;
  tdsAmount: number;
  networkRevenue: number;
  netTotal: number;
  paidAmount: number;
  status: "pending" | "paid" | "partial";
  createdDate: string;
  paidDate: string;
  notes: string;
}

interface StoredWithdrawal {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  status: string;
  requestDate: string;
  processedDate: string;
  adminNote: string;
}

interface StoredNetwork {
  id: string;
  name: string;
  revenueSharePercent: number;
}

interface MonthlyChannelData {
  channel_id: string;
  channel_name: string;
  revenue_usd: number;
  views: number;
  synced_through: string;
  updated_at: string;
}

interface MonthlyChannelCache {
  month: string;
  channels: MonthlyChannelData[];
  last_attempt_at: string;
}

export interface AiScopeOption {
  id: string;
  label: string;
  type: "personal" | "company";
}

export interface AiAlert {
  id: string;
  severity: "critical" | "warning" | "positive" | "info";
  title: string;
  message: string;
  channelId?: string;
}

export interface AiChannelInsight {
  channelId: string;
  channelTitle: string;
  ownerName: string;
  revenue: number;
  currentMonthRevenue: number;
  views: number;
  subscribers: number;
  healthScore: number;
  healthStatus: "healthy" | "attention" | "critical";
  tokenConnected: boolean;
  revenueUpdatedAt?: string;
  statsUpdatedAt?: string;
  trendPercent: number | null;
}

export interface AiDashboardInsights {
  scopeId: string;
  scopeLabel: string;
  generatedAt: string;
  cacheLastUpdated: string | null;
  currentMonth: string;
  currentMonthSyncedThrough: string | null;
  channelCount: number;
  clientCount: number;
  connectedChannelCount: number;
  cachedRevenue: number;
  currentMonthRevenue: number;
  previousMonthRevenue: number;
  forecastRevenue: number;
  forecastConfidence: "low" | "medium" | "high";
  revenueTrendPercent: number | null;
  healthScore: number;
  summary: string;
  alerts: AiAlert[];
  channels: AiChannelInsight[];
}

export interface AiScopeAccess {
  isAdmin: boolean;
  vendorOwnerUserId: string | null;
  selectedUsers: AiScopeUser[];
}

export interface AiDashboardContext {
  insights: AiDashboardInsights;
  scopeOptions: AiScopeOption[];
  promptContext: string;
  access: AiScopeAccess;
}

interface BuildAiContextInput {
  email: string;
  role?: "admin" | "company" | "client";
  requestedScopeId?: string;
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function previousMonthKey(date: Date): string {
  return monthKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1)));
}

function daysInMonth(key: string): number {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function latestDate(values: Array<string | undefined>): string | null {
  let latest = 0;
  for (const value of values) {
    if (!value) continue;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed) && parsed > latest) latest = parsed;
  }
  return latest > 0 ? new Date(latest).toISOString() : null;
}

function daysOld(value?: string): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - parsed) / 86400000);
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

function findCacheForUser(
  caches: CachedClientData[],
  user: AiScopeUser
): CachedClientData | undefined {
  const email = user.email.toLowerCase();
  return caches.find(
    (cache) => cache.userId === user.id || cache.email?.toLowerCase() === email
  );
}

function resolveScope(
  users: AiScopeUser[],
  email: string,
  role: BuildAiContextInput["role"],
  requestedScopeId?: string
): {
  scopeId: string;
  scopeLabel: string;
  selectedUsers: AiScopeUser[];
  scopeOptions: AiScopeOption[];
  isAdmin: boolean;
  vendorOwnerUserId: string | null;
} {
  const normalizedEmail = email.toLowerCase();
  const isAdmin = role === "admin" || ADMIN_EMAILS.has(normalizedEmail);
  const companies = users.filter(
    (user) => user.role === "company" && user.status === "active"
  );
  const scopeOptions: AiScopeOption[] = isAdmin
    ? [
        { id: "admin-personal", label: "Admin Personal", type: "personal" },
        ...companies.map((company) => ({
          id: company.id,
          label: company.name,
          type: "company" as const,
        })),
      ]
    : [];

  if (isAdmin) {
    const company = companies.find((candidate) => candidate.id === requestedScopeId);
    if (company) {
      return {
        scopeId: company.id,
        scopeLabel: company.name,
        selectedUsers: [
          company,
          ...users.filter(
            (user) => user.parentId === company.id && user.status === "active"
          ),
        ],
        scopeOptions,
        isAdmin: true,
        vendorOwnerUserId: company.id,
      };
    }
    return {
      scopeId: "admin-personal",
      scopeLabel: "Admin Personal",
      selectedUsers: users.filter(
        (user) =>
          user.role === "client" &&
          !user.parentId &&
          user.status === "active"
      ),
      scopeOptions,
      isAdmin: true,
      vendorOwnerUserId: null,
    };
  }

  const currentUser = users.find(
    (user) => user.email.toLowerCase() === normalizedEmail
  );
  if (!currentUser) {
    return {
      scopeId: normalizedEmail,
      scopeLabel: email,
      selectedUsers: [],
      scopeOptions,
      isAdmin: false,
      vendorOwnerUserId: null,
    };
  }

  if (currentUser.role === "company") {
    return {
      scopeId: currentUser.id,
      scopeLabel: currentUser.name,
      selectedUsers: [
        currentUser,
        ...users.filter(
          (user) => user.parentId === currentUser.id && user.status === "active"
        ),
      ],
      scopeOptions,
      isAdmin: false,
      vendorOwnerUserId: currentUser.id,
    };
  }

  return {
    scopeId: currentUser.id,
    scopeLabel: currentUser.name,
    selectedUsers: [currentUser],
    scopeOptions,
    isAdmin: false,
    vendorOwnerUserId: currentUser.parentId || null,
  };
}

function buildChannelMap(
  selectedUsers: AiScopeUser[],
  caches: CachedClientData[]
): Map<string, { channel: CachedChannelData; ownerName: string }> {
  const channels = new Map<
    string,
    { channel: CachedChannelData; ownerName: string }
  >();
  for (const user of selectedUsers) {
    const allowed = new Set(user.channels || []);
    const cache = findCacheForUser(caches, user);
    for (const channel of cache?.channels || []) {
      if (!allowed.has(channel.channelId)) continue;
      const current = channels.get(channel.channelId);
      if (!current || Date.parse(channel.lastUpdated) > Date.parse(current.channel.lastUpdated)) {
        channels.set(channel.channelId, { channel, ownerName: user.name });
      }
    }
  }
  return channels;
}

function sumMonthlyRows(rows: MonthlyChannelData[]): {
  revenue: number;
  syncedThrough: string | null;
} {
  return {
    revenue: rounded(rows.reduce((total, row) => total + (row.revenue_usd || 0), 0)),
    syncedThrough: latestDate(rows.map((row) => row.synced_through)),
  };
}

export async function buildAiDashboardContext({
  email,
  role,
  requestedScopeId,
}: BuildAiContextInput): Promise<AiDashboardContext> {
  const now = new Date();
  const currentMonth = monthKey(now);
  const previousMonth = previousMonthKey(now);
  const [users, caches, currentMonthly, previousMonthly, payments, withdrawals, networks] =
    await Promise.all([
      kv.get<AiScopeUser[]>(USERS_KEY).then((value) => value || []),
      getAllCachedClientData(),
      kv.get<MonthlyChannelCache>(`${MONTHLY_PREFIX}${currentMonth}`),
      kv.get<MonthlyChannelCache>(`${MONTHLY_PREFIX}${previousMonth}`),
      kv.get<StoredPayment[]>(PAYMENTS_KEY).then((value) => value || []),
      kv.get<StoredWithdrawal[]>(WITHDRAWALS_KEY).then((value) => value || []),
      kv.get<StoredNetwork[]>(NETWORKS_KEY).then((value) => value || []),
    ]);

  const scope = resolveScope(users, email, role, requestedScopeId);
  const allowedChannelIds = new Set(
    scope.selectedUsers.flatMap((user) => user.channels || [])
  );
  const channelMap = buildChannelMap(scope.selectedUsers, caches);
  const currentRows = (currentMonthly?.channels || []).filter((row) =>
    allowedChannelIds.has(row.channel_id)
  );
  const previousRows = (previousMonthly?.channels || []).filter((row) =>
    allowedChannelIds.has(row.channel_id)
  );
  const currentByChannel = new Map(currentRows.map((row) => [row.channel_id, row]));
  const previousByChannel = new Map(previousRows.map((row) => [row.channel_id, row]));
  const tokenEntries = await Promise.all(
    Array.from(channelMap.keys()).map(async (channelId) => [
      channelId,
      Boolean(await kv.get<unknown>(`${TOKEN_PREFIX}${channelId}`)),
    ] as const)
  );
  const tokenStatus = new Map(tokenEntries);
  const alerts: AiAlert[] = [];
  const channels: AiChannelInsight[] = [];

  for (const [channelId, entry] of channelMap) {
    const { channel, ownerName } = entry;
    const currentRow = currentByChannel.get(channelId);
    const previousRow = previousByChannel.get(channelId);
    const connected = tokenStatus.get(channelId) || false;
    const revenueAge = daysOld(channel.revenueUpdatedAt || channel.lastUpdated);
    const statsAge = daysOld(channel.statsUpdatedAt || channel.lastUpdated);
    const score = calculateHealthScore({
      tokenConnected: connected,
      revenueAgeDays: revenueAge,
      statsAgeDays: statsAge,
      hasCurrentMonthRow: Boolean(currentRow),
    });
    const currentDays = currentRow?.synced_through
      ? Math.max(1, new Date(currentRow.synced_through).getUTCDate())
      : 0;
    const trend = calculateRunRateTrend({
      currentRevenue: currentRow?.revenue_usd || 0,
      currentDays,
      previousRevenue: previousRow?.revenue_usd || 0,
      previousDays: daysInMonth(previousMonth),
    });
    const healthStatus = score >= 80 ? "healthy" : score >= 55 ? "attention" : "critical";

    channels.push({
      channelId,
      channelTitle: channel.channelTitle || currentRow?.channel_name || channelId,
      ownerName,
      revenue: rounded(channel.estimatedRevenue || 0),
      currentMonthRevenue: rounded(currentRow?.revenue_usd || 0),
      views: channel.views || 0,
      subscribers: channel.subscribers || 0,
      healthScore: score,
      healthStatus,
      tokenConnected: connected,
      revenueUpdatedAt: channel.revenueUpdatedAt,
      statsUpdatedAt: channel.statsUpdatedAt,
      trendPercent: trend,
    });

    if (!connected) {
      alerts.push({
        id: `token-${channelId}`,
        severity: "critical",
        title: "Channel authorization required",
        message: `${channel.channelTitle || channelId} has no active YouTube token. Cached history remains safe.`,
        channelId,
      });
    } else if (revenueAge > 4) {
      alerts.push({
        id: `revenue-stale-${channelId}`,
        severity: "warning",
        title: "Revenue data is delayed",
        message: `${channel.channelTitle || channelId} revenue has not refreshed for ${Math.floor(revenueAge)} days.`,
        channelId,
      });
    }

    if (trend !== null && trend <= -30 && (previousRow?.revenue_usd || 0) >= 5) {
      alerts.push({
        id: `trend-down-${channelId}`,
        severity: "warning",
        title: "Revenue run rate dropped",
        message: `${channel.channelTitle || channelId} is ${Math.abs(trend).toFixed(0)}% below last month’s daily run rate.`,
        channelId,
      });
    } else if (trend !== null && trend >= 50 && (currentRow?.revenue_usd || 0) >= 5) {
      alerts.push({
        id: `trend-up-${channelId}`,
        severity: "positive",
        title: "Revenue momentum increased",
        message: `${channel.channelTitle || channelId} is ${trend.toFixed(0)}% above last month’s daily run rate.`,
        channelId,
      });
    }
  }

  channels.sort((a, b) => a.healthScore - b.healthScore || b.revenue - a.revenue);
  const currentTotals = sumMonthlyRows(currentRows);
  const previousTotals = sumMonthlyRows(previousRows);
  const syncedDay = currentTotals.syncedThrough
    ? new Date(currentTotals.syncedThrough).getUTCDate()
    : 0;
  const coverage = allowedChannelIds.size
    ? currentRows.length / allowedChannelIds.size
    : 0;
  const forecast = calculateForecast({
    revenue: currentTotals.revenue,
    syncedDay,
    daysInMonth: daysInMonth(currentMonth),
    coverage,
  });
  const forecastRevenue = forecast.revenue;
  const cachedRevenue = rounded(
    channels.reduce((total, channel) => total + channel.revenue, 0)
  );
  const healthScore = channels.length
    ? Math.round(
        channels.reduce((total, channel) => total + channel.healthScore, 0) /
          channels.length
      )
    : 0;
  const revenueTrendPercent = calculateRunRateTrend({
    currentRevenue: currentTotals.revenue,
    currentDays: syncedDay,
    previousRevenue: previousTotals.revenue,
    previousDays: daysInMonth(previousMonth),
  });
  const forecastConfidence = forecast.confidence;
  const connectedChannelCount = channels.filter((channel) => channel.tokenConnected).length;
  const cacheLastUpdated = latestDate(
    scope.selectedUsers.flatMap((user) => {
      const cache = findCacheForUser(caches, user);
      return [cache?.lastUpdated, cache?.lastRevenueSync, cache?.lastStatsSync];
    })
  );
  const summary = `${scope.scopeLabel} has ${channels.length} active cached channels, ${connectedChannelCount} connected tokens, a health score of ${healthScore}/100, and $${cachedRevenue.toFixed(2)} in the current dashboard revenue cache. ${currentMonth} revenue is $${currentTotals.revenue.toFixed(2)} through ${currentTotals.syncedThrough || "the latest available date"}, with a $${forecastRevenue.toFixed(2)} month-end forecast.`;
  const insights: AiDashboardInsights = {
    scopeId: scope.scopeId,
    scopeLabel: scope.scopeLabel,
    generatedAt: now.toISOString(),
    cacheLastUpdated,
    currentMonth,
    currentMonthSyncedThrough: currentTotals.syncedThrough,
    channelCount: channels.length,
    clientCount: scope.selectedUsers.length,
    connectedChannelCount,
    cachedRevenue,
    currentMonthRevenue: currentTotals.revenue,
    previousMonthRevenue: previousTotals.revenue,
    forecastRevenue,
    forecastConfidence,
    revenueTrendPercent,
    healthScore,
    summary,
    alerts: alerts
      .sort((a, b) => {
        const priority = { critical: 0, warning: 1, positive: 2, info: 3 };
        return priority[a.severity] - priority[b.severity];
      })
      .slice(0, 30),
    channels,
  };
  // Payment/withdraw ledgers are the only record of what a person was actually
  // paid, so the assistant must read them instead of inferring an amount.
  // An Admin already sees every row in the dashboard; a company or client is
  // limited to their own scope.
  const scopeUserIds = new Set(scope.selectedUsers.map((user) => user.id));
  const scopeEmails = new Set(
    scope.selectedUsers.map((user) => user.email.toLowerCase())
  );
  const inScope = (row: { userId?: string; userEmail?: string }): boolean =>
    scope.isAdmin ||
    scopeUserIds.has(row.userId || "") ||
    scopeEmails.has((row.userEmail || "").toLowerCase());

  const scopedPayments = payments
    .filter(inScope)
    .sort((a, b) => (b.month || "").localeCompare(a.month || ""))
    .slice(0, 300)
    .map((payment) => ({
      person: payment.userName,
      email: payment.userEmail,
      month: payment.month,
      period: payment.fromDate && payment.toDate ? `${payment.fromDate} to ${payment.toDate}` : "",
      network: payment.networkName,
      revenueSharePercent: payment.revenueSharePercent,
      grossAmount: payment.totalAmount,
      tdsPercent: payment.tdsPercent,
      tdsAmount: payment.tdsAmount,
      netPayable: payment.netTotal,
      actuallyPaid: payment.paidAmount,
      outstanding: rounded((payment.netTotal || 0) - (payment.paidAmount || 0)),
      status: payment.status,
      paidDate: payment.paidDate,
      notes: payment.notes,
    }));

  const scopedWithdrawals = withdrawals
    .filter(inScope)
    .sort((a, b) => (b.requestDate || "").localeCompare(a.requestDate || ""))
    .slice(0, 100)
    .map((withdrawal) => ({
      person: withdrawal.userName,
      email: withdrawal.userEmail,
      amount: withdrawal.amount,
      status: withdrawal.status,
      requestedOn: withdrawal.requestDate,
      processedOn: withdrawal.processedDate,
      adminNote: withdrawal.adminNote,
    }));

  const people = (scope.isAdmin ? users : scope.selectedUsers).map((user) => ({
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    joinedDate: user.joinedDate,
    channelCount: (user.channels || []).length,
    revenueSharePercent: user.revenueSharePercent,
  }));

  const promptContext = JSON.stringify(
    {
      today: {
        date: now.toISOString().slice(0, 10),
        month: currentMonth,
        monthLabel: now.toLocaleString("en-US", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }),
        previousMonth,
      },
      recordCounts: {
        payments: scopedPayments.length,
        withdrawals: scopedWithdrawals.length,
        people: people.length,
        networks: networks.length,
      },
      payments: scopedPayments,
      withdrawals: scopedWithdrawals,
      people,
      networks: networks.map((network) => ({
        name: network.name,
        revenueSharePercent: network.revenueSharePercent,
      })),
      scope: {
        id: insights.scopeId,
        label: insights.scopeLabel,
        generatedAt: insights.generatedAt,
        cacheLastUpdated: insights.cacheLastUpdated,
      },
      metrics: {
        channelCount: insights.channelCount,
        clientCount: insights.clientCount,
        connectedChannelCount: insights.connectedChannelCount,
        cachedRevenue28DayWindow: insights.cachedRevenue,
        currentMonth: insights.currentMonth,
        currentMonthRevenue: insights.currentMonthRevenue,
        currentMonthSyncedThrough: insights.currentMonthSyncedThrough,
        previousMonthRevenue: insights.previousMonthRevenue,
        forecastRevenue: insights.forecastRevenue,
        forecastConfidence: insights.forecastConfidence,
        revenueTrendPercent: insights.revenueTrendPercent,
        healthScore: insights.healthScore,
      },
      alerts: insights.alerts,
      channels: insights.channels.slice(0, 50),
    },
    null,
    2
  );

  return {
    insights,
    scopeOptions: scope.scopeOptions,
    promptContext,
    access: {
      isAdmin: scope.isAdmin,
      vendorOwnerUserId: scope.vendorOwnerUserId,
      selectedUsers: scope.selectedUsers,
    },
  };
}
