import type { ProjectState } from "../state.js";

export interface FrameworkAdapter {
  name: string;
  prompt(): Promise<Record<string, unknown>>;
  generate(state: ProjectState, targetDir: string): Promise<void>;
}
