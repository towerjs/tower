declare module "node:fs/promises" {
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  export function writeFile(path: string, data: string, options?: { flag?: string }): Promise<void>;
}

declare module "node:path" {
  export function join(...paths: string[]): string;
}

declare const process: {
  cwd(): string;
};
