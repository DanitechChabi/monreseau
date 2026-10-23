import { handleConfirm } from "../_shared/handlers/confirm.ts";
import { createDeps } from "../_shared/runtime.ts";

const deps = createDeps();
Deno.serve((req) => handleConfirm(req, deps));
