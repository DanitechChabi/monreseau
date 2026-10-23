/**
 * Envoi via l'API Resend. Utilisé uniquement côté serveur (Edge Functions).
 * Ne lève jamais d'exception : renvoie un résultat explicite.
 */

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Évite les doublons si la même requête est rejouée (double clic, nouvelle tentative). */
  idempotencyKey: string;
  tags?: { name: string; value: string }[];
};

export type SendResult = { ok: true; id: string } | { ok: false; code: string };

export interface Mailer {
  send(email: OutgoingEmail): Promise<SendResult>;
  /** Jusqu'à 100 messages en un appel. Tout le lot réussit ou échoue. */
  sendBatch(emails: OutgoingEmail[], idempotencyKey: string): Promise<{ ok: true; ids: string[] } | { ok: false; code: string }>;
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export class ResendMailer implements Mailer {
  constructor(
    private readonly opts: { apiKey: string | null; from: string | null; replyTo: string | null },
    private readonly fetchImpl: FetchLike = (i, init) => fetch(i, init),
    private readonly baseUrl = "https://api.resend.com",
  ) {}

  private payload(e: OutgoingEmail) {
    return {
      from: this.opts.from,
      to: [e.to],
      subject: e.subject,
      html: e.html,
      text: e.text,
      ...(this.opts.replyTo ? { reply_to: this.opts.replyTo } : {}),
      ...(e.tags ? { tags: e.tags } : {}),
    };
  }

  private async post(path: string, body: unknown, idempotencyKey: string): Promise<{ ok: true; data: unknown } | { ok: false; code: string }> {
    if (!this.opts.apiKey || !this.opts.from) return { ok: false, code: "not_configured" };
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.opts.apiKey}`,
          "Content-Type": "application/json",
          // Resend limite les clés d'idempotence à 256 caractères.
          "Idempotency-Key": idempotencyKey.slice(0, 256),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      return { ok: false, code: err instanceof Error && err.name === "TimeoutError" ? "timeout" : "network_error" };
    }
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      /* corps vide ou non JSON */
    }
    if (!res.ok) {
      const name = data && typeof data === "object" && "name" in data ? String((data as { name: unknown }).name) : "";
      return { ok: false, code: (name || `http_${res.status}`).slice(0, 64) };
    }
    return { ok: true, data };
  }

  async send(e: OutgoingEmail): Promise<SendResult> {
    const r = await this.post("/emails", this.payload(e), e.idempotencyKey);
    if (!r.ok) return r;
    const id = (r.data as { id?: unknown } | null)?.id;
    return typeof id === "string" ? { ok: true, id } : { ok: false, code: "invalid_response" };
  }

  async sendBatch(emails: OutgoingEmail[], idempotencyKey: string) {
    const r = await this.post("/emails/batch", emails.map((e) => this.payload(e)), idempotencyKey);
    if (!r.ok) return r;
    const list = (r.data as { data?: { id?: unknown }[] } | null)?.data;
    if (!Array.isArray(list) || list.length !== emails.length) return { ok: false as const, code: "invalid_response" };
    return { ok: true as const, ids: list.map((x) => String(x.id ?? "")) };
  }
}
