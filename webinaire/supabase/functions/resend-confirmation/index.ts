import { handleResendConfirmation } from "../_shared/handlers/resend-confirmation.ts";
import { createDeps } from "../_shared/runtime.ts";

const deps = createDeps();
Deno.serve((req) => handleResendConfirmation(req, deps));
