/**
 * Accès au backend Supabase depuis le navigateur.
 * Seules l'URL du projet et la clé anon (publique) sont utilisées ici : toute
 * clé secrète reste dans les secrets des Edge Functions.
 */
import type { EventSettings } from "../config/event";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, "") ?? "";
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "";

/** Faux tant que les variables VITE_ ne sont pas renseignées : le formulaire reste fermé. */
export const backendConfigured = Boolean(url && anonKey);
export const supabaseUrl = url;
export const supabaseAnonKey = anonKey;

export type FunctionResponse<T = Record<string, unknown>> = { httpStatus: number; data: T | null };

/** Appelle une Edge Function. `httpStatus: 0` = réseau indisponible. */
export async function callFunction<T = Record<string, unknown>>(
  name: string,
  body: unknown,
  accessToken?: string,
): Promise<FunctionResponse<T>> {
  try {
    const res = await fetch(`${url}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${accessToken ?? anonKey}`,
      },
      body: JSON.stringify(body),
    });
    let data: T | null = null;
    try {
      data = (await res.json()) as T;
    } catch {
      /* réponse sans JSON */
    }
    return { httpStatus: res.status, data };
  } catch {
    return { httpStatus: 0, data: null };
  }
}

/** Réglages publics (date, heure, durée Q&R, contact) saisis dans /admin. */
export async function fetchPublicSettings(eventId: string): Promise<Partial<EventSettings> | null> {
  if (!backendConfigured) return null;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/get_public_event_settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ p_event_id: eventId }),
    });
    if (!res.ok) return null;
    return (await res.json()) as Partial<EventSettings> | null;
  } catch {
    return null;
  }
}
