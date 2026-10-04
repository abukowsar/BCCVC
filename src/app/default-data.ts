// Starting data for the boards. Kept free of runtime imports so the
// database seed script (scripts/seed-db.mjs) can load it directly with Node.
import type { EventItem } from "./events-store";
import type { PublishedTrialSnapshot } from "./trial-store";
import type { WaitingEntry } from "./waiting-store";

export const initialEvents: EventItem[] = [
  { title: "জেলা প্রশাসক সমন্বয় সভা", date: "আজ, ১১:০০", owner: "মন্ত্রিপরিষদ বিভাগ", count: "৬৪ প্রান্ত", status: "লাইভ", tone: "live", webrtcLink: "" },
  { title: "ডিজিটাল সেবা পর্যালোচনা", date: "আজ, ১৫:৩০", owner: "আইসিটি বিভাগ", count: "৩২ প্রান্ত", status: "নির্ধারিত", tone: "scheduled", webrtcLink: "" },
  { title: "উপজেলা নির্বাহী অফিসার ব্রিফিং", date: "১৮ সেপ্টেম্বর, ১০:০০", owner: "জনপ্রশাসন মন্ত্রণালয়", count: "৪৯ প্রান্ত", status: "খসড়া", tone: "draft", webrtcLink: "" },
  { title: "স্মার্ট বাংলাদেশ টাস্কফোর্স", date: "১৯ সেপ্টেম্বর, ১৪:০০", owner: "বাংলাদেশ কম্পিউটার কাউন্সিল", count: "১৮ প্রান্ত", status: "নির্ধারিত", tone: "scheduled", webrtcLink: "" },
];

export const defaultWaitingList: WaitingEntry[] = [
  { type: "বিভাগীয় অফিস", place: "খুলনা", time: "11:15" },
  { type: "জেলা অফিস", place: "ফেনী", time: "11:05" },
  { type: "উপজেলা অফিস", place: "রায়পুর", time: "11:10" },
];

export const defaultTrialSnapshot: PublishedTrialSnapshot = {
  scopeLabel: "সব প্রান্ত",
  entries: [
    { name: "জেলা প্রশাসকের কার্যালয়, ঢাকা", audio: "ok", video: "ok" },
    { name: "জেলা প্রশাসকের কার্যালয়, চট্টগ্রাম", audio: "ok", video: "ok" },
    { name: "উপজেলা নির্বাহী অফিসারের কার্যালয়, রায়পুর", audio: "ok", video: "ok" },
    { name: "জেলা প্রশাসকের কার্যালয়, রাজশাহী", audio: "ok", video: "ok" },
    { name: "উপজেলা নির্বাহী অফিসারের কার্যালয়, উজিরপুর", audio: "issue", video: "pending" },
    { name: "জেলা প্রশাসকের কার্যালয়, সিলেট", audio: "ok", video: "ok" },
    { name: "জেলা প্রশাসকের কার্যালয়, খুলনা", audio: "ok", video: "ok" },
    { name: "উপজেলা নির্বাহী অফিসারের কার্যালয়, রংপুর", audio: "ok", video: "ok" },
  ],
};
