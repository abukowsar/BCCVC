import "server-only";
import type { ObjectId } from "mongodb";
import { fromBn, toBn } from "@/app/bn-utils";
import { formatDuration, type ConnectionRecord, type ReportData, type ReportRow } from "@/app/connection-types";
import type { EventItem } from "@/app/events-store";
import { COLLECTIONS } from "./db-schema";
import { getDb, readList } from "./mongodb";

export type ConnectionDoc = { _id?: ObjectId; id: string; eventTitle: string; office: string; name: string; joinedAt: Date; leftAt: Date | null; durationSec: number | null };

export async function getConnectionsCollection() {
  return (await getDb()).collection<ConnectionDoc>(COLLECTIONS.connections);
}

const MAX_CONNECTIONS_PER_ROW = 200;

const toRecord = (doc: ConnectionDoc): ConnectionRecord => ({
  id: doc.id, eventTitle: doc.eventTitle, office: doc.office, name: doc.name,
  joinedAt: doc.joinedAt.getTime(), leftAt: doc.leftAt ? doc.leftAt.getTime() : null, durationSec: doc.durationSec,
});

const invitedCount = (count: string) => fromBn(count.replace(/[^০-৯0-9]/g, "") || "0");
const percent = (value: number) => `${toBn(value.toFixed(1).replace(/\.0$/, ""))}%`;

/** Builds the operations report from the events and connections collections. */
export async function buildReport(): Promise<ReportData> {
  const [events, connections] = await Promise.all([
    readList<EventItem>(COLLECTIONS.events),
    (await getConnectionsCollection()).find({}).sort({ joinedAt: -1 }).limit(20000).toArray(),
  ]);
  const now = Date.now();
  // Open connections count their time up to now
  const secondsOf = (doc: ConnectionDoc) => doc.leftAt ? doc.durationSec ?? 0 : (now - doc.joinedAt.getTime()) / 1000;

  const byEvent = new Map<string, ConnectionDoc[]>();
  for (const doc of connections) byEvent.set(doc.eventTitle, [...(byEvent.get(doc.eventTitle) ?? []), doc]);

  const successRates: number[] = [];
  let participants = 0;
  let activeNow = 0;
  const closedDurations: number[] = [];

  const rows: ReportRow[] = events.map((event) => {
    const list = byEvent.get(event.title) ?? [];
    const offices = new Set(list.map((doc) => doc.office));
    const invited = invitedCount(event.count);
    const active = list.filter((doc) => !doc.leftAt).length;
    const totalSeconds = list.reduce((sum, doc) => sum + secondsOf(doc), 0);
    const successRate = invited > 0 ? Math.min(100, (offices.size / invited) * 100) : null;
    if (successRate !== null && list.length > 0) successRates.push(successRate);
    participants += offices.size;
    activeNow += active;
    for (const doc of list) if (doc.leftAt && doc.durationSec !== null) closedDurations.push(doc.durationSec);

    const tone = event.tone === "live" ? "live" : successRate !== null && list.length > 0 && successRate < 90 ? "warning" : "done";
    const note = list.length === 0 ? "এখনো কোনো প্রান্ত WebRTC লিংকে যুক্ত হয়নি।"
      : `${toBn(offices.size)}টি প্রান্ত মোট ${toBn(list.length)} বার যুক্ত হয়েছে${active > 0 ? `, এখন ${toBn(active)}টি সংযুক্ত আছে` : ""}।${invited > offices.size ? ` ${toBn(invited - offices.size)}টি আমন্ত্রিত প্রান্ত এখনো যুক্ত হয়নি।` : ""}`;

    return {
      title: event.title,
      date: event.date,
      owner: event.owner,
      partner: event.partner ?? "",
      endpoints: `${toBn(offices.size)} / ${toBn(invited)}`,
      success: successRate === null ? "—" : percent(successRate),
      status: event.status,
      tone,
      duration: list.length ? formatDuration(totalSeconds) : "—",
      avgDuration: list.length ? formatDuration(totalSeconds / list.length) : "—",
      activeNow: active,
      note,
      connections: list.slice(0, MAX_CONNECTIONS_PER_ROW).map(toRecord),
    };
  });

  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    rows,
    summary: {
      totalSessions: toBn(rows.length),
      avgSuccess: successRates.length ? percent(average(successRates)) : "—",
      participants: toBn(participants),
      avgDuration: closedDurations.length ? formatDuration(average(closedDurations)) : "—",
      activeNow: toBn(activeNow),
    },
    generatedAt: now,
  };
}
