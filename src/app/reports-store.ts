import { EMPTY_REPORT, isReportData } from "./connection-types";
import { createRemoteStore } from "./remote-store";

// Live operations report (admin only), refreshed while the reports page is open
const store = createRemoteStore("/api/reports", EMPTY_REPORT, isReportData);

export const getReportSnapshot = store.getSnapshot;
export const getReportServerSnapshot = store.getServerSnapshot;
export const subscribeReport = store.subscribe;

/** Admin closes a connection the office never disconnected. */
export async function closeConnection(id: string): Promise<boolean> {
  try {
    const ok = (await fetch(`/api/connections/${id}/leave`, { method: "POST" })).ok;
    await store.refresh();
    return ok;
  } catch {
    return false;
  }
}
