import { getSession } from "@towerjs/gatehouse/next-js";
import { signOut } from "@/app/actions";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) throw new Error("proxy should have redirected unauthenticated users");
  const user = session.user;

  return (
    <div className="mx-auto max-w-lg py-12 space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
          >
            Sign out
          </button>
        </form>
      </div>

      <section className="space-y-3">
        <p><span className="text-neutral-500">Name:</span> {user.name}</p>
        <p><span className="text-neutral-500">Email:</span> {user.email}</p>
        <p><span className="text-neutral-500">Verified:</span> {user.emailVerified ? "Yes" : "No"}</p>
        <p>
          <span className="text-neutral-500">ID:</span>{" "}
          <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">{user.id}</code>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Messenger</h2>
        <p className="text-sm text-neutral-600">
          A login alert email was sent when you signed in. Try the Messenger API routes:
        </p>
        <pre className="rounded bg-neutral-100 p-4 text-xs overflow-x-auto">{`curl -X POST http://localhost:3000/api/messenger/email \\
  -H "content-type: application/json" \\
  -d '{"to":"${user.email}"}'

curl -X POST http://localhost:3000/api/messenger/login-alert \\
  -H "content-type: application/json" \\
  -d '{"to":"${user.email}","ipAddress":"203.0.113.10"}'`}</pre>
      </section>
    </div>
  );
}
