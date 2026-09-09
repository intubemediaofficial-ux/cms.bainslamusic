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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function getChannelInviteEmailHtml(params: {
  channelTitle: string;
  channelId: string;
  authorizeUrl: string;
  invitedBy: string;
}): string {
  const title = escapeHtml(params.channelTitle || params.channelId);
  const channelId = escapeHtml(params.channelId);
  const invitedBy = escapeHtml(params.invitedBy);
  const url = escapeHtml(params.authorizeUrl);

  return `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; background: #dc2626; border-radius: 12px; padding: 10px 14px; margin-bottom: 8px;">
          <span style="color: #fff; font-size: 18px; font-weight: bold;">Bainsla Music</span>
        </div>
        <p style="color: #666; font-size: 14px; margin: 4px 0 0;">Channel Management System</p>
      </div>

      <div style="background: #f8f9fa; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
        <h2 style="color: #1a1a1a; margin: 0 0 8px; font-size: 20px;">YouTube channel authorization request</h2>
        <p style="color: #666; font-size: 14px; margin: 0 0 16px;">
          <strong>${invitedBy}</strong> has asked you to connect your YouTube channel to Bainsla Music CMS.
        </p>

        <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="color: #999; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">Channel</p>
          <p style="color: #1a1a1a; font-size: 15px; font-weight: 600; margin: 0;">${title}</p>
          <p style="color: #666; font-size: 12px; font-family: monospace; margin: 4px 0 0;">${channelId}</p>
        </div>

        <div style="text-align: center; margin: 24px 0 16px;">
          <a href="${url}" style="display: inline-block; background: #dc2626; color: #fff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 12px 28px; border-radius: 8px;">Review &amp; Authorize Channel</a>
        </div>

        <p style="color: #666; font-size: 13px; margin: 0 0 8px;">
          The link opens Bainsla Music's authorization disclosure first. You will confirm channel ownership, review the requested permissions, and then sign in on <strong>accounts.google.com</strong>. Bainsla Music never sees your Google or YouTube password.
        </p>
        <p style="color: #999; font-size: 12px; margin: 0;">
          This link expires in 15 minutes and works only for the channel above. If you did not expect this email, you can ignore it.
        </p>
        <p style="color: #999; font-size: 11px; word-break: break-all; margin: 12px 0 0;">
          If the button does not work, copy this link: <a href="${url}" style="color: #dc2626;">${url}</a>
        </p>
      </div>

      <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
        Bainsla Music CMS &middot; <a href="https://cms.bainslamusic.com/privacy-policy" style="color: #999;">Privacy Policy</a>
      </p>
    </div>
  `;
}

export function getChannelListInviteEmailHtml(params: {
  clientName: string;
  channels: { channelId: string; title: string; verified: boolean }[];
  inviteUrl: string;
  invitedBy: string;
}): string {
  const name = escapeHtml(params.clientName);
  const invitedBy = escapeHtml(params.invitedBy);
  const url = escapeHtml(params.inviteUrl);
  const pending = params.channels.filter((c) => !c.verified).length;
  const rows = params.channels
    .map((c) => {
      const title = escapeHtml(c.title || c.channelId);
      const link = `https://www.youtube.com/channel/${encodeURIComponent(c.channelId)}`;
      const badge = c.verified
        ? `<span style="display:inline-block;background:#dcfce7;color:#15803d;font-size:11px;font-weight:600;padding:3px 8px;border-radius:999px;">&#10003; Verified</span>`
        : `<span style="display:inline-block;background:#fef3c7;color:#b45309;font-size:11px;font-weight:600;padding:3px 8px;border-radius:999px;">Pending</span>`;
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee;"><a href="${link}" style="color:#1a1a1a;font-size:14px;font-weight:500;text-decoration:none;">${title}</a><br><span style="color:#999;font-size:11px;font-family:monospace;">${escapeHtml(c.channelId)}</span></td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;">${badge}</td>
      </tr>`;
    })
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; background: #dc2626; border-radius: 12px; padding: 10px 14px; margin-bottom: 8px;">
          <span style="color: #fff; font-size: 18px; font-weight: bold;">Bainsla Music</span>
        </div>
        <p style="color: #666; font-size: 14px; margin: 4px 0 0;">Channel Management System</p>
      </div>

      <div style="background: #f8f9fa; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
        <h2 style="color: #1a1a1a; margin: 0 0 8px; font-size: 20px;">Hello ${name}, please authorize your YouTube channels</h2>
        <p style="color: #666; font-size: 14px; margin: 0 0 16px;">
          <strong>${invitedBy}</strong> has asked you to connect ${params.channels.length} channel${params.channels.length === 1 ? "" : "s"} to Bainsla Music CMS${pending > 0 ? ` (${pending} still pending)` : ""}.
        </p>

        <div style="text-align: center; margin: 20px 0;">
          <a href="${url}" style="display: inline-block; background: #dc2626; color: #fff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 12px 28px; border-radius: 8px;">Open my channel list &amp; authorize</a>
        </div>

        <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px;">
          <p style="color: #999; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">Your channels</p>
          <table style="width: 100%; border-collapse: collapse;">${rows}</table>
        </div>

        <p style="color: #666; font-size: 13px; margin: 16px 0 8px;">
          On that page each channel has its own <strong>Authorize</strong> button. Verify them one by one — the status next to each channel turns to <strong>Verified</strong> as soon as it is done. Google sign-in happens only on <strong>accounts.google.com</strong>; Bainsla Music never sees your password.
        </p>
        <p style="color: #999; font-size: 12px; margin: 0;">
          This link is personal to you and valid for 7 days. If you did not expect this email, you can ignore it.
        </p>
        <p style="color: #999; font-size: 11px; word-break: break-all; margin: 12px 0 0;">
          If the button does not work, copy this link: <a href="${url}" style="color: #dc2626;">${url}</a>
        </p>
      </div>

      <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
        Bainsla Music CMS &middot; <a href="https://cms.bainslamusic.com/privacy-policy" style="color: #999;">Privacy Policy</a>
      </p>
    </div>
  `;
}
