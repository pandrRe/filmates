import { ConvexClient } from "convex/browser";
import * as valibot from "valibot";

const ConvexUrl = valibot.pipe(valibot.string(), valibot.url());

export const convexClient = new ConvexClient(
  valibot.parse(ConvexUrl, import.meta.env.VITE_CONVEX_URL),
);
