import { createRemoteStore } from "./remote-store";

export function isWebrtcLink(value: unknown): value is string {
  return typeof value === "string" && value.length <= 2000;
}

const store = createRemoteStore("/api/store/webrtc", "", isWebrtcLink);

export const getWebrtcLinkSnapshot = store.getSnapshot;
export const getWebrtcLinkServerSnapshot = store.getServerSnapshot;
export const subscribeWebrtcLink = store.subscribe;

export function publishWebrtcLink(link: string) {
  void store.set(link);
}
