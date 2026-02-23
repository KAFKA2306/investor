import { join } from "node:path";
import { z } from "zod";

export const InferenceResultSchema = z.object({
  model: z.string(),
  forecast: z.array(z.number()),
});

export type InferenceResult = z.infer<typeof InferenceResultSchema>;

export class InferenceService {
  private readonly cwd: string;

  constructor() {
    this.cwd = join(process.cwd(), "src/experiments/foundation_models");
  }

  async predict(history: number[], modelId: string): Promise<InferenceResult> {
    const proc = Bun.spawn(
      ["/root/.local/bin/uv", "run", "python", "run_inference.py"],
      {
        cwd: this.cwd,
        stdin: "pipe",
        stdout: "pipe",
        stderr: "ignore",
      },
    );

    const input = JSON.stringify({ history, model: modelId });
    await proc.stdin.write(new TextEncoder().encode(input));
    await proc.stdin.end();

    const outputText = await new Response(proc.stdout).text();
    const result = JSON.parse(outputText);
    return InferenceResultSchema.parse(result);
  }
}
