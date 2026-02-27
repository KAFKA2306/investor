# Style and Conventions

## Language and Modules
- TypeScript on Bun
- ESM modules (`"type": "module"`)

## Formatting and Linting
- Biome is the source of truth.
- Indentation: 2 spaces (`indentStyle: space`, `indentWidth: 2`).
- Imports are organized via Biome assist action.
- `noExplicitAny` is enforced as error.

## Typing
- `@tsconfig/strictest` with strict type checking.
- Avoid `any`; prefer precise domain types and Zod-backed schemas.

## Naming and File Organization
- Keep descriptive domain-oriented names.
- Experiment scripts commonly use `snake_case` file names.
- Align new files with existing module boundaries (agents/core/gateways/schemas/pipeline).

## Change Discipline
- Keep commits focused.
- Separate behavior changes from refactors where practical.
- Use Conventional Commits (`feat`, `fix`, `docs`, `refactor`, `chore`).