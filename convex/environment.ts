import * as v from "valibot";

const NonEmptyString = v.pipe(v.string(), v.minLength(1));

export function requireEnvironmentVariable(name: string): string {
  const parsed = v.safeParse(NonEmptyString, process.env[name]);
  if (!parsed.success) {
    throw new Error(`environment variable ${name} is not set`);
  }
  return parsed.output;
}
