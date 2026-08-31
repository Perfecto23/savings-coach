import path from "node:path";

export function configureAuthenticatedRun(
  suite: string,
  runtimeDir: string,
) {
  const token = `${suite}-${process.pid}-${Date.now()}`;
  process.env.SAVINGS_E2E_RUN_TOKEN = token;
  process.env.SAVINGS_E2E_RUNTIME_DIR = path.resolve(runtimeDir);
  return token;
}
