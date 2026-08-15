import type { ConsoleEmailConfig, EmailSendParams, EmailSendResult } from '../types.js'

export class ConsoleEmailProvider {
  private config: ConsoleEmailConfig

  constructor(config: ConsoleEmailConfig) {
    this.config = config
  }

  async send(params: EmailSendParams): Promise<EmailSendResult> {
    const output: Record<string, unknown> = {
      to: params.to,
      subject: params.subject,
      from: params.from ?? this.config.from,
    }
    if (params.text) output.text = params.text
    if (params.html) output.html = params.html
    if (params.react) output.react = '[React component]'
    if (params.cc) output.cc = params.cc
    if (params.bcc) output.bcc = params.bcc
    if (params.attachments) output.attachments = params.attachments.map((a) => a.filename)

    console.log('[courier.email]', JSON.stringify(output))

    return {
      provider: 'console',
    }
  }
}
