import fs from "node:fs/promises";
import path from "node:path";

const LOCK_DIR = "/tmp/savings-coach-plan-e2e.lock";

async function readText(filePath: string) {
  try {
    return (await fs.readFile(filePath, "utf8")).trim();
  } catch {
    return null;
  }
}

export default async function authenticatedGlobalTeardown() {
  const token = process.env.SAVINGS_E2E_RUN_TOKEN;
  const runtimeDir = process.env.SAVINGS_E2E_RUNTIME_DIR;
  if (!token || !runtimeDir) return;

  const allowedRuntimeDirs = new Set([
    path.resolve(".setup-e2e"),
    path.resolve(".setup-e2e/plan"),
  ]);
  if (!allowedRuntimeDirs.has(runtimeDir)) {
    throw new Error("Refusing to clean an unknown authenticated E2E runtime path");
  }

  if ((await readText(path.join(runtimeDir, ".run-token"))) === token) {
    await fs.rm(runtimeDir, { recursive: true, force: true });
  }

  if ((await readText(path.join(LOCK_DIR, "token"))) === token) {
    await fs.rm(LOCK_DIR, { recursive: true, force: true });
  }
}
