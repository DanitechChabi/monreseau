import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { knownSecretValues, scanDir, scanText } from "../scripts/scan-secrets.ts";

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const fakeJwt = (role: string) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ iss: "supabase", role, exp: 9999999999 })}.c2lnbmF0dXJlLWZhY3RpY2U`;

describe("détecteur de secrets", () => {
  it("repère une clé service_role, une clé Resend et une clé sb_secret, ignore la clé anon", () => {
    expect(scanText(`const k="${fakeJwt("service_role")}"`)).toEqual(["JWT service_role"]);
    expect(scanText(`const k="${fakeJwt("anon")}"`)).toEqual([]);
    expect(scanText('x="re_AbCdEf123_GhIjKl456Mn"')).toContain("clé API Resend (re_)");
    expect(scanText('x="sb_secret_abcdefghijklmnop"')).toContain("clé secrète Supabase (sb_secret_)");
    expect(scanText("aucune clé ici", ["valeur-secrete-123"])).toEqual([]);
    expect(scanText("fuite: valeur-secrete-123", ["valeur-secrete-123"])).toEqual(["valeur d'une variable secrète"]);
  });
});

describe("build front (dist/)", () => {
  it.runIf(existsSync("dist"))("ne contient aucune clé secrète", () => {
    expect(scanDir("dist", knownSecretValues("."))).toEqual([]);
  });
  it("le build existe (npm run test lance la compilation avant les tests)", () => {
    expect(existsSync("dist/index.html")).toBe(true);
  });
});
