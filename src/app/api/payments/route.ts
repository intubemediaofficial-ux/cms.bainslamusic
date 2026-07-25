import { kv } from "@/lib/redis";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import crypto from "crypto";

const USERS_KEY = "bainsla_users";

interface StoredUser {
  id: string;
  email: string;
  role: "client" | "company";
  parentId?: string;
}

export const dynamic = "force-dynamic";

const PAYMENTS_KEY = "bainsla_payments";
const WITHDRAW_KEY = "bainsla_withdrawals";
const TDS_KEY = "bainsla_tds_settings";
const NOTIFICATIONS_KEY = "bainsla_notifications";

interface Notification {
  id: string;
  userId: string;
  userEmail: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdDate: string;
}

async function createNotification(userId: string, userEmail: string, type: string, title: string, message: string) {
  try {
    const all: Notification[] = (await kv.get<Notification[]>(NOTIFICATIONS_KEY)) || [];
    all.unshift({
      id: crypto.randomUUID(),
      userId, userEmail, type, title, message,
      read: false,
      createdDate: new Date().toISOString(),
    });
    await kv.set(NOTIFICATIONS_KEY, all.slice(0, 500));
  } catch { /* silent */ }
}

export interface Payment {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  networkId: string;
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

export interface WithdrawRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  status: "pending" | "approved" | "rejected" | "paid";
  requestDate: string;
  processedDate: string;
  adminNote: string;
}

export interface TdsSetting {
  userId: string;
  tdsPercent: number;
}

const ADMIN_EMAILS = [
  "ajeetgurjarofficial@gmail.com",
  "bainslamusicofficial@gmail.com",
  "shivlalbainslaofficial@gmail.com",
];

async function getSession() {
  return await getServerSession(authOptions);
}

async function checkAdmin(): Promise<boolean> {
  const session = await getSession();
  if (!session?.user?.email) return false;
  return ADMIN_EMAILS.includes(session.user.email.toLowerCase());
}

async function getCompanyClientIds(companyEmail: string): Promise<string[]> {
  try {
    const users = (await kv.get<StoredUser[]>(USERS_KEY)) || [];
    const company = users.find((u) => u.email.toLowerCase() === companyEmail.toLowerCase() && u.role === "company");
    if (!company) return [];
    return users.filter((u) => u.parentId === company.id).map((u) => u.id);
  } catch {
    return [];
  }
}

async function getPayments(): Promise<Payment[]> {
  try {
    return (await kv.get<Payment[]>(PAYMENTS_KEY)) || [];
  } catch { return []; }
}

async function savePayments(payments: Payment[]): Promise<boolean> {
  try { await kv.set(PAYMENTS_KEY, payments); return true; }
  catch { return false; }
}

async function getWithdrawals(): Promise<WithdrawRequest[]> {
  try {
    return (await kv.get<WithdrawRequest[]>(WITHDRAW_KEY)) || [];
  } catch { return []; }
}

async function saveWithdrawals(items: WithdrawRequest[]): Promise<boolean> {
  try { await kv.set(WITHDRAW_KEY, items); return true; }
  catch { return false; }
}

async function getTdsSettings(): Promise<TdsSetting[]> {
  try {
    return (await kv.get<TdsSetting[]>(TDS_KEY)) || [];
  } catch { return []; }
}

async function saveTdsSettings(items: TdsSetting[]): Promise<boolean> {
  try { await kv.set(TDS_KEY, items); return true; }
  catch { return false; }
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = ADMIN_EMAILS.includes(session.user.email.toLowerCase());
  const isCompanyRole = session.user?.role === "company";
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const userId = url.searchParams.get("userId");

  // Company: get client IDs for filtering
  let companyClientIds: string[] = [];
  if (isCompanyRole && !admin) {
    companyClientIds = await getCompanyClientIds(session.user.email);
  }

  // Get TDS settings
  if (type === "tds") {
    const tdsSettings = await getTdsSettings();
    if (admin) {
      return Response.json({ data: tdsSettings });
    }
    if (isCompanyRole) {
      return Response.json({ data: tdsSettings.filter((t) => companyClientIds.includes(t.userId)) });
    }
    const myTds = tdsSettings.find((t) => t.userId === userId);
    return Response.json({ data: myTds || { tdsPercent: 0 } });
  }

  // Get withdrawals
  if (type === "withdrawals") {
    const withdrawals = await getWithdrawals();
    if (admin) {
      if (userId) {
        return Response.json({ data: withdrawals.filter((w) => w.userId === userId) });
      }
      return Response.json({ data: withdrawals });
    }
    if (isCompanyRole) {
      return Response.json({
        data: withdrawals.filter((w) => companyClientIds.includes(w.userId)),
      });
    }
    return Response.json({
      data: withdrawals.filter((w) => w.userEmail.toLowerCase() === session.user!.email!.toLowerCase()),
    });
  }

  // Get payments
  const payments = await getPayments();
  if (admin) {
    if (userId) {
      return Response.json({ data: payments.filter((p) => p.userId === userId) });
    }
    return Response.json({ data: payments });
  }
  if (isCompanyRole) {
    return Response.json({
      data: payments.filter((p) => companyClientIds.includes(p.userId)),
    });
  }

  return Response.json({
    data: payments.filter((p) => p.userEmail.toLowerCase() === session.user!.email!.toLowerCase()),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = ADMIN_EMAILS.includes(session.user.email.toLowerCase());

  try {
    const body = await request.json();
    const { type } = body;

    // Client withdraw request
    if (type === "withdraw") {
      const { userId, userName, userEmail, amount } = body;
      if (!amount || amount <= 0) {
        return Response.json({ error: "Valid amount required" }, { status: 400 });
      }

      const withdrawal: WithdrawRequest = {
        id: crypto.randomUUID(),
        userId: userId || "",
        userName: userName || session.user.name || "",
        userEmail: userEmail || session.user.email,
        amount: Number(amount),
        status: "pending",
        requestDate: new Date().toISOString(),
        processedDate: "",
        adminNote: "",
      };

      const withdrawals = await getWithdrawals();
      withdrawals.push(withdrawal);
      await saveWithdrawals(withdrawals);
      return Response.json({ data: withdrawal }, { status: 201 });
    }

    // Admin: set TDS
    if (type === "tds" && admin) {
      const { userId, tdsPercent } = body;
      if (!userId) {
        return Response.json({ error: "userId required" }, { status: 400 });
      }
      const settings = await getTdsSettings();
      const idx = settings.findIndex((s) => s.userId === userId);
      if (idx >= 0) {
        settings[idx].tdsPercent = Number(tdsPercent) || 0;
      } else {
        settings.push({ userId, tdsPercent: Number(tdsPercent) || 0 });
      }
      await saveTdsSettings(settings);
      return Response.json({ data: { userId, tdsPercent: Number(tdsPercent) || 0 } });
    }

    // Admin: bulk create payments
    if (type === "bulk" && admin) {
      const { items } = body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        return Response.json({ error: "Items array required" }, { status: 400 });
      }
      const payments = await getPayments();
      const created: Payment[] = [];
      for (const item of items) {
        const tds = Number(item.tdsPercent) || 0;
        const total = Number(item.totalAmount) || 0;
        const revShare = Number(item.revenueSharePercent) || 0;
        const networkRev = total * (revShare / 100);
        const tdsAmt = (total - networkRev) * (tds / 100);
        const netTotal = total - networkRev - tdsAmt;
        const p: Payment = {
          id: crypto.randomUUID(),
          userId: item.userId || "",
          userName: item.userName || "",
          userEmail: item.userEmail || "",
          networkId: item.networkId || "",
          networkName: item.networkName || "",
          revenueSharePercent: revShare,
          month: item.month || "",
          fromDate: item.fromDate || "",
          toDate: item.toDate || "",
          totalAmount: total,
          tdsPercent: tds,
          tdsAmount: Math.round(tdsAmt * 100) / 100,
          networkRevenue: Math.round(networkRev * 100) / 100,
          netTotal: Math.round(netTotal * 100) / 100,
          paidAmount: 0,
          status: "pending",
          createdDate: new Date().toISOString(),
          paidDate: "",
          notes: item.notes || "",
        };
        payments.push(p);
        created.push(p);
        await createNotification(p.userId, p.userEmail, "payment_created", "New Payment", `A payment of $${p.netTotal.toFixed(2)} for ${p.month || p.fromDate + " - " + p.toDate} has been created.`);
      }
      await savePayments(payments);
      return Response.json({ data: created }, { status: 201 });
    }

    // Admin: create payment record
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      userId, userName, userEmail,
      networkId, networkName, revenueSharePercent,
      month, fromDate, toDate, totalAmount,
      tdsPercent, notes,
    } = body;

    if (!userId || !fromDate || !toDate || totalAmount === undefined) {
      return Response.json({ error: "Required fields missing" }, { status: 400 });
    }

    const tds = Number(tdsPercent) || 0;
    const total = Number(totalAmount) || 0;
    const revShare = Number(revenueSharePercent) || 0;
    const networkRev = total * (revShare / 100);
    const tdsAmount = (total - networkRev) * (tds / 100);
    const netTotal = total - networkRev - tdsAmount;

    const payment: Payment = {
      id: crypto.randomUUID(),
      userId,
      userName: userName || "",
      userEmail: userEmail || "",
      networkId: networkId || "",
      networkName: networkName || "",
      revenueSharePercent: revShare,
      month: month || "",
      fromDate,
      toDate,
      totalAmount: total,
      tdsPercent: tds,
      tdsAmount: Math.round(tdsAmount * 100) / 100,
      networkRevenue: Math.round(networkRev * 100) / 100,
      netTotal: Math.round(netTotal * 100) / 100,
      paidAmount: 0,
      status: "pending",
      createdDate: new Date().toISOString(),
      paidDate: "",
      notes: notes || "",
    };

    const payments = await getPayments();
    payments.push(payment);
    await savePayments(payments);
    await createNotification(payment.userId, payment.userEmail, "payment_created", "New Payment", `A payment of $${payment.netTotal.toFixed(2)} for ${payment.month || payment.fromDate + " - " + payment.toDate} has been created.`);
    return Response.json({ data: payment }, { status: 201 });
  } catch (error) {
    console.error("[Payments] Error:", error);
    return Response.json({ error: "Failed to process request" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = ADMIN_EMAILS.includes(session.user.email.toLowerCase());

  try {
    const body = await request.json();
    const { type } = body;

    // Admin: update withdraw request
    if (type === "withdrawal" && admin) {
      const { id, status: newStatus, adminNote } = body;
      const withdrawals = await getWithdrawals();
      const idx = withdrawals.findIndex((w) => w.id === id);
      if (idx === -1) return Response.json({ error: "Not found" }, { status: 404 });

      if (newStatus) withdrawals[idx].status = newStatus;
      if (adminNote !== undefined) withdrawals[idx].adminNote = adminNote;
      if (newStatus === "paid" || newStatus === "approved" || newStatus === "rejected") {
        withdrawals[idx].processedDate = new Date().toISOString();
      }
      await saveWithdrawals(withdrawals);

      // Send notification to client
      const w = withdrawals[idx];
      if (newStatus === "paid") {
        await createNotification(w.userId, w.userEmail, "withdraw_approved", "Withdrawal Paid", `Your withdrawal request of $${w.amount.toFixed(2)} has been paid.`);
      } else if (newStatus === "rejected") {
        await createNotification(w.userId, w.userEmail, "withdraw_rejected", "Withdrawal Rejected", `Your withdrawal request of $${w.amount.toFixed(2)} was rejected.${adminNote ? " Reason: " + adminNote : ""}`);
      }

      return Response.json({ data: withdrawals[idx] });
    }

    // Admin: update payment (mark paid, update amount, etc.)
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, status, paidAmount, notes, tdsPercent } = body;
    if (!id) return Response.json({ error: "Payment ID required" }, { status: 400 });

    const payments = await getPayments();
    const idx = payments.findIndex((p) => p.id === id);
    if (idx === -1) return Response.json({ error: "Not found" }, { status: 404 });

    if (status) payments[idx].status = status;
    if (paidAmount !== undefined) payments[idx].paidAmount = Number(paidAmount);
    if (notes !== undefined) payments[idx].notes = notes;
    if (tdsPercent !== undefined) {
      payments[idx].tdsPercent = Number(tdsPercent);
      const total = payments[idx].totalAmount;
      const networkRev = payments[idx].networkRevenue;
      const newTdsAmount = (total - networkRev) * (Number(tdsPercent) / 100);
      payments[idx].tdsAmount = Math.round(newTdsAmount * 100) / 100;
      payments[idx].netTotal = Math.round((total - networkRev - newTdsAmount) * 100) / 100;
    }
    if (status === "paid") {
      payments[idx].paidDate = new Date().toISOString();
      payments[idx].paidAmount = payments[idx].netTotal;
      // Notify client
      await createNotification(
        payments[idx].userId, payments[idx].userEmail,
        "payment_paid", "Payment Received",
        `Your payment of $${payments[idx].netTotal.toFixed(2)} for ${payments[idx].month || payments[idx].fromDate + " - " + payments[idx].toDate} has been paid.`
      );
    }

    await savePayments(payments);
    return Response.json({ data: payments[idx] });
  } catch (error) {
    console.error("[Payments] Error:", error);
    return Response.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await checkAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const type = searchParams.get("type");

    if (!id) return Response.json({ error: "ID required" }, { status: 400 });

    if (type === "withdrawal") {
      const items = await getWithdrawals();
      const filtered = items.filter((w) => w.id !== id);
      await saveWithdrawals(filtered);
      return Response.json({ data: { success: true } });
    }

    const payments = await getPayments();
    const filtered = payments.filter((p) => p.id !== id);
    await savePayments(filtered);
    return Response.json({ data: { success: true } });
  } catch (error) {
    console.error("[Payments] Error:", error);
    return Response.json({ error: "Failed to delete" }, { status: 500 });
  }
}
