import { kv } from "@/lib/redis";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const USERS_KEY = "bainsla_users";
const OTP_PREFIX = "otp:";

interface StoredUser {
  id: string;
  name: string;
  email: string;
  password: string;
  phone: string;
  channels: string[];
  status: "active" | "inactive" | "pending";
  joinedDate: string;
  category: string;
  role: "client" | "company";
  parentId?: string;
}

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function isKVAvailable(): boolean {
  return true; // Always available — using DigitalOcean Redis
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, otp, newPassword } = body;

    if (!email || !otp || !newPassword) {
      return Response.json({ error: "Email, OTP, and new password are required" }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!isKVAvailable()) {
      return Response.json({ error: "Service not configured" }, { status: 500 });
    }

    // Verify OTP
    const storedOtp = await kv.get<string>(`${OTP_PREFIX}${normalizedEmail}`);
    if (!storedOtp) {
      return Response.json({ error: "OTP expired or not found. Please request a new one." }, { status: 400 });
    }
    if (String(storedOtp) !== otp.trim()) {
      return Response.json({ error: "Invalid OTP. Please try again." }, { status: 400 });
    }

    // OTP valid — delete it
    await kv.del(`${OTP_PREFIX}${normalizedEmail}`).catch(() => {});

    // Find user and update password
    const users = await kv.get<StoredUser[]>(USERS_KEY) || [];
    const userIdx = users.findIndex((u) => u.email.toLowerCase() === normalizedEmail);

    if (userIdx === -1) {
      return Response.json({ error: "No account found with this email" }, { status: 404 });
    }

    users[userIdx].password = hashPassword(newPassword);
    await kv.set(USERS_KEY, users);

    return Response.json({ data: { success: true, message: "Password reset successfully! You can now login." } });
  } catch (error) {
    console.error("[ResetPassword] Error:", error);
    return Response.json({ error: "Failed to reset password. Please try again." }, { status: 500 });
  }
}
