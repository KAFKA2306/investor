import type { ISkillRegistry, Skill } from "./types.ts";

/**
 * 🏰 スキルたちの家だよっ！シングルトンで管理するね✨
 */
export class SkillRegistry implements ISkillRegistry {
  private static instance: SkillRegistry;
  private skills: Map<string, Skill> = new Map();

  private constructor() {}

  public static getInstance(): SkillRegistry {
    if (!SkillRegistry.instance) {
      SkillRegistry.instance = new SkillRegistry();
    }
    return SkillRegistry.instance;
  }

  public register(skill: Skill): void {
    if (this.skills.has(skill.name)) {
      console.warn(`⚠️ Skill already registered: ${skill.name}. Overwriting...`);
    }
    this.skills.set(skill.name, skill);
  }

  public getSkill(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  public listSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  public searchSkills(query: string): Skill[] {
    const q = query.toLowerCase();
    return this.listSkills().filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q),
    );
  }
}

export const skillRegistry = SkillRegistry.getInstance();
