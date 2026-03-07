import { core } from "../system/app_runtime_core.ts";
import { paths } from "../system/path_registry.ts";

if (!core.config.project.name) {
  throw new Error("project.name is required");
}

if (!paths.dataRoot || !paths.logsRoot || !paths.verificationRoot) {
  throw new Error("core runtime paths are incomplete");
}

console.log(
  JSON.stringify(
    {
      project: core.config.project.name,
      dataRoot: paths.dataRoot,
      logsRoot: paths.logsRoot,
      verificationRoot: paths.verificationRoot,
    },
    null,
    2,
  ),
);
