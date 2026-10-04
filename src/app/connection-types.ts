// Shared by the connection/report API routes and the pages - no runtime imports beyond bn-utils
import { toBn } from "./bn-utils";

/** One office's time in a meeting: from clicking the join link to clicking disconnect. */
export type ConnectionRecord = { id: string; eventTitle: string; office: string; name: string; joinedAt: number; leftAt: number | null; durationSec: number | null };

export type ReportRow = {
  title: string;
  date: string;
  owner: string;
  partner: string;
  /** "connected / invited" offices */
  endpoints: string;
  success: string;
  status: string;
  tone: string;
  /** Total connection time across all offices */
  duration: string;
  avgDuration: string;
  activeNow: number;
  note: string;
  connections: ConnectionRecord[];
};

export type ReportSummary = { totalSessions: string; avgSuccess: string; participants: string; avgDuration: string; activeNow: string };

export type ReportData = { rows: ReportRow[]; summary: ReportSummary; generatedAt: number };

export const EMPTY_REPORT: ReportData = {
  rows: [],
  summary: { totalSessions: "০", avgSuccess: "—", participants: "০", avgDuration: "—", activeNow: "০" },
  generatedAt: 0,
};

export function isReportData(value: unknown): value is ReportData {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return Array.isArray(data.rows) && !!data.summary && typeof data.summary === "object" && typeof data.generatedAt === "number";
}

/** "২ ঘ. ৫ মি.", "১২ মি. ৩০ সে." or "৪৫ সে." */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) return `${toBn(hours)} ঘ. ${toBn(minutes)} মি.`;
  if (minutes > 0) return `${toBn(minutes)} মি.${rest ? ` ${toBn(rest)} সে.` : ""}`;
  return `${toBn(rest)} সে.`;
}

/** Running timer text: "০০:১২:৩৪" */
export function formatClockDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const pad = (value: number) => String(value).padStart(2, "0");
  return toBn(`${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`);
}
