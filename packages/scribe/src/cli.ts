#!/usr/bin/env node
import { createCommand } from "./commands/create.js";

async function main() {
  const command = process.argv[2];

  switch (command) {
    case undefined:
    case "create":
      await createCommand();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main().catch((err) => {
  if (String(err).includes("User force closed the prompt")) {
    process.exit(0);
  }
  console.error(err);
  process.exit(1);
});
