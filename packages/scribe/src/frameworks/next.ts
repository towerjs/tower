import { randomBytes } from "node:crypto";
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
    await writeFile(join(projectDir, ".env.example"), envExample(state));
    if (state.modules.gatehouse) {
      const secret = randomBytes(32).toString("base64");
      const envContent = [
        `# Authentication — auto-generated during setup`,
        `BETTER_AUTH_SECRET="${secret}"`,
        `BETTER_AUTH_URL="http://localhost:3000"`,
        ``,
        `# Database`,
        `DATABASE_URL="postgres://user:password@localhost:5432/tower"`,
        ``,
      ].join("\n");
      await writeFile(join(projectDir, ".env"), envContent);
    }

    // Auth route + proxy (only when gatehouse is enabled)
    if (state.modules.gatehouse) {
      const authDir = join(projectDir, "src", "app", "api", "auth", "[...all]");
      await mkdir(authDir, { recursive: true });
      await writeFile(join(authDir, "route.ts"), authRoute());
      await writeFile(join(projectDir, "src", "proxy.ts"), proxyFile());
    }

    // Install Tower dependencies
    const towerDeps: string[] = ["towerjs"];
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
  modules: {
${modules}
  },
});
`;
}

function authRoute(): string {
  return `import { tower } from "towerjs";

export const GET = tower.gatehouse.routes.GET;
export const POST = tower.gatehouse.routes.POST;
`;
}

function proxyFile(): string {
  return `import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { tower } from "towerjs";

const { handler, config } = tower.gatehouse.proxy({
  public: ["/", "/sign-in", "/sign-up", "/api/auth/:path*"],
  redirectTo: "/sign-in",
});

export async function middleware(request: NextRequest) {
  return handler(request) ?? NextResponse.next();
}

export { config };
`;
}

export function envExample(state: ProjectState): string {
  const vars: string[] = [];

  for (const [name, _cfg] of Object.entries(state.modules)) {
    if (name === "vault") {
      if (vars.length > 0) vars.push("");
      vars.push("# Database");
      vars.push('DATABASE_URL="postgres://user:password@localhost:5432/tower"');
    }
    if (name === "gatehouse") {
      if (vars.length > 0) vars.push("");
      vars.push("# Authentication");
      vars.push("BETTER_AUTH_SECRET=");
      vars.push('BETTER_AUTH_URL="http://localhost:3000"');
    }
  }

  return vars.join("\n") + "\n";
}
