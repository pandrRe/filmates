declare module "*.css" {}

interface ImportMetaEnvironment {
  readonly VITE_CONVEX_URL: unknown;
}

interface ImportMeta {
  readonly env: ImportMetaEnvironment;
}
