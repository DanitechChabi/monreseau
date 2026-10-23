import { handleAdminCertificates } from "../_shared/handlers/certificates.ts";
import { createDeps } from "../_shared/runtime.ts";

const deps = createDeps();
Deno.serve((req) => handleAdminCertificates(req, deps));
