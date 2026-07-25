import nodemailer from "nodemailer"
import type { EmailSendParams, EmailSendResult, SmtpEmailConfig } from "../types.js"
import { resolveEmailContent, toAddressList } from "./email-shared.js"

/** Email provider that sends via SMTP. */
export class SmtpEmailProvider {
  private from?: string
  private transporter: nodemailer.Transporter

  constructor(config: SmtpEmailConfig) {
    const host = config.host ?? process.env.SMTP_HOST
    if (!host) {
      throw new Error("[courier.email] Missing SMTP host. Set modules.courier.email.host or SMTP_HOST.")
    }

    const port = config.port ?? Number(process.env.SMTP_PORT ?? 587)
    const user = config.user ?? process.env.SMTP_USER
    const password = config.password ?? process.env.SMTP_PASSWORD

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: config.secure ?? port === 465,
      ignoreTLS: config.ignoreTLS,
      auth: user ? { user, pass: password } : undefined,
    })
    this.from = config.from ?? process.env.COURIER_EMAIL_FROM
  }

  async send(params: EmailSendParams): Promise<EmailSendResult> {
    const from = params.from ?? this.from
    if (!from) {
      throw new Error("[courier.email] Missing from address. Set modules.courier.email.from or params.from.")
    }

    const { html, text } = await resolveEmailContent(params)
    const info = await this.transporter.sendMail({
      from,
      to: toAddressList(params.to),
      subject: params.subject,
      html,
      text,
      cc: toAddressList(params.cc),
      bcc: toAddressList(params.bcc),
      replyTo: params.replyTo,
      headers: params.headers,
      attachments: params.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: typeof attachment.content === "string" ? attachment.content : Buffer.from(attachment.content),
        contentType: attachment.contentType,
        cid: attachment.cid,
      })),
    })

    return {
      id: info.messageId,
      provider: "smtp",
    }
  }
}
