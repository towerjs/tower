import { select } from "@inquirer/prompts";
import { execa } from "execa";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { FrameworkAdapter } from "./adapter.js";
import type { ProjectState } from "../state.js";

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const nextAdapter: FrameworkAdapter = {
  name: "next",

  async prompt() {
    const typescript = await select<boolean>({
      message: "TypeScript?",
      choices: [
        { name: "Yes", value: true },
        { name: "No", value: false },
      ],
    });

    const tailwind = await select<boolean>({
      message: "Tailwind CSS?",
      choices: [
        { name: "Yes", value: true },
        { name: "No", value: false },
      ],
    });

    return { typescript, tailwind };
  },

  async generate(state: ProjectState, targetDir: string) {
    const answers = state.frameworkAnswers as { typescript?: boolean; tailwind?: boolean };
    const useTs = answers.typescript !== false;
    const useTailwind = answers.tailwind === true;

    const flags: string[] = [
      state.projectName,
      "--eslint",
      "--app",
      "--src-dir",
      "--import-alias", "@/*",
      "--use-pnpm",
      "--no-turbopack",
    ];

    if (useTs) {
      flags.push("--typescript");
    } else {
      flags.push("--javascript");
    }

    if (useTailwind) {
      flags.push("--tailwind");
    } else {
      flags.push("--no-tailwind");
    }

    // create-next-app creates the project directory inside targetDir
    await execa("npx", ["create-next-app@latest", ...flags], {
      cwd: targetDir,
      stdio: "inherit",
    });

    const projectDir = join(targetDir, state.projectName);

    // Layer Tower-specific files
    await writeFile(join(projectDir, "tower.config.ts"), towerConfig(state));
    await writeFile(join(projectDir, "src", "tower.ts"), towerRuntime(state));
    await writeFile(join(projectDir, ".env.example"), envExample(state));

    // Install Tower dependencies
    const towerDeps: string[] = ["@towerjs/blueprint", "@towerjs/foundation"];
    for (const [name] of Object.entries(state.modules)) {
      towerDeps.push(`@towerjs/${name}`);
    }
    await execa("pnpm", ["add", ...towerDeps], { cwd: projectDir, stdio: "inherit" });
  },
};

export function towerConfig(state: ProjectState): string {
  const modules = Object.entries(state.modules)
    .map(([name, cfg]) => {
      const entries = Object.entries(cfg ?? {})
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `    ${k}: ${JSON.stringify(v)},`);
      if (entries.length === 0) return `    ${name}: {},`;
      return `    ${name}: {\n${entries.join("\n")}\n  },`;
    })
    .join("\n");

  return `import { defineTower } from "@towerjs/blueprint";

export default defineTower({
  framework: "next",
  modules: {
${modules}
  },
});
`;
}

export function towerRuntime(state: ProjectState): string {
  const moduleImports: string[] = [];
  const getters: string[] = [];

  for (const [name] of Object.entries(state.modules)) {
    moduleImports.push(`import type { ${capitalize(name)}Module } from "@towerjs/${name}";`);
    getters.push(`  ${name}: app.container.get<${capitalize(name)}Module>("${name}"),`);
  }

  return `import { createTowerApp } from "@towerjs/foundation";
${moduleImports.join("\n")}
import config from "../tower.config";

const app = await createTowerApp(config);

export const tower = {
${getters.join("\n")}
};
`;
}

export function envExample(state: ProjectState): string {
  const vars: string[] = [];

  for (const [name, _cfg] of Object.entries(state.modules)) {
    if (name === "vault") {
      vars.push("# Database");
      vars.push('DATABASE_URL="postgres://user:password@localhost:5432/tower"');
    }
  }

  return vars.join("\n") + "\n";
}
