import { validateQlibFormulaSkill } from "./builtin/validate_qlib_formula.ts";
import { mixseekCompetitiveFrameworkSkill } from "./builtin/mixseek_competitive_framework.ts";
import { skillRegistry } from "./registry.ts";

skillRegistry.register(validateQlibFormulaSkill);
skillRegistry.register(mixseekCompetitiveFrameworkSkill);
