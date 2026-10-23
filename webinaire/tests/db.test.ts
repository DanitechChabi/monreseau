/**
 * Tests de la base : RLS, contraintes et fonctions SQL.
 * Nécessite DATABASE_URL (Supabase local ou scripts/test-db-local.sh) ; ignorés sinon.
 */
import pg from "pg";
import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it } from "vitest";

const url = process.env.DATABASE_URL;
const EVENT = "maitrise-information-2026";
const ADMIN = "admin@archivexa.example";
const HASH = (c: string) => c.repeat(64).slice(0, 64);

describe.skipIf(!url)("base de données", () => {
  let client: pg.Client;

  beforeAll(async () => {
    client = new pg.Client({ connectionString: url });
    await client.connect();
  });
  afterAll(async () => {
    await client?.end();
  });
  // Chaque test s'exécute dans une transaction annulée à la fin.
  beforeEach(async () => {
    await client.query("begin");
    await client.query("insert into public.admins (email) values ($1) on conflict do nothing", [ADMIN]);
  });
  afterEach(async () => {
    await client.query("rollback");
  });

  const as = async (role: "anon" | "authenticated" | "service_role", email?: string) => {
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify(email ? { role, email } : { role }),
    ]);
    await client.query(`set local role ${role}`);
  };
  const asSuperuser = () => client.query("reset role");
  const savepoint = async <T>(fn: () => Promise<T>): Promise<T> => {
    await client.query("savepoint sp");
    try {
      const r = await fn();
      await client.query("release savepoint sp");
      return r;
    } catch (e) {
      await client.query("rollback to savepoint sp");
      throw e;
    }
  };
  const register = async (email: string, name = "Awa Diallo") => {
    const { rows } = await client.query(
      "select * from public.register_participant($1,$2,$3,'Mairie','Archiviste','BJ',null,false)",
      [EVENT, name, email],
    );
    return rows[0] as { id: string; created: boolean; status: string; email: string };
  };

  it("crée une inscription puis refuse le doublon (même adresse, casse différente)", async () => {
    await as("service_role");
    const first = await register("awa@example.org");
    const second = await register("  AWA@Example.org ");
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.id).toBe(first.id);
    const { rows } = await client.query("select count(*)::int as n from public.registrations where email = 'awa@example.org'");
    expect(rows[0].n).toBe(1);
  });

  it("rejette une adresse invalide ou non normalisée au niveau de la table", async () => {
    await asSuperuser();
    for (const email of ["pas-une-adresse", "Majuscule@example.org", "a@b"]) {
      await expect(
        savepoint(() =>
          client.query(
            "insert into public.registrations (event_id, full_name, email, organisation, job_title, country) values ($1,'Awa Diallo',$2,'X','Y','BJ')",
            [EVENT, email],
          ),
        ),
      ).rejects.toThrow(/check constraint/);
    }
  });

  it("visiteur anonyme : aucune lecture des données, aucune fonction interne", async () => {
    await as("service_role");
    await register("awa@example.org");
    await as("anon");
    for (const sql of [
      "select * from public.registrations",
      "select * from public.admin_registrations",
      "select * from public.email_log",
      "select * from public.confirmation_tokens",
      "select * from public.event_settings",
      "select * from public.admins",
      "select public.rate_limit_hit('k','a',60,1)",
      `select * from public.register_participant('${EVENT}','Awa Diallo','x@example.org','M','A','BJ',null,false)`,
      `select public.confirm_registration('${HASH("a")}')`,
      "select public.purge_expired_data(1)",
    ]) {
      await expect(savepoint(() => client.query(sql)), sql).rejects.toThrow(/permission denied/);
    }
  });

  it("réglages publics : date et contact visibles, jamais le lien de participation", async () => {
    await asSuperuser();
    await client.query(
      "update public.event_settings set event_date='2026-12-03', event_time='10:00', join_url='https://meet.example/abc', contact_email='contact@example.org' where event_id=$1",
      [EVENT],
    );
    await as("anon");
    const { rows } = await client.query("select public.get_public_event_settings($1) as s", [EVENT]);
    expect(rows[0].s).toEqual({ date: "2026-12-03", time: "10:00", qaDurationMinutes: null, contactEmail: "contact@example.org" });
    expect(JSON.stringify(rows[0].s)).not.toContain("meet.example");
  });

  it("utilisateur connecté non administrateur : accès refusé par la RLS", async () => {
    await as("service_role");
    await register("awa@example.org");
    await as("authenticated", "intrus@example.org");
    expect((await client.query("select public.is_admin() as a")).rows[0].a).toBe(false);
    expect((await client.query("select * from public.registrations")).rowCount).toBe(0);
    expect((await client.query("select * from public.admin_registrations")).rowCount).toBe(0);
    expect((await client.query("select * from public.email_log")).rowCount).toBe(0);
    const upd = await client.query("update public.event_settings set event_date='2030-01-01' where event_id=$1", [EVENT]);
    expect(upd.rowCount).toBe(0);
    await expect(savepoint(() => client.query("select * from public.confirmation_tokens"))).rejects.toThrow(/permission denied/);
    await expect(
      savepoint(() =>
        client.query("insert into public.admins (email) values ('intrus@example.org')"),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("administrateur : lit les inscrits et le dernier envoi, modifie les réglages", async () => {
    await as("service_role");
    const r = await register("awa@example.org");
    await client.query("insert into public.email_log (registration_id, type, status) values ($1,'confirmation','failed')", [r.id]);
    await client.query("insert into public.email_log (registration_id, type, status) values ($1,'confirmation','sent')", [r.id]);
    await as("authenticated", ADMIN.toUpperCase());
    expect((await client.query("select public.is_admin() as a")).rows[0].a).toBe(true);
    const { rows } = await client.query("select email, last_email_status from public.admin_registrations");
    expect(rows).toEqual([{ email: "awa@example.org", last_email_status: "sent" }]);
    const upd = await client.query(
      "update public.event_settings set event_date='2026-12-03', event_time='10:00' where event_id=$1 returning updated_by",
      [EVENT],
    );
    expect(upd.rows[0].updated_by).toBe(ADMIN.toUpperCase());
    // Les administrateurs ne peuvent ni créer ni supprimer d'inscription depuis le navigateur.
    await expect(savepoint(() => client.query("delete from public.registrations"))).rejects.toThrow(/permission denied/);
  });

  it("confirmation : jeton valide, réutilisé, expiré, inconnu, remplacé", async () => {
    await as("service_role");
    const r = await register("awa@example.org");
    const confirm = async (h: string) => (await client.query("select public.confirm_registration($1) as s", [h])).rows[0].s;

    await client.query("select public.issue_confirmation_token($1,$2, now() + interval '48 hours')", [r.id, HASH("a")]);
    // Un nouveau jeton invalide le précédent.
    await client.query("select public.issue_confirmation_token($1,$2, now() + interval '48 hours')", [r.id, HASH("b")]);
    expect(await confirm(HASH("a"))).toBe("invalid");
    expect(await confirm(HASH("f"))).toBe("invalid");

    expect(await confirm(HASH("b"))).toBe("ok");
    const { rows } = await client.query("select status, email_confirmed_at from public.registrations where id=$1", [r.id]);
    expect(rows[0].status).toBe("confirmed");
    expect(rows[0].email_confirmed_at).not.toBeNull();
    expect(await confirm(HASH("b"))).toBe("invalid"); // réutilisation

    const r2 = await register("bio@example.org", "Bio Sanni");
    await client.query("select public.issue_confirmation_token($1,$2, now() - interval '1 minute')", [r2.id, HASH("c")]);
    expect(await confirm(HASH("c"))).toBe("expired");
    expect((await client.query("select status from public.registrations where id=$1", [r2.id])).rows[0].status).toBe(
      "pending_confirmation",
    );
  });

  it("limitation de débit : plafond par fenêtre, remise à zéro ensuite", async () => {
    await as("service_role");
    const hit = async () => (await client.query("select public.rate_limit_hit('cle','resend_daily',3600,2) as ok")).rows[0].ok;
    expect([await hit(), await hit(), await hit()]).toEqual([true, true, false]);
    await asSuperuser();
    await client.query("update public.rate_limits set window_start = now() - interval '2 hours' where key='cle'");
    await as("service_role");
    expect(await hit()).toBe(true);
  });

  it("annonce : seuls les confirmés n'ayant pas reçu cette version", async () => {
    await as("service_role");
    const a = await register("a@example.org", "Ali Issa");
    const b = await register("b@example.org", "Bea Koffi");
    await register("c@example.org", "Cyr Hounsou"); // reste en attente
    await client.query("update public.registrations set status='confirmed' where id in ($1,$2)", [a.id, b.id]);
    await client.query("insert into public.email_log (registration_id,type,reference,status) values ($1,'event_details','v1','sent')", [a.id]);
    await client.query("insert into public.email_log (registration_id,type,reference,status) values ($1,'event_details','v1','failed')", [b.id]);
    const { rows } = await client.query("select email from public.confirmed_missing_email($1,'event_details','v1')", [EVENT]);
    expect(rows.map((r) => r.email)).toEqual(["b@example.org"]);
  });

  it("purge : supprime les inscriptions plus anciennes que la durée de conservation", async () => {
    await as("service_role");
    const old = await register("vieux@example.org", "Ancien Inscrit");
    await register("recent@example.org", "Nouvel Inscrit");
    await asSuperuser();
    await client.query("update public.registrations set created_at = now() - interval '13 months' where id=$1", [old.id]);
    await as("service_role");
    expect((await client.query("select public.purge_expired_data(12) as n")).rows[0].n).toBe(1);
    expect((await client.query("select email from public.registrations")).rows.map((r) => r.email)).toEqual(["recent@example.org"]);
  });

  it("présences et attestations : aucune lecture publique, lecture réservée aux admins, contraintes", async () => {
    await as("service_role");
    const r = await register("awa@example.org");
    await client.query("insert into public.attendance (registration_id, status, minutes, source, validated_by) values ($1,'present',52,'csv',$2)", [r.id, ADMIN]);
    await client.query("insert into public.certificates (registration_id, holder_name, public_code) values ($1,'Awa Diallo','AXD-7K2P-9QWM')", [r.id]);
    await client.query("insert into public.audit_log (action, admin, target) values ('attendance.set', $1, $2)", [ADMIN, r.id]);

    await as("anon");
    for (const t of ["attendance", "certificates", "audit_log", "admin_attendance"]) {
      await expect(savepoint(() => client.query(`select * from public.${t}`)), t).rejects.toThrow(/permission denied/);
    }
    await as("authenticated", "intrus@example.org");
    for (const t of ["attendance", "certificates", "audit_log", "admin_attendance"]) {
      expect((await client.query(`select * from public.${t}`)).rowCount, t).toBe(0);
    }
    await expect(savepoint(() => client.query("update public.certificates set status='issued'"))).rejects.toThrow(/permission denied/);

    await as("authenticated", ADMIN);
    const { rows } = await client.query("select full_name, attendance_status, minutes, public_code, certificate_status from public.admin_attendance");
    expect(rows).toEqual([{ full_name: "Awa Diallo", attendance_status: "present", minutes: 52, public_code: "AXD-7K2P-9QWM", certificate_status: "eligible" }]);

    await as("service_role");
    // Révocation sans motif, émission sans fichier, numéro mal formé : refusés.
    await expect(savepoint(() => client.query("update public.certificates set status='revoked'"))).rejects.toThrow(/check constraint/);
    await expect(savepoint(() => client.query("update public.certificates set status='issued'"))).rejects.toThrow(/check constraint/);
    const r2 = await register("bio@example.org", "Bio Sanni");
    await expect(
      savepoint(() => client.query("insert into public.certificates (registration_id, holder_name, public_code) values ($1,'Bio Sanni','AXD-0001')", [r2.id])),
    ).rejects.toThrow(/check constraint/);
    // Une seule attestation par inscription.
    await expect(
      savepoint(() => client.query("insert into public.certificates (registration_id, holder_name, public_code) values ($1,'Awa Diallo','AXD-2345-6789')", [r.id])),
    ).rejects.toThrow(/duplicate key/);
    // Le journal d'envoi accepte le type « certificate ».
    await client.query("insert into public.email_log (registration_id, type, status) values ($1,'certificate','sent')", [r.id]);
  });
});
