import { kv } from "@/lib/redis";

export interface AuditLogEntry {
  id: string;
  action: string;
  performedBy: string;
  performedByRole: "admin" | "company" | "client";
  targetUser?: string;
  targetEmail?: string;
  details: string;
  timestamp: string;
}

const AUDIT_LOG_KEY = "bainsla_audit_log";
const MAX_LOG_ENTRIES = 500;

export async function addAuditLog(entry: Omit<AuditLogEntry, "id" | "timestamp">): Promise<void> {
  try {
    const logs = (await kv.get<AuditLogEntry[]>(AUDIT_LOG_KEY)) || [];
    const newEntry: AuditLogEntry = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    };
    logs.unshift(newEntry);
    if (logs.length > MAX_LOG_ENTRIES) logs.length = MAX_LOG_ENTRIES;
    await kv.set(AUDIT_LOG_KEY, logs);
  } catch { /* silent */ }
}

export async function getAuditLogs(limit?: number): Promise<AuditLogEntry[]> {
  try {
    const logs = (await kv.get<AuditLogEntry[]>(AUDIT_LOG_KEY)) || [];
    return limit ? logs.slice(0, limit) : logs;
  } catch {
    return [];
  }
}
