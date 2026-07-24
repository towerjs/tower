import { getSession } from "@towerjs/gatehouse/next-js";
import { signOut } from "@/app/actions";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) throw new Error("proxy should have redirected unauthenticated users");
  const user = session.user;

  return (
    <div className="mx-auto max-w-lg py-12">
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
      <div className="mt-8 space-y-3">
        <p>
          <span className="text-neutral-500">Name:</span> {user.name}
        </p>
        <p>
          <span className="text-neutral-500">Email:</span> {user.email}
        </p>
        <p>
          <span className="text-neutral-500">Verified:</span>{" "}
          {user.emailVerified ? "Yes" : "No"}
        </p>
        <p>
          <span className="text-neutral-500">ID:</span>{" "}
          <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">
            {user.id}
          </code>
        </p>
      </div>
    </div>
  );
}
