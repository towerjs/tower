export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-8 space-y-6">
      <h1 className="text-3xl font-semibold">Tower + Next.js</h1>
      <p className="text-neutral-600">
        Messenger is configured with a provider-agnostic API. Swap providers in{" "}
        <code>tower.config.ts</code> and keep app code unchanged.
      </p>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Try Messenger API</h2>
        <pre className="rounded bg-neutral-100 p-4 text-sm overflow-x-auto">{`curl -X POST http://localhost:3000/api/messenger/email \\
  -H "content-type: application/json" \\
  -d '{"to":"you@example.com"}'

curl -X POST http://localhost:3000/api/messenger/login-alert \\
  -H "content-type: application/json" \\
  -d '{"to":"you@example.com","ipAddress":"203.0.113.10","userAgent":"Safari"}'

curl -X POST http://localhost:3000/api/messenger/sms \\
  -H "content-type: application/json" \\
  -d '{"to":"+15551234567","body":"Hello from Tower"}'

curl -X POST http://localhost:3000/api/messenger/push \\
  -H "content-type: application/json" \\
  -d '{"subscription":{"endpoint":"...","keys":{"p256dh":"...","auth":"..."}}}'`}</pre>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Gatehouse integration</h2>
        <p className="text-neutral-600">
          When Messenger is enabled, Gatehouse automatically routes built-in auth
          messages through it for password reset, email confirmation, magic link,
          email OTP, and phone OTP.
        </p>
      </section>
    </main>
  );
}
