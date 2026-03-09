import type { z } from "zod";

export interface Skill<TInput, TOutput> {
  name: string;
  description: string;
  schema: z.ZodType<TInput>;
  execute(args: TInput): Promise<TOutput>;
}
