import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2"
import nodemailer from "nodemailer"
import type { EmailSendParams, EmailSendResult, SesEmailConfig } from "../types.js"
import { resolveEmailContent, toAddressList } from "./email-shared.js"

/** Email provider that sends via AWS SESv2. Attachments are handled by building a raw MIME message through nodemailer. */
export class SesEmailProvider {
  private from?: string
  private configurationSetName?: string
  private client: SESv2Client

  constructor(config: SesEmailConfig) {
    const region = config.region ?? process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION
    if (!region) {
      throw new Error("[courier.email] Missing AWS region. Set modules.courier.email.region or AWS_REGION.")
    }

    this.client = new SESv2Client({
      region,
      credentials: config.accessKeyId || process.env.AWS_ACCESS_KEY_ID
        ? {
            accessKeyId: config.accessKeyId ?? process.env.AWS_ACCESS_KEY_ID ?? "",
            secretAccessKey: config.secretAccessKey ?? process.env.AWS_SECRET_ACCESS_KEY ?? "",
            sessionToken: config.sessionToken ?? process.env.AWS_SESSION_TOKEN,
          }
        : undefined,
    })
    this.from = config.from ?? process.env.COURIER_EMAIL_FROM
    this.configurationSetName = config.configurationSetName
  }

  async send(params: EmailSendParams): Promise<EmailSendResult> {
    const from = params.from ?? this.from
    if (!from) {
      throw new Error("[courier.email] Missing from address. Set modules.courier.email.from or params.from.")
    }

    const { html, text } = await resolveEmailContent(params)

    const rawTransporter = nodemailer.createTransport({ jsonTransport: true })
    const rawInfo = await rawTransporter.sendMail({
      from,
      to: toAddressList(params.to),
      subject: params.subject,
      html,
      text,
      cc: toAddressList(params.cc),
      bcc: toAddressList(params.bcc),
      replyTo: params.replyTo,
      headers: params.headers,
      attachments: params.attachments?.map((a) => ({
        filename: a.filename,
        content: typeof a.content === "string" ? a.content : Buffer.from(a.content),
        contentType: a.contentType,
        cid: a.cid,
      })),
    })

    const result = await this.client.send(new SendEmailCommand({
      FromEmailAddress: from,
      Destination: {
        ToAddresses: toAddressList(params.to),
        CcAddresses: toAddressList(params.cc),
        BccAddresses: toAddressList(params.bcc),
      },
      ReplyToAddresses: params.replyTo ? [params.replyTo] : undefined,
      Content: {
        Raw: { Data: new Uint8Array(rawInfo.message as unknown as Buffer) },
      },
      ConfigurationSetName: this.configurationSetName,
    }))

    return {
      id: result.MessageId,
      provider: "ses",
    }
  }
}
