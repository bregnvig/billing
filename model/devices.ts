/** `devices/{id}`: a machine allowed to report hook events. Managed via Cloud Functions only. */
export interface Device {
  id: string;
  name: string;
  createdAt: Date;
  lastSeenAt: Date | null;
  /** Set when revoked; the device's token no longer works. */
  revokedAt: Date | null;
}
