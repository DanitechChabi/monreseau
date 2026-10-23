import { handleRegister } from "../_shared/handlers/register.ts";
import { createDeps } from "../_shared/runtime.ts";

const deps = createDeps();
Deno.serve((req) => handleRegister(req, deps));
