export type Framework = "next" | "react-router" | "vite" | "sveltekit" | "solid";

export type ProviderMap = Record<string, Record<string, unknown>>;

export type ProjectState = {
  projectName: string;
  framework: Framework;
  modules: ProviderMap;
  deployment?: "vercel" | "fly" | "aws";
  frameworkAnswers: Record<string, unknown>;
};
