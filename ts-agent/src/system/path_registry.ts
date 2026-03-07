import {
  buildPathRegistry,
  loadRuntimeConfig,
  type PathRegistry,
} from "./runtime_config.ts";

export type { PathRegistry } from "./runtime_config.ts";

export const paths: PathRegistry = buildPathRegistry(loadRuntimeConfig());
