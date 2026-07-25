import { kv } from "@/lib/redis";
import { Resend } from "resend";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

const OTP_PREFIX = "otp:";
const OTP_EXPIRY_SECONDS = 300; // 5 minutes

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getOtpHtml(otp: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #1a1a1a; margin: 0;">InTubeMedia</h2>
        <p style="color: #666; font-size: 14px;">Password Reset / Login Verification</p>
      </div>
      <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px;">
        <p style="color: #666; font-size: 14px; margin: 0 0 10px;">Your One-Time Password</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a1a; margin: 0;">${otp}</p>
      </div>
      <p style="color: #999; font-size: 12px; text-align: center;">
        This OTP is valid for 5 minutes. Do not share it with anyone.
      </p>
    </div>
  `;
}

async function sendViaResend(to: string, otp: string): Promise<{ success: boolean; error?: string }> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return { success: false, error: "RESEND_API_KEY not configured" };

  const resend = new Resend(resendApiKey);
  const fromEmail = process.env.OTP_FROM_EMAIL || "onboarding@resend.dev";

  const result = await resend.emails.send({
    from: `InTubeMedia <${fromEmail}>`,
    to,
    subject: "Your InTubeMedia OTP",
    html: getOtpHtml(otp),
  });

  if (result.error) {
    const errMsg = result.error.message || "Unknown error";
    if (errMsg.includes("testing emails") || errMsg.includes("verify a domain")) {
      return { success: false, error: "Email service needs domain setup. Please ask admin to verify domain at resend.com/domains." };
    }
    return { success: false, error: `Email send failed: ${errMsg}` };
  }

  return { success: true };
}

async function sendViaSMTP(to: string, otp: string): Promise<{ success: boolean; error?: string }> {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const fromEmail = process.env.OTP_FROM_EMAIL || user;

  if (!host || !user || !pass) {
    return { success: false, error: "SMTP not configured" };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from: `InTubeMedia <${fromEmail}>`,
      to,
      subject: "Your InTubeMedia OTP",
      html: getOtpHtml(otp),
    });
    return { success: true };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "SMTP send failed";
    return { success: false, error: errMsg };
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Generate OTP
    const otp = generateOTP();

    // Store OTP in Redis with expiry
    try {
      await kv.set(`${OTP_PREFIX}${normalizedEmail}`, otp, { ex: OTP_EXPIRY_SECONDS });
    } catch (error) {
      console.error("[OTP] Failed to store OTP in KV:", error);
      return Response.json({ error: "Failed to store OTP. Please try again." }, { status: 500 });
    }

    // Try sending email — prefer SMTP if configured, fallback to Resend
    let sendResult: { success: boolean; error?: string };

    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      sendResult = await sendViaSMTP(normalizedEmail, otp);
    } else if (process.env.RESEND_API_KEY) {
      sendResult = await sendViaResend(normalizedEmail, otp);
    } else {
      console.error("[OTP] No email service configured (need SMTP_* or RESEND_API_KEY)");
      return Response.json({ error: "Email service not configured. Please contact admin." }, { status: 500 });
    }

    if (!sendResult.success) {
      console.error("[OTP] Send failed:", sendResult.error);
      return Response.json({ error: sendResult.error || "Failed to send OTP email" }, { status: 500 });
    }

    console.log(`[OTP] Sent to ${normalizedEmail}`);

    return Response.json({
      data: { success: true, message: "OTP sent successfully" },
    });
  } catch (error) {
    console.error("[OTP] Error sending OTP:", error);
    return Response.json(
      { error: "Failed to send OTP. Please try again." },
      { status: 500 }
    );
  }
}
