// Outreach mailer — a SEPARATE mailbox from the system mailer in lib/email.ts.
// Plain text only: no HTML, no tracking pixel, no wrapped links (all cold-email deliverability killers).
// Configure with ABM_SMTP_HOST / ABM_SMTP_PORT / ABM_SMTP_USER / ABM_SMTP_PASS. No default host on
// purpose: sending from the wrong provider fails SPF/DMARC and lands in spam, so it must be explicit.

import nodemailer from 'nodemailer'

export interface OutboundMail {
  to: string
  subject: string
  text: string
  fromName: string
  inReplyTo?: string | null
  references?: string[]
}

export function mailerConfigured(): boolean {
  return !!(process.env.ABM_SMTP_HOST && process.env.ABM_SMTP_USER && process.env.ABM_SMTP_PASS)
}

export function mailerFromAddress(): string {
  return process.env.ABM_SMTP_USER ?? ''
}

export async function sendPlain(m: OutboundMail): Promise<{ messageId: string }> {
  if (!mailerConfigured()) {
    throw new Error('Outreach mailbox is not configured. Set ABM_SMTP_HOST, ABM_SMTP_USER and ABM_SMTP_PASS.')
  }
  const port = Number(process.env.ABM_SMTP_PORT ?? 465)
  const transport = nodemailer.createTransport({
    host: process.env.ABM_SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.ABM_SMTP_USER, pass: process.env.ABM_SMTP_PASS },
    tls: { minVersion: 'TLSv1.2' },
    connectionTimeout: 15_000,
    socketTimeout: 20_000,
  })
  const from = process.env.ABM_SMTP_USER!
  const info = await transport.sendMail({
    from: { name: m.fromName, address: from },
    to: m.to,
    subject: m.subject,
    text: m.text,
    inReplyTo: m.inReplyTo ?? undefined,
    references: m.references?.length ? m.references : undefined,
  })
  return { messageId: String(info.messageId ?? '') }
}
