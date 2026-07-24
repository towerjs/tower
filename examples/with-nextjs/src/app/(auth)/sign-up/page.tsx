import { signUp } from "@/app/actions";

export default function SignUpPage() {
  return (
    <div className="w-full max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">Sign up</h1>
      <form action={signUp} className="flex flex-col gap-4">
        <input
          name="name"
          type="text"
          placeholder="Name"
          required
          className="rounded border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="rounded border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          className="rounded border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
        <button
          type="submit"
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Sign up
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-neutral-500">
        Already have an account?{" "}
        <a href="/sign-in" className="text-neutral-900 underline">
          Sign in
        </a>
      </p>
    </div>
  );
}
