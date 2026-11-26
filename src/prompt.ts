import { createInterface } from "node:readline";
import type { Readable } from "node:stream";

export function createPrompt(input: Readable = process.stdin) {
  let reader: ReturnType<typeof createInterface> | undefined;
  let lines: AsyncIterableIterator<string> | undefined;

  return {
    async read(): Promise<string | undefined> {
      if (!lines) {
        reader = createInterface({ input, output: process.stdout, terminal: input === process.stdin && !!process.stdin.isTTY, crlfDelay: Infinity });
        // Keep buffered answers across guided planning and review on piped stdin.
        lines = reader[Symbol.asyncIterator]();
      }
      return (await lines.next()).value;
    },
    close(): void {
      reader?.close();
    },
  };
}
