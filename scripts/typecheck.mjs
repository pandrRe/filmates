import { spawnSync } from "node:child_process";

const PROJECTS = [".", "convex"];
const VENDORED = /^node_modules[/\\]/;
const CONTINUATION = /^\s/;

function ownDiagnostics(output) {
  const kept = [];
  let keeping = false;
  for (const line of output.split("\n")) {
    if (line.length === 0) {
      continue;
    }
    if (CONTINUATION.test(line)) {
      if (keeping) {
        kept.push(line);
      }
      continue;
    }
    keeping = !VENDORED.test(line);
    if (keeping) {
      kept.push(line);
    }
  }
  return kept;
}

let failed = false;
for (const project of PROJECTS) {
  const run = spawnSync(
    "node_modules/.bin/tsc",
    ["--noEmit", "--pretty", "false", "--project", project],
    { encoding: "utf8" },
  );
  if (run.error !== undefined) {
    throw run.error;
  }
  const diagnostics = ownDiagnostics(`${run.stdout}${run.stderr}`);
  if (diagnostics.length > 0) {
    failed = true;
    process.stdout.write(`${diagnostics.join("\n")}\n`);
  }
}

process.exit(failed ? 1 : 0);
