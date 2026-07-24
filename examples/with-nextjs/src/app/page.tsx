export default function Home() {
  return (
    <div className="mx-auto max-w-lg py-24 text-center">
      <h1 className="text-3xl font-bold">Tower + Next.js</h1>
      <p className="mt-3 text-neutral-500">
        Application services provided by Tower underneath Next.js.
      </p>
      <div className="mt-8 flex items-center justify-center gap-3">
        <a
          href="/sign-in"
          className="rounded border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100"
        >
          Sign in
        </a>
        <a
          href="/sign-up"
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Get started
        </a>
      </div>
    </div>
  );
}
