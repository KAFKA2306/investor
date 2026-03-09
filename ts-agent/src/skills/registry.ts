import type { Skill } from "./types.ts";

class SkillRegistry {
  private readonly skills = new Map<string, Skill<unknown, unknown>>();

  register(skill: Skill<unknown, unknown>): void {
    this.skills.set(skill.name, skill);
  }

  getSkill(name: string): Skill<unknown, unknown> | undefined {
    return this.skills.get(name);
  }

  listSkills(): { name: string; description: string }[] {
    return Array.from(this.skills.values()).map(({ name, description }) => ({
      name,
      description,
    }));
  }
}

export const skillRegistry = new SkillRegistry();
