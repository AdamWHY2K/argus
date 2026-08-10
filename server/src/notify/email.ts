import nodemailer from 'nodemailer'
import type { Settings } from '../settings.ts'
import type { Message } from './render.ts'

export async function sendEmail(
  cfg: Settings['email'],
  msg: Message,
  imagePath: string | null,
) {
  if (!cfg.host) throw new Error('email: SMTP host is required')
  if (!cfg.to) throw new Error('email: a recipient is required')

  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
  })

  await transport.sendMail({
    from: cfg.from || 'argus@localhost',
    to: cfg.to,
    subject: msg.subject,
    text: msg.text,
    html: msg.emailHtml,
    // The template references this by cid, so the image travels with the mail
    // instead of pointing at a LAN-only URL the reader can't reach.
    attachments: imagePath
      ? [{ filename: 'change.png', path: imagePath, cid: 'argusdiff' }]
      : undefined,
  })
}
