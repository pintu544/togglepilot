/**
 * Credential guard (SPEC NFR-2).
 *
 * Flagsmith credentials are read from environment variables only, never from
 * files the repo tracks and never printed. Mutating commands refuse to run
 * when either credential is absent.
 */

const REQUIRED_CREDENTIALS = [
  "FLAGSMITH_API_KEY",
  "FLAGSMITH_ENVIRONMENT_KEY",
] as const;

export function missingCredentials(): string[] {
  return REQUIRED_CREDENTIALS.filter((name) => !process.env[name]);
}

/**
 * Exit with a clear error unless every required credential is present.
 * Call this at the top of every mutating subcommand (run, rollout).
 * Never prints a credential value.
 */
export function requireCredentials(command: string): void {
  const missing = missingCredentials();
  if (missing.length > 0) {
    console.error(
      `togglepilot ${command}: missing required credentials: ${missing.join(", ")}`,
    );
    console.error(
      "Set them in your environment (see .env.example) before running a mutating command.",
    );
    process.exit(1);
  }
}
