import { requireEnvironmentVariable } from "./environment";

export default {
  providers: [
    {
      domain: requireEnvironmentVariable("CONVEX_SITE_URL"),
      applicationID: "convex",
    },
  ],
};
