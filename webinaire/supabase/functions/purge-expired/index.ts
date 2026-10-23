import { handlePurgeExpired } from "../_shared/handlers/admin.ts";
import { createDeps } from "../_shared/runtime.ts";

const deps = createDeps();
Deno.serve((req) => handlePurgeExpired(req, deps));
