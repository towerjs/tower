import type { ProjectState } from "../state.js";

/**
 * Interface for framework adapters that scaffold Tower projects.
 *
 * Implementations handle framework-specific setup: calling create-* commands,
 * generating config files, and installing dependencies.
 */
export interface FrameworkAdapter {
  name: string;
  prompt(): Promise<Record<string, unknown>>;
  generate(state: ProjectState, targetDir: string): Promise<void>;
}
