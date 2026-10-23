import { type AdminRow, COUNTRY_LABEL, formatDateTime, lastEmailLabel, STATUS_LABEL } from "./client";

/** Cellule CSV : guillemets échappés, et neutralisation des formules (=, +, -, @). */
function cell(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** CSV au format attendu par Excel en français (séparateur « ; », BOM UTF-8). */
export function toCsv(rows: AdminRow[]): string {
  const header = [
    "Nom et prénom", "E-mail", "Organisation", "Fonction", "Pays", "Téléphone", "Statut",
    "Confirmée le", "Accepte les communications", "Inscrit le", "Dernier envoi", "Dernier envoi le",
  ];
  const lines = rows.map((r) =>
    [
      r.full_name, r.email, r.organisation, r.job_title, COUNTRY_LABEL[r.country], r.phone ?? "",
      STATUS_LABEL[r.status], formatDateTime(r.email_confirmed_at), r.marketing_consent ? "oui" : "non",
      formatDateTime(r.created_at), lastEmailLabel(r), formatDateTime(r.last_email_at),
    ].map(cell).join(";"),
  );
  return "﻿" + [header.map(cell).join(";"), ...lines].join("\r\n");
}

export function downloadCsv(rows: AdminRow[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `inscrits-webinaire-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
