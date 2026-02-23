import { z } from "zod";

const ModelEntrySchema = z.object({
  id: z.string().min(1),
  vendor: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  tags: z.array(z.string()),
  context7LibraryId: z.string(),
  github: z.string(),
  arxiv: z.string(),
});

const ModelRegistrySchema = z.object({
  version: z.string().min(1),
  updatedAt: z.string().min(1),
  models: z.array(ModelEntrySchema),
});

const ModelReferenceSchema = z.object({
  id: z.string().min(1),
  vendor: z.string().min(1),
  name: z.string().min(1),
  context7LibraryId: z.string(),
  github: z.string().url(),
  arxiv: z.string().url(),
});

export type ModelRegistry = z.infer<typeof ModelRegistrySchema>;
export type ModelReference = z.infer<typeof ModelReferenceSchema>;

export async function loadModelRegistry(): Promise<ModelRegistry> {
  const path = new URL("./models.json", import.meta.url);
  const raw = await Bun.file(path).json();
  return ModelRegistrySchema.parse(raw);
}

export async function loadForecastModelReferences(): Promise<
  readonly ModelReference[]
> {
  const registry = await loadModelRegistry();
  return registry.models
    .map((model) => ({
      id: model.id,
      vendor: model.vendor,
      name: model.name,
      context7LibraryId: model.context7LibraryId,
      github: model.github,
      arxiv: model.arxiv,
    }))
    .filter((model) => model.github.length > 0 && model.arxiv.length > 0)
    .map((model) => ModelReferenceSchema.parse(model));
}

export async function getTSModels(): Promise<
  readonly ModelRegistry["models"][number][]
> {
  const registry = await loadModelRegistry();
  return registry.models.filter(
    (model) => model.category === "time-series-forecasting",
  );
}
