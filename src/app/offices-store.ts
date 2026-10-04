import { defaultOfficeLists, type OfficeLists } from "./gov-offices";
import { createRemoteStore } from "./remote-store";

const isStringList = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");

function isOfficeLists(value: unknown): value is OfficeLists {
  if (!value || typeof value !== "object") return false;
  const lists = value as Record<string, unknown>;
  return isStringList(lists.ministries) && isStringList(lists.divisions) && isStringList(lists.agencies) && isStringList(lists.partners);
}

const store = createRemoteStore("/api/offices", defaultOfficeLists, isOfficeLists);

export const getOfficesSnapshot = store.getSnapshot;
export const getOfficesServerSnapshot = store.getServerSnapshot;
export const subscribeOffices = store.subscribe;
