export type AttendanceStatus = "present" | "absent";
export type CertificateStatus = "eligible" | "issued" | "sent" | "revoked";

export type CertificateRecord = {
  id: string;
  public_code: string;
  registration_id: string;
  holder_name: string;
  status: CertificateStatus;
  revoked_reason: string | null;
  file_path: string | null;
  event_date: string | null;
  issued_at: string | null;
  sent_at: string | null;
  send_attempts: number;
  last_error: string | null;
};

export type RegistrationLite = { id: string; event_id: string; email: string; full_name: string; status: string };

/** Accès aux présences, attestations, fichiers PDF et journal d'audit (clé service_role). */
export interface CertRepo {
  listRegistrations(eventId: string): Promise<RegistrationLite[]>;
  getRegistration(id: string): Promise<RegistrationLite | null>;
  setAttendance(entry: {
    registrationId: string;
    status: AttendanceStatus;
    minutes: number | null;
    source: "manual" | "csv";
    validatedBy: string;
  }): Promise<void>;
  getAttendanceStatus(registrationId: string): Promise<AttendanceStatus | null>;
  certificateByRegistration(registrationId: string): Promise<CertificateRecord | null>;
  certificateById(id: string): Promise<CertificateRecord | null>;
  certificateByCode(code: string): Promise<CertificateRecord | null>;
  /** Échoue (renvoie null) si le numéro public existe déjà. */
  insertCertificate(c: { registrationId: string; holderName: string; publicCode: string }): Promise<CertificateRecord | null>;
  deleteCertificate(id: string): Promise<void>;
  updateCertificate(id: string, patch: Partial<Omit<CertificateRecord, "id" | "registration_id" | "public_code">>): Promise<void>;
  listCertificates(status: CertificateStatus, limit: number): Promise<CertificateRecord[]>;
  countCertificates(status: CertificateStatus): Promise<number>;
  putPdf(path: string, bytes: Uint8Array, overwrite: boolean): Promise<void>;
  getPdf(path: string): Promise<Uint8Array>;
  signedUrl(path: string, seconds: number): Promise<string>;
  audit(action: string, admin: string, target: string | null, details: Record<string, unknown>): Promise<void>;
}
