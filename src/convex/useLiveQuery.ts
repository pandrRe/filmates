import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";
import { getFunctionName } from "convex/server";
import { useEffect, useState } from "octane";
import { convexClient } from "./client";

export type LiveQuery<Value> =
  | { status: "loading" }
  | { status: "failed"; message: string }
  | { status: "ready"; value: Value };

export function useLiveQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: FunctionArgs<Query>,
): LiveQuery<FunctionReturnType<Query>> {
  const [result, setResult] = useState<LiveQuery<FunctionReturnType<Query>>>({
    status: "loading",
  });

  const queryName = getFunctionName(query);
  const argumentsKey = JSON.stringify(args);

  useEffect(() => {
    setResult({ status: "loading" });
    return convexClient.onUpdate(
      query,
      args,
      (value) => setResult({ status: "ready", value }),
      (error) => setResult({ status: "failed", message: error.message }),
    );
  }, [queryName, argumentsKey]);

  return result;
}
