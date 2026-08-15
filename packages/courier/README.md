# `@towerjs/courier`

[![npm version](https://img.shields.io/npm/v/@towerjs/courier?style=for-the-badge&labelColor=000000)](https://www.npmjs.com/package/@towerjs/courier)

Multi-channel communication layer for Tower. Send emails (Resend, SES, SMTP), SMS (Twilio), and push notifications (Web Push) through a unified API.

## Installation

```bash
pnpm add @towerjs/courier
```

## Usage

Configure Courier in your `tower.config.ts`:

```ts
import { defineTower } from '@towerjs/blueprint'

export default defineTower({
  modules: {
    courier: {
      email: { provider: 'resend' },
      sms: { provider: 'twilio' },
      push: { provider: 'web-push' },
    },
  },
})
```

Send messages:

```ts
import { courier } from 'towerjs/courier'

await courier.email.send({
  to: 'user@example.com',
  subject: 'Welcome!',
  text: 'Hello from Tower',
})

await courier.sms.send({
  to: '+1234567890',
  body: 'Your code is 123456',
})
```

## Providers

### Email

| Provider | Package                 | Config value |
| -------- | ----------------------- | ------------ |
| Console  | (built-in)              | `"console"`  |
| Resend   | `resend`                | `"resend"`   |
| AWS SES  | `@aws-sdk/client-sesv2` | `"ses"`      |
| SMTP     | `nodemailer`            | `"smtp"`     |

### SMS

| Provider | Package  | Config value |
| -------- | -------- | ------------ |
| Twilio   | `twilio` | `"twilio"`   |

### Push

| Provider | Package    | Config value |
| -------- | ---------- | ------------ |
| Web Push | `web-push` | `"web-push"` |

## React email

Courier renders React email templates natively:

```tsx
import { courier } from 'towerjs/courier'

import WelcomeEmail from './emails/welcome.tsx'

await courier.email.send({
  to: 'user@example.com',
  subject: 'Welcome!',
  react: <WelcomeEmail name="Alice" />,
})
```

## Configuration

```ts
{
  email: {
    provider: "resend",           // or "ses" | "smtp"
    apiKey: process.env.RESEND_API_KEY,
    from: "noreply@example.com",
  },
  sms: {
    provider: "twilio",
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    from: process.env.TWILIO_PHONE_NUMBER,
  },
}
```

## Included in

- [towerjs](https://www.npmjs.com/package/towerjs) — meta-package
