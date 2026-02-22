import { readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { z } from "zod";

const ConfigSchema = z.object({
  project: z.object({
    name: z.string(),
  }),
  paths: z.object({
    data: z.string(),
    logs: z.string(),
  }),
  providers: z.object({
    yfinance: z.object({ enabled: z.boolean() }),
    jquants: z.object({
      enabled: z.boolean(),
      apiKey: z.string().optional(),
    }),
    edinet: z.object({ enabled: z.boolean() }),
    estat: z.object({ enabled: z.boolean() }),
    ai: z.object({ enabled: z.boolean() }),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

class Core {
  public readonly config: Config;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): Config {
    const configPath = join(import.meta.dir, "config", "default.yaml");
    const fileContents = readFileSync(configPath, "utf8");
    const data = yaml.load(fileContents);
    const result = ConfigSchema.safeParse(data);

    if (!result.success) {
      process.exit(1);
    }

    return result.data;
  }

  public getEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
      process.exit(1);
    }
    return value;
  }
}

export abstract class BaseAgent {
  protected readonly core = core;
  constructor() {
    if (!this.core.config.project.name) {
      process.exit(1);
    }
  }
  public abstract run(): Promise<void>;
}

export const core = new Core();
