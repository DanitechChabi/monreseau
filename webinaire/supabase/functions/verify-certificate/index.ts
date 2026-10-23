import { handleVerifyCertificate } from "../_shared/handlers/verify.ts";
import { createDeps } from "../_shared/runtime.ts";

const deps = createDeps();
Deno.serve((req) => handleVerifyCertificate(req, deps));
