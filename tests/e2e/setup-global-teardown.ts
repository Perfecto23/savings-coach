import fs from "node:fs/promises";
import path from "node:path";

export default async function setupGlobalTeardown() {
  await fs.rm(path.resolve(".setup-e2e"), { recursive: true, force: true });
}
