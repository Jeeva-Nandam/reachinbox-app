import nodemailer, { Transporter } from "nodemailer";
import { prisma } from "../config/database";
import { childLogger } from "../utils/logger";

const log = childLogger({ module: "email-sender" });

export interface SendResult {
  messageId: string;
  previewUrl: string | null;
}

/**
 * We don't build one global transporter off env-only Ethereal credentials, because
 * the schema supports multiple Sender identities per tenant (each with its own SMTP
 * credentials, stored on the Sender row - see PROJECT STRUCTURE §4). For the assignment's
 * Ethereal-only scope, a Sender's smtpUser/smtpPassword are simply the Ethereal
 * credentials you create (see README "Ethereal" section for how to obtain them);
 * nothing is hardcoded, and no credential is ever logged.
 */
export class EmailSenderService {
  private transporterCache = new Map<string, Transporter>();

  private async getTransporter(senderId: string): Promise<Transporter> {
    const cached = this.transporterCache.get(senderId);
    if (cached) return cached;

    const sender = await prisma.sender.findUniqueOrThrow({ where: { id: senderId } });

    const transporter = nodemailer.createTransport({
      host: sender.smtpHost,
      port: sender.smtpPort,
      secure: sender.smtpPort === 465,
      auth: {
        user: sender.smtpUser,
        pass: sender.smtpPassword,
      },
    });

    this.transporterCache.set(senderId, transporter);
    return transporter;
  }

  /** Drop a cached transporter, e.g. after sender credentials are updated. */
  invalidate(senderId: string): void {
    this.transporterCache.delete(senderId);
  }

  async send(params: {
    senderId: string;
    fromEmail: string;
    fromName: string;
    to: string;
    subject: string;
    body: string;
  }): Promise<SendResult> {
    const transporter = await this.getTransporter(params.senderId);

    const info = await transporter.sendMail({
      from: `"${params.fromName}" <${params.fromEmail}>`,
      to: params.to,
      subject: params.subject,
      text: params.body,
      html: `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(params.body)}</pre>`,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || null;

    log.info({ senderId: params.senderId, messageId: info.messageId, previewUrl }, "Email sent via Ethereal SMTP");

    return { messageId: info.messageId, previewUrl };
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const emailSenderService = new EmailSenderService();
