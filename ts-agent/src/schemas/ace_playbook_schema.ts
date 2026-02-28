import { z } from "zod";

/**
 * ACE (Agentic Context Engineering) Playbook Schema
 * Based on ArXiv 2510.04618 and JRay-Lin/ace-agents
 */

export const AceBulletSchema = z.object({
  id: z
    .string()
    .describe("Unique identifier for the context bullet (e.g., ctx-a1b2)"),
  content: z
    .string()
    .describe("The actionable strategy, rule, or insight content"),
  section: z
    .enum([
      "strategies_and_hard_rules",
      "insights",
      "evidence",
      "domain_knowledge",
    ])
    .describe("The organizational section of the playbook"),
  helpful_count: z
    .number()
    .default(0)
    .describe("Number of times this bullet was marked as helpful by Reflector"),
  harmful_count: z
    .number()
    .default(0)
    .describe("Number of times this bullet led to poor results"),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  metadata: z
    .record(z.string(), z.any())
    .optional()
    .describe("Additional context like source scenario or market condition"),
});

export const AcePlaybookSchema = z.object({
  bullets: z.array(AceBulletSchema),
});

export type AceBullet = z.infer<typeof AceBulletSchema>;
export type AcePlaybook = z.infer<typeof AcePlaybookSchema>;
