const CONVEX_THROWN_MESSAGE = /Uncaught Error: (.+?)\n/;

export function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return CONVEX_THROWN_MESSAGE.exec(message)?.[1] ?? message;
}
