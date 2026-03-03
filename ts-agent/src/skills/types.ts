import { z } from "zod";

/**
 * 💡 スキルの入力を定義するメタデータの型だよ！
 */
export interface SkillSchema {
  input: z.ZodObject<any>;
  description: string;
}

/**
 * 🚀 エージェントが実行できる「スキル」のインターフェースだよっ！
 */
export interface Skill<T = any, R = any> {
  name: string;
  description: string;
  schema: z.ZodObject<any>;
  execute(args: T): Promise<R>;
}

/**
 * 📂 スキルを管理するためのレジストリのインターフェースだよ！
 */
export interface ISkillRegistry {
  register(skill: Skill): void;
  getSkill(name: string): Skill | undefined;
  listSkills(): Skill[];
  searchSkills(query: string): Skill[];
}
