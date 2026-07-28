import { Resend } from "resend";
import nodemailer from "nodemailer";
import { getLoginUrl } from "@/lib/app-url";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

async function sendViaResend(params: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return { success: false, error: "RESEND_API_KEY not configured" };

  const resend = new Resend(resendApiKey);
  const fromEmail = process.env.OTP_FROM_EMAIL || "onboarding@resend.dev";

  const result = await resend.emails.send({
    from: `Bainsla Music <${fromEmail}>`,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  if (result.error) {
    return { success: false, error: result.error.message || "Unknown error" };
  }
  return { success: true };
}

async function sendViaSMTP(params: SendEmailParams): Promise<{ success: boolean; error?: string }> {
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
      from: `Bainsla Music <${fromEmail}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    return { success: true };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "SMTP send failed";
    return { success: false, error: errMsg };
  }
}

export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return sendViaSMTP(params);
  } else if (process.env.RESEND_API_KEY) {
    return sendViaResend(params);
  }
  return { success: false, error: "No email service configured" };
}

export function getWelcomeEmailHtml(params: {
  name: string;
  email: string;
  password: string;
  role: "client" | "company";
  createdBy?: string;
}): string {
  const loginUrl = getLoginUrl();
  const roleLabel = params.role === "company" ? "Company" : "Client";
  const createdByLine = params.createdBy
    ? `<p style="color: #666; font-size: 14px;">You have been added by <strong>${params.createdBy}</strong>.</p>`
    : "";

  return `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; background: #dc2626; border-radius: 12px; padding: 10px 14px; margin-bottom: 8px;">
          <span style="color: #fff; font-size: 18px; font-weight: bold;">Bainsla Music</span>
        </div>
        <p style="color: #666; font-size: 14px; margin: 4px 0 0;">Channel Management System</p>
      </div>

      <div style="background: #f8f9fa; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
        <h2 style="color: #1a1a1a; margin: 0 0 8px; font-size: 20px;">Welcome, ${params.name}!</h2>
        <p style="color: #666; font-size: 14px; margin: 0 0 16px;">
          Your <strong>${roleLabel}</strong> account has been created on Bainsla Music CMS.
        </p>
        ${createdByLine}

        <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-top: 16px;">
          <p style="color: #999; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px;">Your Login Details</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; color: #666; font-size: 14px; width: 80px;">URL:</td>
              <td style="padding: 6px 0;"><a href="${loginUrl}" style="color: #dc2626; font-size: 14px; font-weight: 500;">${loginUrl}</a></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #666; font-size: 14px;">Email:</td>
              <td style="padding: 6px 0; color: #1a1a1a; font-size: 14px; font-weight: 500;">${params.email}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #666; font-size: 14px;">Password:</td>
              <td style="padding: 6px 0; color: #1a1a1a; font-size: 14px; font-weight: 500;">${params.password}</td>
            </tr>
          </table>
        </div>
      </div>

      <div style="text-align: center; margin-bottom: 20px;">
        <a href="${loginUrl}" style="display: inline-block; background: #dc2626; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
          Login to Dashboard
        </a>
      </div>

      <p style="color: #999; font-size: 12px; text-align: center;">
        If you did not request this account, please ignore this email.
        For security, we recommend changing your password after first login.
      </p>
      <p style="color: #ccc; font-size: 11px; text-align: center; margin-top: 20px;">
        &copy; ${new Date().getFullYear()} Bainsla Music. All rights reserved.
      </p>
    </div>
  `;
}
