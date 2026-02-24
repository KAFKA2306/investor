import fs from "node:fs/promises";
import path from "node:path";
import {
  type AceBullet,
  type AcePlaybook,
  AcePlaybookSchema,
} from "../schemas/ace";

/**
 * ContextPlaybook handles the persistence and management of ACE context bullets.
 */
export class ContextPlaybook {
  private playbook: AcePlaybook = { bullets: [] };
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath =
      filePath || path.join(process.cwd(), "data", "playbook.json");
  }

  async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.filePath, "utf-8");
      const json = JSON.parse(data);
      this.playbook = AcePlaybookSchema.parse(json);
    } catch (error) {
      if ((error as { code?: string }).code === "ENOENT") {
        this.playbook = { bullets: [] };
        await this.save();
      } else {
        throw error;
      }
    }
  }

  async save(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      this.filePath,
      JSON.stringify(this.playbook, null, 2),
      "utf-8",
    );
  }

  addBullet(
    bullet: Omit<AceBullet, "id" | "helpful_count" | "harmful_count">,
  ): string {
    const id = `ctx-${Math.random().toString(36).substring(2, 10)}`;
    const newBullet: AceBullet = {
      ...bullet,
      id,
      helpful_count: 0,
      harmful_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.playbook.bullets.push(newBullet);
    return id;
  }

  getBullets(section?: AceBullet["section"]): AceBullet[] {
    if (!section) return this.playbook.bullets;
    return this.playbook.bullets.filter((b) => b.section === section);
  }

  /**
   * Removes bullets that have a high harmful_count or are becoming stale.
   * This maintains context efficiency.
   */
  async prune(harmfulThreshold: number = 3): Promise<number> {
    const originalCount = this.playbook.bullets.length;
    this.playbook.bullets = this.playbook.bullets.filter(
      (b) => b.harmful_count < harmfulThreshold,
    );
    await this.save();
    return originalCount - this.playbook.bullets.length;
  }

  /**
   * Returns bullets sorted by their helpfulness score.
   */
  getRankedBullets(section?: AceBullet["section"]): AceBullet[] {
    const filtered = this.getBullets(section);
    return filtered.sort((a, b) => b.helpful_count - a.helpful_count);
  }

  /**
   * Simple deduplication based on exact content (semantic deduplication planned)
   */
  async deduplicate(): Promise<number> {
    const seen = new Set<string>();
    const originalCount = this.playbook.bullets.length;
    this.playbook.bullets = this.playbook.bullets.filter((b) => {
      if (seen.has(b.content)) return false;
      seen.add(b.content);
      return true;
    });
    return originalCount - this.playbook.bullets.length;
  }
}
