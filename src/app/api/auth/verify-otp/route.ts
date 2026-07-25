import { kv } from "@/lib/redis";

export const dynamic = "force-dynamic";

const OTP_PREFIX = "otp:";

function isKVAvailable(): boolean {
  return true; // Always available — using DigitalOcean Redis
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, otp } = body;

    if (!email || !otp) {
      return Response.json({ error: "Email and OTP are required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!isKVAvailable()) {
      return Response.json({ error: "OTP service not configured" }, { status: 500 });
    }

    // Get stored OTP from KV
    let storedOtp: string | null = null;
    try {
      storedOtp = await kv.get<string>(`${OTP_PREFIX}${normalizedEmail}`);
    } catch (error) {
      console.error("[OTP] Failed to read OTP from KV:", error);
      return Response.json({ error: "Failed to verify OTP. Please try again." }, { status: 500 });
    }

    if (!storedOtp) {
      return Response.json({ error: "OTP expired or not found. Please request a new one." }, { status: 400 });
    }

    if (String(storedOtp) !== otp.trim()) {
      return Response.json({ error: "Invalid OTP. Please try again." }, { status: 400 });
    }

    // OTP matches — delete it (one-time use)
    try {
      await kv.del(`${OTP_PREFIX}${normalizedEmail}`);
    } catch {
      // Non-critical — OTP will expire naturally
    }

    console.log(`[OTP] Verified for ${normalizedEmail}`);

    return Response.json({
      data: { success: true, email: normalizedEmail },
    });
  } catch (error) {
    console.error("[OTP] Verify error:", error);
    return Response.json(
      { error: "Failed to verify OTP. Please try again." },
      { status: 500 }
    );
  }
}
