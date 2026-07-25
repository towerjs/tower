import { render, toPlainText } from "@react-email/render"
import type { EmailAddress, EmailSendParams } from "../types.js"

export function toAddressList(value?: EmailAddress): string[] | undefined {
  if (!value) return undefined
  return Array.isArray(value) ? value : [value]
}

export async function resolveEmailContent(params: EmailSendParams): Promise<{ html?: string; text?: string }> {
  let html = params.html
  let text = params.text

  if (params.react && !html) {
    html = await render(params.react)
  }

  if (html && !text) {
    text = toPlainText(html)
  }

  if (!html && !text && !params.react) {
    throw new Error("[courier.email] Missing body. Provide html, text, or react template.")
  }

  return { html, text }
}
