import type { ProjectState } from "../state.js";
import type { FrameworkAdapter } from "../frameworks/adapter.js";
import { nextAdapter } from "../frameworks/next.js";

const adapters: Record<string, FrameworkAdapter> = {
  next: nextAdapter,
};

export async function generateProject(
  state: ProjectState,
  targetDir: string,
): Promise<void> {
  const adapter = adapters[state.framework];

  if (!adapter) {
    throw new Error(
      `Unsupported framework: "${state.framework}". ` +
        "Only Next.js is supported in this version.",
    );
  }

  const frameworkAnswers = await adapter.prompt();
  state.frameworkAnswers = frameworkAnswers;

  await adapter.generate(state, targetDir);
}
