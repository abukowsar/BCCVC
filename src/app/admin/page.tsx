"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { bdDivisions, bdDistricts, bdGeoTree, bdOfficeRoster, bdUpazilas } from "../bd-geo";
import { fromBn, toBn } from "../bn-utils";
import { defaultWaitingList, getWaitingListServerSnapshot, getWaitingListSnapshot, publishWaitingList, subscribeWaitingList } from "../waiting-store";
import { describeTrialEntry, EMPTY_TRIAL_SCOPE, getTrialScopeServerSnapshot, getTrialScopeSnapshot, getTrialServerSnapshot, getTrialSnapshot, publishTrialResults, saveTrialScope, subscribeTrialResults, subscribeTrialScope, type TrialScope } from "../trial-store";
import { getWebrtcLinkServerSnapshot, getWebrtcLinkSnapshot, publishWebrtcLink, subscribeWebrtcLink } from "../webrtc-store";
import { deleteNote, getNotesServerSnapshot, getNotesSnapshot, publishNote, subscribeNotes } from "../note-store";
import { formatSupportTime, getSupportServerSnapshot, getSupportSnapshot, resolveSupportMessage, subscribeSupportMessages, submitSupportMessage, type SupportMessage } from "../support-store";
import { formatDuration, type ReportRow, type ReportSummary } from "../connection-types";
import { closeConnection, getReportServerSnapshot, getReportSnapshot, subscribeReport } from "../reports-store";
import { deleteEvent, EVENT_STATUSES, getEventsServerSnapshot, getEventsSnapshot, replaceEvent, setEventStatus, subscribeEvents, updateEvents, type EventItem } from "../events-store";
import { partnerOffices } from "../gov-offices";
import { getOfficesServerSnapshot, getOfficesSnapshot, subscribeOffices } from "../offices-store";
import { useSessionUser } from "./session-context";
import { canManageTeam, manageableRoles, roleLabel, ROLES, type Role, type TeamMember } from "./session-types";

type View = "overview" | "coverage" | "events" | "reports" | "settings" | "trial-board" | "public-board" | "help-center";
const bnMonths = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
const formatEventDateTime = (dateStr: string, timeStr: string) => {
  const [, month, day] = dateStr.split("-").map(Number);
  return `${toBn(day)} ${bnMonths[month - 1]}, ${toBn(timeStr)}`;
};
const coverage = [
  ["ঢাকা", "১৩", "৫৮", "online"], ["চট্টগ্রাম", "১১", "৪৭", "online"], ["রাজশাহী", "৯", "৩৯", "online"],
  ["খুলনা", "১০", "৪৪", "online"], ["বরিশাল", "৬", "৪২", "warning"], ["সিলেট", "৪", "৪০", "online"],
  ["রংপুর", "৮", "৫৮", "online"], ["ময়মনসিংহ", "৪", "৩৪", "warning"], ["কক্সবাজার", "১", "৮", "offline"],
];

const emptyEventForm = { title: "", date: "", time: "", trialDate: "", trialTime: "", owner: "", partner: partnerOffices[0] };

export default function Home() {
  const router = useRouter();
  const user = useSessionUser();
  const [view, setView] = useState<View>("overview");
  const [query, setQuery] = useState("");
  const openSupportCount = useSyncExternalStore(subscribeSupportMessages, getSupportSnapshot, getSupportServerSnapshot).filter((message) => message.status === "open").length;
  const events = useSyncExternalStore(subscribeEvents, getEventsSnapshot, getEventsServerSnapshot);
  const [eventModal, setEventModal] = useState(false);
  const [eventForm, setEventForm] = useState(emptyEventForm);
  const [eventFormError, setEventFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const filteredCoverage = useMemo(() => coverage.filter(([name]) => name.includes(query)), [query]);
  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };
  const goTo = (next: View) => { setView(next); setNavOpen(false); };
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.replace("/login");
    router.refresh();
  };
  const closeEventModal = () => { setEventModal(false); setEventForm(emptyEventForm); setEventFormError(""); };
  const createEvent = () => {
    if (!eventForm.title.trim() || !eventForm.date || !eventForm.time || !eventForm.owner) { setEventFormError("সভার নাম, তারিখ, সময় ও আয়োজক দপ্তর আবশ্যক"); return; }
    if (events.some((event) => event.title === eventForm.title.trim())) { setEventFormError("এই নামে একটি ইভেন্ট আগে থেকেই আছে"); return; }
    if (Boolean(eventForm.trialDate) !== Boolean(eventForm.trialTime)) { setEventFormError("ট্রায়ালের তারিখ ও সময় দুটোই দিন, অথবা দুটোই খালি রাখুন"); return; }
    updateEvents((current) => [{ title: eventForm.title.trim(), date: formatEventDateTime(eventForm.date, eventForm.time), owner: eventForm.owner, partner: eventForm.partner, ...(eventForm.trialDate ? { trialDate: formatEventDateTime(eventForm.trialDate, eventForm.trialTime) } : {}), count: "০ প্রান্ত", status: "নির্ধারিত", tone: "scheduled", webrtcLink: "" }, ...current]);
    closeEventModal();
    flash("ইভেন্টটি সফলভাবে তৈরি হয়েছে");
  };
  const updateEventLink = (title: string, webrtcLink: string) => {
    updateEvents((current) => current.map((event) => event.title === title ? { ...event, webrtcLink } : event));
    publishWebrtcLink(webrtcLink.trim());
  };

  return <main className="app-shell">
    {navOpen && <div className="sidebar-backdrop" role="presentation" onClick={() => setNavOpen(false)} />}
    <aside className={`sidebar${navOpen ? " open" : ""}`}>
      <button className="sidebar-close" aria-label="মেনু বন্ধ করুন" onClick={() => setNavOpen(false)}>×</button>
      <div className="brand-mark"><span>বিসিসি</span><strong>VC</strong></div><div className="brand-copy"><strong>ভিডিও কনফারেন্সিং</strong><span>অপারেশন সেন্টার</span></div>
      <div className="side-label">প্রধান মেনু</div><nav className="side-nav" aria-label="প্রধান মেনু">
        <button className={view === "overview" ? "active" : ""} onClick={() => goTo("overview")}><span>⌂</span> ড্যাশবোর্ড</button>
        <button className={view === "coverage" ? "active" : ""} onClick={() => goTo("coverage")}><span>⌘</span> জেলা ও উপজেলা</button>
        <button className={view === "events" ? "active" : ""} onClick={() => goTo("events")}><span>▣</span> সভা ও ইভেন্ট</button>
        <button className={view === "reports" ? "active" : ""} onClick={() => goTo("reports")}><span>▤</span> রিপোর্ট</button>
      </nav>
      <div className="side-label">সহায়তা</div><nav className="side-nav">
        <button className={view === "help-center" ? "active" : ""} onClick={() => goTo("help-center")}><span>?</span> সহায়তা কেন্দ্র{openSupportCount > 0 && <span className="nav-badge">{toBn(openSupportCount)}</span>}</button><button className={view === "settings" ? "active" : ""} onClick={() => goTo("settings")}><span>⚙</span> সেটিংস</button>
      </nav>
      <div className="side-footer"><span className="online-dot" /> সিস্টেম সচল <small>সর্বশেষ সিঙ্ক ২ মিনিট আগে</small></div>
    </aside>
    <section className="workspace">
      <header className="topbar"><button className="nav-toggle" aria-label="মেনু খুলুন" onClick={() => setNavOpen(true)}>☰</button><div><div className="breadcrumb">হোম <span>/</span> {view === "coverage" ? "জেলা ও উপজেলা" : view === "events" ? "সভা ও ইভেন্ট" : view === "reports" ? "রিপোর্ট" : view === "settings" ? "সেটিংস" : view === "public-board" ? "পাবলিক মনিটর" : view === "help-center" ? "সহায়তা কেন্দ্র" : view === "trial-board" ? "ট্রায়াল বোর্ড" : "ড্যাশবোর্ড"}</div><h1>{view === "coverage" ? "জেলা ও উপজেলা কভারেজ" : view === "events" ? "ভার্চুয়াল ইভেন্ট ম্যানেজমেন্ট" : view === "reports" ? "অপারেশন রিপোর্ট" : view === "settings" ? "সিস্টেম সেটিংস" : view === "public-board" ? "পাবলিক মনিটরিং বোর্ড" : view === "help-center" ? "সহায়তা কেন্দ্র" : view === "trial-board" ? "সংযোগ ট্রায়াল" : "শুভ সকাল, অপারেটর"}</h1></div><div className="top-actions"><button className="icon-button" aria-label="বিজ্ঞপ্তি" onClick={() => flash("আপনার কোনো নতুন বিজ্ঞপ্তি নেই")}>♢<i /></button><div className="profile"><span className="avatar">{user.name[0]}</span><span><b>{user.name}</b><small>{roleLabel(user.role)}</small></span><span className="chevron">⌄</span></div><button className="logout-button" onClick={logout}>লগআউট</button></div></header>
      {view === "overview" && <Overview events={events} onNavigate={goTo} onNotify={flash} />}
      {view === "coverage" && <Coverage query={query} setQuery={setQuery} rows={filteredCoverage} onNotify={flash} />}
      {view === "events" && <Events events={events} onCreate={() => setEventModal(true)} onNotify={flash} onTrialBoard={() => goTo("trial-board")} onPublicBoard={() => router.push("/event/VC-2026-0911-A")} onUpdateLink={updateEventLink} />}
      {view === "trial-board" && <><TrialBoard onBack={() => goTo("events")} onNotify={flash} /><WaitingManager onNotify={flash} /></>}
      {view === "reports" && <Reports onNotify={flash} />}
      {view === "settings" && <Settings onNotify={flash} />}
      {view === "public-board" && <PublicBoard onBack={() => goTo("events")} />}
      {view === "help-center" && <HelpCenter onNotify={flash} />}
    </section>
    {eventModal && <div className="modal-backdrop" role="presentation" onClick={closeEventModal}><div className="modal" role="dialog" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={closeEventModal}>×</button><span className="eyebrow">নতুন ইভেন্ট</span><h2>ভার্চুয়াল সভা তৈরি করুন</h2><p>প্রয়োজনীয় তথ্য দিয়ে জেলা ও উপজেলা প্রান্তগুলো আমন্ত্রণ জানান।</p><label>সভার নাম<input value={eventForm.title} onChange={(event) => setEventForm({ ...eventForm, title: event.target.value })} placeholder="যেমন: মাসিক সমন্বয় সভা" /></label><div className="form-row"><label>তারিখ<input type="date" value={eventForm.date} onChange={(event) => setEventForm({ ...eventForm, date: event.target.value })} /></label><label>সময়<input type="time" value={eventForm.time} onChange={(event) => setEventForm({ ...eventForm, time: event.target.value })} /></label></div><div className="form-row"><label>ট্রায়াল তারিখ (ঐচ্ছিক)<input type="date" value={eventForm.trialDate} onChange={(event) => setEventForm({ ...eventForm, trialDate: event.target.value })} /></label><label>ট্রায়াল সময়<input type="time" value={eventForm.trialTime} onChange={(event) => setEventForm({ ...eventForm, trialTime: event.target.value })} /></label></div><EventOfficeFields owner={eventForm.owner} partner={eventForm.partner} onChange={(change) => setEventForm({ ...eventForm, ...change })} />{eventFormError && <p className="form-error">{eventFormError}</p>}<button className="primary wide" onClick={createEvent}>ইভেন্ট তৈরি করুন <span>→</span></button></div></div>}
    {notice && <div className="toast">{notice}</div>}
  </main>;
}

// Organizer and partner choices come from the MongoDB `offices` collection (loaded only while the form is open)
function EventOfficeFields({ owner, partner, onChange }: { owner: string; partner: string; onChange: (change: { owner?: string; partner?: string }) => void }) {
  const offices = useSyncExternalStore(subscribeOffices, getOfficesSnapshot, getOfficesServerSnapshot);
  const groups: [string, string[]][] = [["মন্ত্রণালয়", offices.ministries], ["বিভাগ", offices.divisions], ["দপ্তর ও সংস্থা", offices.agencies]];
  return <>
    <label>আয়োজক দপ্তর<select value={owner} onChange={(event) => onChange({ owner: event.target.value })}><option value="" disabled>মন্ত্রণালয় / বিভাগ / দপ্তর নির্বাচন করুন</option>{groups.filter(([, names]) => names.length > 0).map(([label, names]) => <optgroup key={label} label={label}>{names.map((name) => <option key={name}>{name}</option>)}</optgroup>)}</select></label>
    <label>সহযোগী দপ্তর<select value={partner} onChange={(event) => onChange({ partner: event.target.value })}>{offices.partners.map((name) => <option key={name}>{name}</option>)}</select></label>
  </>;
}

function Overview({ events, onNavigate, onNotify }: { events: EventItem[]; onNavigate: (view: View) => void; onNotify: (message: string) => void }) {
  const activeCount = 541, warningCount = 3, offlineCount = 3;
  const divisionValues = coverage.map(([division, districts, upazilas, status]) => ({ division, status, value: fromBn(districts) + fromBn(upazilas) }));
  const maxDivisionValue = Math.max(...divisionValues.map((row) => row.value));
  return <><section className="welcome-row"><div><span className="eyebrow">শনিবার, ১২ সেপ্টেম্বর ২০২৬</span><p>আজকের কনফারেন্সিং কার্যক্রমের সারসংক্ষেপ দেখুন।</p></div><button className="primary" onClick={() => onNavigate("events")}>+ নতুন সভা তৈরি করুন</button></section>
    <section className="stat-grid"><Stat title="মোট সংযুক্ত প্রান্ত" value="৫৫৯" detail="৬৪ জেলা · ৪৯৫ উপজেলা" icon="⌁" /><Stat title="সক্রিয় প্রান্ত" value="৫৪১" detail="৯৬.৮% আপটাইম" icon="◉" green /><Stat title="আজকের ইভেন্ট" value="১২" detail="৩টি লাইভ · ৯টি নির্ধারিত" icon="▣" /><Stat title="মনোযোগ প্রয়োজন" value="০৬" detail="৩টি অফলাইন · ৩টি সতর্কতা" icon="!" alert /></section>
    <div className="content-grid chart-grid"><section className="panel chart-panel"><div className="panel-heading"><div><span className="eyebrow">নেটওয়ার্ক ওভারভিউ</span><h2>বিভাগভিত্তিক সংযুক্ত প্রান্ত</h2></div></div><div className="chart-bars">{divisionValues.map((row) => <div className="chart-bar-row" key={row.division} title={`${row.division}: ${toBn(row.value)} প্রান্ত`}><span className="chart-bar-label"><i className={`status-dot ${row.status}`} />{row.division}</span><span className="chart-bar-track"><span className="chart-bar-fill" style={{ width: `${(row.value / maxDivisionValue) * 100}%` }} /></span><b className="chart-bar-value">{toBn(row.value)}</b></div>)}</div></section><section className="panel chart-panel"><div className="panel-heading"><div><span className="eyebrow">সার্বিক অবস্থা</span><h2>প্রান্তের স্বাস্থ্য</h2></div></div><div className="status-stack" title={`সক্রিয় ${toBn(activeCount)} · সতর্কতা ${toBn(warningCount)} · অফলাইন ${toBn(offlineCount)}`}><span className="status-stack-seg online" style={{ flexGrow: activeCount, minWidth: "6px" }} /><span className="status-stack-seg warning" style={{ flexGrow: warningCount, minWidth: "6px" }} /><span className="status-stack-seg offline" style={{ flexGrow: offlineCount, minWidth: "6px" }} /></div><div className="status-legend"><span><i className="status-dot online" /> সক্রিয় <b>{toBn(activeCount)}</b></span><span><i className="status-dot warning" /> সতর্কতা <b>{toBn(warningCount)}</b></span><span><i className="status-dot offline" /> অফলাইন <b>{toBn(offlineCount)}</b></span></div></section></div>
    <div className="content-grid"><section className="panel live-panel"><div className="panel-heading"><div><span className="eyebrow">রিয়েল-টাইম মনিটর</span><h2>লাইভ সংযোগ পরীক্ষা</h2></div><span className="live-tag"><i /> লাইভ</span></div><div className="live-event"><div className="event-icon">◉</div><div><h3>জেলা প্রশাসক সমন্বয় সভা</h3><p>মন্ত্রিপরিষদ বিভাগ · সেশন VC-2026-0911-A</p></div><strong>০৩:১৮</strong></div><div className="progress-label"><span>পরীক্ষা সম্পন্ন</span><b>৪৮ / ৬৪ প্রান্ত</b></div><div className="progress"><i style={{ width: "75%" }} /></div><div className="live-foot"><span><i className="green-dot" /> ৪৮ সম্পন্ন</span><span><i className="amber-dot" /> ০১ পরীক্ষা চলছে</span><span><i className="muted-dot" /> ১৫ অপেক্ষমাণ</span></div><button className="text-button" onClick={() => onNavigate("events")}>সম্পূর্ণ বোর্ড দেখুন <span>→</span></button></section><section className="panel attention-panel"><div className="panel-heading"><div><span className="eyebrow">অপারেটর ইনবক্স</span><h2>মনোযোগ প্রয়োজন</h2></div><button className="more-button" onClick={() => onNotify("সব সতর্কতা দেখানো হচ্ছে")}>···</button></div><Attention name="বরিশাল বিভাগ" detail="উজিরপুর উপজেলা · সংযোগ দুর্বল" action="দেখুন" onClick={() => onNotify("বরিশাল বিভাগের বিস্তারিত খোলা হয়েছে")} warning /><Attention name="কক্সবাজার জেলা" detail="জেলা প্রশাসকের কার্যালয় · অফলাইন" action="সমাধান" onClick={() => onNotify("কক্সবাজারের জন্য টেকনিক্যাল টিকিট তৈরি হয়েছে")} /><Attention name="ময়মনসিংহ বিভাগ" detail="নেত্রকোনা উপজেলা · ক্যামেরা পরীক্ষা" action="কিউতে" onClick={() => onNotify("নেত্রকোনা কিউতে যোগ হয়েছে")} warning /></section></div>
    <div className="content-grid bottom-grid"><section className="panel"><div className="panel-heading"><div><span className="eyebrow">সভার সময়সূচি</span><h2>আসন্ন ইভেন্ট</h2></div><button className="link-button" onClick={() => onNavigate("events")}>সব দেখুন →</button></div>{events.slice(0, 3).map((event) => <div className="event-row" key={event.title}><div className="date-box"><b>{event.date.split(",")[0]}</b><small>{event.date.includes(",") ? event.date.split(",")[1] : "সেপ্টেম্বর"}</small></div><div><b>{event.title}</b><p>{event.owner}</p></div><span className={`status-pill ${event.tone}`}>{event.status}</span><span className="event-count">{event.count}</span></div>)}</section><section className="panel quick-panel"><span className="eyebrow">দ্রুত কাজ</span><h2>কী করতে চান?</h2><button onClick={() => onNavigate("coverage")}><span>⌘</span><div><b>প্রান্ত খুঁজুন</b><small>জেলা ও উপজেলা কভারেজ দেখুন</small></div>→</button><button onClick={() => onNavigate("events")}><span>▣</span><div><b>সভা নির্ধারণ করুন</b><small>নতুন ভার্চুয়াল ইভেন্ট তৈরি</small></div>→</button></section></div></>;
}

function Attention({ name, detail, action, onClick, warning = false }: { name: string; detail: string; action: string; onClick: () => void; warning?: boolean }) { return <div className="attention-item"><span className={`status-icon ${warning ? "warning" : "offline"}`}>{warning ? "!" : "×"}</span><div><b>{name}</b><p>{detail}</p></div><button onClick={onClick}>{action}</button></div>; }
function Stat({ title, value, detail, icon, green, alert }: { title: string; value: string; detail: string; icon: string; green?: boolean; alert?: boolean }) { return <div className="stat-card"><div className={`stat-icon ${green ? "green" : alert ? "alert" : ""}`}>{icon}</div><span>{title}</span><strong>{value}</strong><small>{detail}</small></div>; }

function Coverage({ query, setQuery, rows, onNotify }: { query: string; setQuery: (value: string) => void; rows: string[][]; onNotify: (message: string) => void }) { return <section className="full-section"><div className="section-intro"><div><span className="eyebrow">নেটওয়ার্ক ডিরেক্টরি</span><h2>দেশের সব প্রান্ত এক নজরে</h2><p>জেলা এবং উপজেলা পর্যায়ের ভিডিও কনফারেন্সিং প্রান্তের অবস্থা, সংযোগ ও কভারেজ পরীক্ষা করুন।</p></div><button className="secondary" onClick={() => onNotify("কভারেজ রিপোর্ট তৈরি হচ্ছে")}>↓ রিপোর্ট ডাউনলোড</button></div><div className="coverage-summary"><div><b>৬৪</b><span>জেলা</span></div><div><b>৪৯৫</b><span>উপজেলা</span></div><div><b>৫৪১</b><span>অনলাইন প্রান্ত</span></div><div><b>৯৬.৮%</b><span>সিস্টেম আপটাইম</span></div></div><div className="panel directory-panel"><div className="directory-tools"><h3>বিভাগভিত্তিক তালিকা</h3><label className="search-box">⌕<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="বিভাগ খুঁজুন..." /></label><button className="filter-button">ফিল্টার ˅</button></div><div className="directory-head"><span>বিভাগ</span><span>জেলা</span><span>উপজেলা</span><span>সিস্টেম অবস্থা</span><span>কভারেজ</span><span /></div>{rows.map(([name, district, upazila, status]) => <div className="directory-row" key={name}><b>{name}</b><span>{district}</span><span>{upazila}</span><span><i className={`status-dot ${status}`} />{status === "online" ? "সব সচল" : status === "warning" ? "পর্যবেক্ষণ" : "অফলাইন"}</span><div className="mini-bar"><i style={{ width: status === "online" ? "96%" : status === "warning" ? "82%" : "41%" }} /></div><button onClick={() => onNotify(`${name} বিভাগের বিস্তারিত খোলা হয়েছে`)}>বিস্তারিত →</button></div>)}</div></section>; }

function Events({ events, onCreate, onNotify, onTrialBoard, onPublicBoard, onUpdateLink }: { events: EventItem[]; onCreate: () => void; onNotify: (message: string) => void; onTrialBoard: () => void; onPublicBoard: () => void; onUpdateLink: (title: string, webrtcLink: string) => void }) {
  const [tab, setTab] = useState<"all" | "live" | "scheduled" | "draft">("all");
  const [search, setSearch] = useState("");
  const [detailsTitle, setDetailsTitle] = useState<string | null>(null);
  const detailsEvent = detailsTitle === null ? undefined : events.find((event) => event.title === detailsTitle);
  const tabs: { key: "all" | "live" | "scheduled" | "draft"; label: string; count: number }[] = [
    { key: "all", label: "সব ইভেন্ট", count: events.length },
    { key: "live", label: "লাইভ", count: events.filter((event) => event.tone === "live").length },
    { key: "scheduled", label: "নির্ধারিত", count: events.filter((event) => event.tone === "scheduled").length },
    { key: "draft", label: "খসড়া", count: events.filter((event) => event.tone === "draft").length },
  ];
  const visible = events.filter((event) => (tab === "all" || event.tone === tab) && event.title.includes(search));
  return <section className="full-section"><div className="section-intro"><div><span className="eyebrow">ইভেন্ট ক্যালেন্ডার</span><h2>ভার্চুয়াল সভা পরিচালনা</h2><p>সভার সময়সূচি, আমন্ত্রিত প্রান্ত এবং লাইভ সংযোগ পরীক্ষা এক জায়গা থেকে পরিচালনা করুন।</p></div><button className="primary" onClick={onCreate}>+ নতুন ইভেন্ট</button></div><div className="event-tabs">{tabs.map((item) => <button key={item.key} className={tab === item.key ? "selected" : ""} onClick={() => setTab(item.key)}>{item.label} <b>{toBn(item.count)}</b></button>)}<label className="search-box">⌕<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ইভেন্ট খুঁজুন..." /></label></div><div className="event-list">{visible.length === 0 && <p className="empty-state">এই তালিকায় কোনো ইভেন্ট পাওয়া যায়নি।</p>}{visible.map((event) => <div className="event-card" key={event.title}><div className="calendar-icon"><b>{event.date.split(",")[0].split(" ")[0]}</b><small>সেপ্টে</small></div><div className="event-card-main"><div className="event-card-top"><select className={`status-pill status-select ${event.tone}`} aria-label="ইভেন্টের অবস্থা" value={event.tone} onChange={(change) => { setEventStatus(event.title, change.target.value); onNotify(change.target.value === "live" ? `"${event.title}" এখন হোম পেজে লাইভ দেখাচ্ছে` : "ইভেন্টের অবস্থা পরিবর্তন হয়েছে"); }}>{EVENT_STATUSES.map((item) => <option key={item.tone} value={item.tone}>{item.label}</option>)}</select><span>{event.date}</span></div><h3>{event.title}</h3><p>{event.owner}{event.partner && <> · সহযোগী: {event.partner}</>}</p><div className="event-meta"><span>◉ {event.count}</span>{event.trialDate && <span>⚑ ট্রায়াল: {event.trialDate}</span>}<span>◷ ৪৫ মিনিট</span><span>⌁ রেকর্ডিং চালু</span></div></div><input className="webrtc-input" value={event.webrtcLink} onChange={(change) => onUpdateLink(event.title, change.target.value)} placeholder="WebRTC লিংক" /><button className="secondary small" onClick={onTrialBoard}>ট্রায়াল বোর্ড</button>{event.tone === "live" && <button className="primary small" onClick={onPublicBoard}>বোর্ড খুলুন →</button>}<button className="secondary small event-details-button" onClick={() => setDetailsTitle(event.title)}>বিস্তারিত →</button></div>)}</div>{detailsEvent && <EventDetails event={detailsEvent} otherTitles={events.filter((item) => item !== detailsEvent).map((item) => item.title)} onClose={() => setDetailsTitle(null)} onRenamed={setDetailsTitle} onNotify={onNotify} onTrialBoard={onTrialBoard} onPublicBoard={onPublicBoard} onUpdateLink={onUpdateLink} />}</section>;
}

const endpointCount = (count: string) => fromBn(count.replace(/[^০-৯0-9]/g, "") || "0");

function EventDetails({ event, otherTitles, onClose, onRenamed, onNotify, onTrialBoard, onPublicBoard, onUpdateLink }: { event: EventItem; otherTitles: string[]; onClose: () => void; onRenamed: (title: string) => void; onNotify: (message: string) => void; onTrialBoard: () => void; onPublicBoard: () => void; onUpdateLink: (title: string, webrtcLink: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: "", date: "", time: "", trialDate: "", trialTime: "", clearTrial: false, owner: "", partner: "", endpoints: "" });
  const [error, setError] = useState("");

  const startEdit = () => { setForm({ title: event.title, date: "", time: "", trialDate: "", trialTime: "", clearTrial: false, owner: event.owner, partner: event.partner ?? partnerOffices[0], endpoints: String(endpointCount(event.count)) }); setError(""); setEditing(true); };
  const save = () => {
    const title = form.title.trim();
    const endpoints = Number(form.endpoints);
    if (!title || !form.owner) { setError("সভার নাম ও আয়োজক দপ্তর আবশ্যক"); return; }
    if (otherTitles.includes(title)) { setError("এই নামে একটি ইভেন্ট আগে থেকেই আছে"); return; }
    if (!Number.isInteger(endpoints) || endpoints < 0 || endpoints > 100000) { setError("প্রান্ত সংখ্যা সঠিক নয়"); return; }
    if (Boolean(form.date) !== Boolean(form.time)) { setError("নতুন সময় দিতে তারিখ ও সময় দুটোই দিন"); return; }
    if (Boolean(form.trialDate) !== Boolean(form.trialTime)) { setError("নতুন ট্রায়াল সময় দিতে তারিখ ও সময় দুটোই দিন"); return; }
    const date = form.date ? formatEventDateTime(form.date, form.time) : event.date;
    const trialDate = form.trialDate ? formatEventDateTime(form.trialDate, form.trialTime) : form.clearTrial ? undefined : event.trialDate;
    const next: EventItem = { ...event, title, date, owner: form.owner, partner: form.partner, count: `${toBn(endpoints)} প্রান্ত` };
    if (trialDate) next.trialDate = trialDate; else delete next.trialDate;
    replaceEvent(event.title, next);
    onRenamed(title);
    setEditing(false);
    onNotify("ইভেন্টের তথ্য হালনাগাদ হয়েছে");
  };
  const remove = () => {
    if (!window.confirm(`"${event.title}" ইভেন্টটি মুছে ফেলবেন?`)) return;
    deleteEvent(event.title);
    onClose();
    onNotify("ইভেন্টটি মুছে ফেলা হয়েছে");
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(event.webrtcLink);
      onNotify("যোগদানের লিংক কপি হয়েছে");
    } catch {
      onNotify("লিংক কপি করা যায়নি");
    }
  };
  const changeStatus = (tone: string) => {
    setEventStatus(event.title, tone);
    onNotify(tone === "live" ? "ইভেন্টটি এখন হোম পেজে লাইভ দেখাচ্ছে" : "ইভেন্টের অবস্থা পরিবর্তন হয়েছে");
  };

  return <div className="modal-backdrop" role="presentation" onClick={onClose}><div className="modal event-details-modal" role="dialog" aria-label="ইভেন্ট বিস্তারিত" onClick={(click) => click.stopPropagation()}>
    <button className="modal-close" onClick={onClose}>×</button>
    <span className="eyebrow">{editing ? "ইভেন্ট সম্পাদনা" : "ইভেন্ট বিস্তারিত"}</span>
    {editing ? <>
      <label>সভার নাম<input value={form.title} onChange={(change) => setForm({ ...form, title: change.target.value })} /></label>
      <div className="form-row"><label>নতুন তারিখ<input type="date" value={form.date} onChange={(change) => setForm({ ...form, date: change.target.value })} /></label><label>নতুন সময়<input type="time" value={form.time} onChange={(change) => setForm({ ...form, time: change.target.value })} /></label></div>
      <small className="muted-note">বর্তমান সময়: {event.date} — পরিবর্তন না করলে খালি রাখুন</small>
      <div className="form-row"><label>ট্রায়াল তারিখ<input type="date" value={form.trialDate} onChange={(change) => setForm({ ...form, trialDate: change.target.value, clearTrial: false })} /></label><label>ট্রায়াল সময়<input type="time" value={form.trialTime} onChange={(change) => setForm({ ...form, trialTime: change.target.value, clearTrial: false })} /></label></div>
      <small className="muted-note">{form.clearTrial ? "ট্রায়াল সময় মুছে ফেলা হবে" : <>বর্তমান ট্রায়াল: {event.trialDate ?? "নির্ধারিত হয়নি"} — পরিবর্তন না করলে খালি রাখুন</>}{event.trialDate && !form.trialDate && <> · <button type="button" className="inline-link" onClick={() => setForm({ ...form, clearTrial: !form.clearTrial })}>{form.clearTrial ? "রেখে দিন" : "ট্রায়াল মুছুন"}</button></>}</small>
      <EventOfficeFields owner={form.owner} partner={form.partner} onChange={(change) => setForm({ ...form, ...change })} />
      <label>আমন্ত্রিত প্রান্ত সংখ্যা<input type="number" min="0" value={form.endpoints} onChange={(change) => setForm({ ...form, endpoints: change.target.value })} /></label>
      {error && <p className="form-error">{error}</p>}
      <div className="event-detail-actions"><button className="primary small" onClick={save}>সংরক্ষণ করুন</button><button className="secondary small" onClick={() => setEditing(false)}>বাতিল</button></div>
    </> : <>
      <h2>{event.title}</h2>
      <div className="event-detail-status"><span>অবস্থা</span><select className={`status-pill status-select ${event.tone}`} aria-label="ইভেন্টের অবস্থা" value={event.tone} onChange={(change) => changeStatus(change.target.value)}>{EVENT_STATUSES.map((item) => <option key={item.tone} value={item.tone}>{item.label}</option>)}</select></div>
      <div className="report-detail-grid"><div><span>তারিখ ও সময়</span><b>{event.date}</b></div><div><span>ট্রায়াল তারিখ ও সময়</span><b>{event.trialDate ?? "নির্ধারিত হয়নি"}</b></div><div><span>আমন্ত্রিত প্রান্ত</span><b>{event.count}</b></div><div><span>আয়োজক দপ্তর</span><b className="event-detail-office">{event.owner}</b></div><div><span>সহযোগী দপ্তর</span><b className="event-detail-office">{event.partner || "—"}</b></div></div>
      <label className="event-detail-link">যোগদানের লিংক (WebRTC)<input value={event.webrtcLink} onChange={(change) => onUpdateLink(event.title, change.target.value)} placeholder="https://..." /></label>
      {event.webrtcLink && <div className="event-detail-actions"><button className="text-button" onClick={copyLink}>⧉ লিংক কপি করুন</button><a className="text-button" href={event.webrtcLink} target="_blank" rel="noopener noreferrer">↗ মিটিংয়ে যোগ দিন</a></div>}
      <div className="event-detail-actions event-detail-footer">
        <button className="primary small" onClick={startEdit}>✎ সম্পাদনা</button>
        <button className="secondary small" onClick={() => { onClose(); onTrialBoard(); }}>ট্রায়াল বোর্ড</button>
        {event.tone === "live" && <button className="secondary small" onClick={onPublicBoard}>পাবলিক বোর্ড →</button>}
        <button className="text-button danger" onClick={remove}>মুছে ফেলুন</button>
      </div>
    </>}
  </div></div>;
}

const officeTypes = ["বিভাগীয় অফিস", "জেলা অফিস", "উপজেলা অফিস", "নির্ধারিত অফিস"];
const placeOptionsFor = (type: string) => type === "বিভাগীয় অফিস" ? bdDivisions : type === "জেলা অফিস" ? bdDistricts : type === "উপজেলা অফিস" ? bdUpazilas : null;

function PlaceField({ type, place, onChange }: { type: string; place: string; onChange: (value: string) => void }) {
  const options = placeOptionsFor(type);
  if (!options) return <input value={place} onChange={(event) => onChange(event.target.value)} placeholder="স্থানের নাম লিখুন" />;
  return <select value={options.includes(place) ? place : ""} onChange={(event) => onChange(event.target.value)}>
    <option value="" disabled>নির্বাচন করুন</option>
    {options.map((option) => <option key={option} value={option}>{option}</option>)}
  </select>;
}

function WaitingManager({ onNotify }: { onNotify: (message: string) => void }) {
  const [items, setItems] = useState(defaultWaitingList.map((entry): string[] => [entry.type, entry.place, entry.time]));
  const [adding, setAdding] = useState(false);
  const [newPlace, setNewPlace] = useState("");
  const [newType, setNewType] = useState("নির্ধারিত অফিস");
  const [newTime, setNewTime] = useState("");
  const move = (index: number, direction: -1 | 1) => { const next = index + direction; if (next < 0 || next >= items.length) return; const copy = [...items]; [copy[index], copy[next]] = [copy[next], copy[index]]; setItems(copy); };
  const addItem = () => {
    if (!newPlace.trim() || !newTime) return;
    setItems([...items, [newType, newPlace.trim(), newTime]]);
    onNotify("অপেক্ষমাণ তালিকায় প্রান্ত যোগ হয়েছে");
    setNewPlace(""); setNewType("নির্ধারিত অফিস"); setNewTime(""); setAdding(false);
  };
  return <section className="full-section waiting-manager"><div className="panel"><div className="directory-tools"><div><span className="eyebrow">ADMIN QUEUE</span><h3>অপেক্ষমাণ তালিকা পরিচালনা</h3><small className="report-subtitle">Public event page-এ প্রকাশের আগে serial ও office type ঠিক করুন</small></div><button className="primary small" onClick={() => setAdding(true)}>+ প্রান্ত যোগ করুন</button></div><div className="waiting-admin-head"><span>ক্রম</span><span>অফিসের ধরন</span><span>স্থান</span><span>সময়</span><span>অ্যাকশন</span></div>{adding && <div className="waiting-admin-row waiting-admin-new"><b>নতুন</b><select value={newType} onChange={(event) => { setNewType(event.target.value); setNewPlace(""); }}>{officeTypes.map((type) => <option key={type}>{type}</option>)}</select><PlaceField type={newType} place={newPlace} onChange={setNewPlace} /><input type="time" value={newTime} onChange={(event) => setNewTime(event.target.value)} /><div><button className="queue-action" onClick={addItem}>যোগ করুন</button><button className="queue-action remove" onClick={() => { setAdding(false); setNewPlace(""); }}>বাতিল</button></div></div>}{items.map(([type, place, time], index) => <div className="waiting-admin-row" key={`${type}-${place}`}><b>{String(index + 1).padStart(2, "0")}</b><select value={type} onChange={(event) => setItems(items.map((item, itemIndex) => itemIndex === index ? [event.target.value, "", time] : item))}>{officeTypes.map((officeType) => <option key={officeType}>{officeType}</option>)}</select><PlaceField type={type} place={place} onChange={(value) => setItems(items.map((item, itemIndex) => itemIndex === index ? [type, value, time] : item))} /><input type="time" value={time} onChange={(event) => setItems(items.map((item, itemIndex) => itemIndex === index ? [type, place, event.target.value] : item))} /><div><button className="queue-action" onClick={() => move(index, -1)}>↑</button><button className="queue-action" onClick={() => move(index, 1)}>↓</button><button className="queue-action remove" onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))}>×</button></div></div>)}<button className="secondary publish-queue" onClick={() => { publishWaitingList(items.map(([type, place, time]) => ({ type, place, time }))); onNotify(`${items.length}টি অপেক্ষমাণ প্রান্ত public board-এ প্রকাশিত হয়েছে`); }}>অপেক্ষমাণ তালিকা প্রকাশ করুন ↗</button></div></section>;
}

type TrialEntry = { id: number; division: string; district: string; upazila: string; type: string; name: string; 0: string; 1: string; 2: string; 3: string; audio: string; video: string; note: string };

type PickerOption = { value: string; label: string };

const divisionPickerOptions: PickerOption[] = bdDivisions.map((name) => ({ value: name, label: name }));
const districtPickerOptions: PickerOption[] = bdDistricts.map((name) => ({ value: name, label: name }));
// Some upazila names exist in more than one district, so they are keyed as "district|upazila"
const upazilaPickerOptions: PickerOption[] = bdGeoTree.flatMap((division) => division.districts.flatMap((district) => district.upazilas.map((upazila) => ({ value: `${district.district}|${upazila}`, label: `${upazila} (${district.district})` }))));

function describeScope(scope: TrialScope): string {
  const part = (label: string, selected: string[], total: number, name: (value: string) => string) =>
    selected.length === 0 ? null : selected.length === total ? `সব ${label}` : selected.length <= 3 ? `${label}: ${selected.map(name).join(", ")}` : `${toBn(selected.length)}টি ${label}`;
  const parts = [
    part("বিভাগ", scope.divisions, divisionPickerOptions.length, (value) => value),
    part("জেলা", scope.districts, districtPickerOptions.length, (value) => value),
    part("উপজেলা", scope.upazilas, upazilaPickerOptions.length, (value) => value.split("|")[1] ?? value),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "সব প্রান্ত";
}

function MultiPicker({ label, options, selected, onChange }: { label: string; options: PickerOption[]; selected: string[]; onChange: (next: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedSet = new Set(selected);
  const filtered = query.trim() ? options.filter((option) => option.label.includes(query.trim())) : options;
  const filteredAllSelected = filtered.length > 0 && filtered.every((option) => selectedSet.has(option.value));
  const summary = selected.length === 0 ? "নির্বাচন করুন" : selected.length === options.length ? "সব" : selected.length <= 2 ? options.filter((option) => selectedSet.has(option.value)).map((option) => option.label).join(", ") : `${toBn(selected.length)}টি নির্বাচিত`;
  const close = () => { setOpen(false); setQuery(""); };
  const toggle = (value: string) => onChange(selectedSet.has(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  // "Select all" applies to what the search currently shows
  const toggleFiltered = () => {
    const values = new Set(filtered.map((option) => option.value));
    onChange(filteredAllSelected ? selected.filter((item) => !values.has(item)) : [...new Set([...selected, ...values])]);
  };

  return <div className="multi-picker">
    <button className={`multi-picker-button${selected.length > 0 ? " active" : ""}`} onClick={() => (open ? close() : setOpen(true))} aria-expanded={open}><span>{label}</span><b>{summary}</b><i>⌄</i></button>
    {open && <>
      <div className="menu-backdrop" role="presentation" onClick={close} />
      <div className="multi-picker-menu" role="dialog" aria-label={`${label} নির্বাচন`}>
        {options.length > 12 && <input className="multi-picker-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`${label} খুঁজুন...`} autoFocus />}
        <label className="multi-picker-option all"><input type="checkbox" checked={filteredAllSelected} onChange={toggleFiltered} /><span>{query.trim() ? "ফলাফলের সব নির্বাচন" : `সব ${label} নির্বাচন`}</span><small>{toBn(filtered.length)}</small></label>
        <div className="multi-picker-list">
          {filtered.map((option) => <label className="multi-picker-option" key={option.value}><input type="checkbox" checked={selectedSet.has(option.value)} onChange={() => toggle(option.value)} /><span>{option.label}</span></label>)}
          {filtered.length === 0 && <p className="muted-note multi-picker-empty">কিছু পাওয়া যায়নি</p>}
        </div>
        <div className="multi-picker-foot"><span>{toBn(selected.length)}টি নির্বাচিত</span>{selected.length > 0 && <button className="text-button" onClick={() => onChange([])}>মুছুন</button>}<button className="primary small" onClick={close}>ঠিক আছে</button></div>
      </div>
    </>}
  </div>;
}

function TrialBoard({ onBack, onNotify }: { onBack: () => void; onNotify: (message: string) => void }) {
  const [checks, setChecks] = useState<TrialEntry[]>(() => bdOfficeRoster.map((entry, id) => {
    const flagged = entry.name.includes("উজিরপুর");
    return { ...entry, id, 0: entry.division, 1: entry.district, 2: entry.upazila, 3: entry.name, audio: flagged ? "issue" : "ok", video: flagged ? "pending" : "ok", note: "" };
  }));
  const savedScope = useSyncExternalStore(subscribeTrialScope, getTrialScopeSnapshot, getTrialScopeServerSnapshot);
  const [draftScope, setDraftScope] = useState<TrialScope | null>(null);
  const scopeSelection = draftScope ?? savedScope;
  const [publishStatus, setPublishStatus] = useState<"draft" | "unsaved" | "saved" | "published">("draft");
  const [waiting, setWaiting] = useState([
    { name: "জেলা প্রশাসকের কার্যালয়, ফেনী", type: "জেলা অফিস", place: "ফেনী", time: "১১:০৫" },
    { name: "উপজেলা নির্বাহী অফিসারের কার্যালয়, রায়পুর", type: "উপজেলা অফিস", place: "রায়পুর", time: "১১:১০" },
    { name: "বিভাগীয় কমিশনারের কার্যালয়, খুলনা", type: "বিভাগীয় অফিস", place: "খুলনা", time: "১১:১৫" },
  ]);
  const stripSuffix = (value: string, suffix: string) => value.endsWith(` ${suffix}`) ? value.slice(0, -(suffix.length + 1)) : value;
  const changeScope = (change: Partial<TrialScope>) => { setDraftScope({ ...scopeSelection, ...change }); setPublishStatus("unsaved"); };
  const hasSelection = scopeSelection.divisions.length + scopeSelection.districts.length + scopeSelection.upazilas.length > 0;
  // An office is included when its division, district or upazila is selected for its own level
  const inScope = (entry: TrialEntry) => entry.type === "বিভাগীয় অফিস" ? scopeSelection.divisions.includes(stripSuffix(entry.division, "বিভাগ"))
    : entry.type === "জেলা অফিস" ? scopeSelection.districts.includes(entry.district)
    : entry.type === "উপজেলা অফিস" ? scopeSelection.upazilas.includes(`${entry.district}|${stripSuffix(entry.upazila, "উপজেলা")}`)
    : false;
  const visible = hasSelection ? checks.filter(inScope) : checks;
  const updateCheck = (id: number, key: "audio" | "video") => { setChecks((items) => items.map((item) => item.id === id ? { ...item, [key]: item[key] === "ok" ? "issue" : "ok" } : item)); setPublishStatus("unsaved"); };
  const status = (value: string) => value === "ok" ? "ঠিক আছে" : value === "issue" ? "সমস্যা" : "অপেক্ষমাণ";
  const ready = visible.filter((entry) => entry.audio === "ok" && entry.video === "ok").length;
  const saveDraft = async () => {
    if (!(await saveTrialScope(scopeSelection))) { onNotify("নির্বাচন সংরক্ষণ করা যায়নি, আবার চেষ্টা করুন"); return false; }
    setDraftScope(null);
    return true;
  };
  const saveNow = async () => {
    if (await saveDraft()) { setPublishStatus("saved"); onNotify("নির্বাচন সংরক্ষণ হয়েছে — প্রকাশ করতে \"প্রকাশ করুন\" চাপুন"); }
  };
  const publishNow = async () => {
    if (!(await saveDraft())) return;
    const scopeLabel = describeScope(scopeSelection);
    publishTrialResults({ scopeLabel, entries: visible.map((entry) => ({ name: entry[3], audio: entry.audio, video: entry.video })) });
    setPublishStatus("published");
    onNotify(`${scopeLabel} তালিকা public board-এ প্রকাশিত হয়েছে`);
  };
  const [noteDraftId, setNoteDraftId] = useState<number | null>(null);
  const [noteDraftText, setNoteDraftText] = useState("");
  const startNote = (entry: TrialEntry) => { setNoteDraftId(entry.id); setNoteDraftText(entry.note); };
  const cancelNote = () => { setNoteDraftId(null); setNoteDraftText(""); };
  const saveNote = (entry: TrialEntry) => {
    const text = noteDraftText.trim();
    if (!text) { cancelNote(); return; }
    setChecks((items) => items.map((item) => item.id === entry.id ? { ...item, note: text } : item));
    publishNote({ id: entry.id, name: entry[3], text });
    onNotify(`${entry[3]}-এর জন্য নোট সংরক্ষণ করা হয়েছে`);
    cancelNote();
  };
  const removeNote = (entry: TrialEntry) => {
    setChecks((items) => items.map((item) => item.id === entry.id ? { ...item, note: "" } : item));
    deleteNote(entry.id);
    onNotify(`${entry[3]}-এর নোট মুছে ফেলা হয়েছে`);
    cancelNote();
  };
  return <section className="full-section trial-board"><div className="trial-back"><button className="board-back" onClick={onBack}>← ইভেন্ট তালিকায় ফিরুন</button><span className="status-pill live">লাইভ ট্রায়াল</span></div><div className="section-intro"><div><span className="eyebrow">VC-2026-0911-A · ADMIN ONLY</span><h2>অডিও ও ভিডিও ট্রায়াল বোর্ড</h2><p>জেলা ও উপজেলা প্রান্ত পরীক্ষা করে প্রকাশের জন্য প্রস্তুত করুন।</p></div><button className="primary" onClick={publishNow}>প্রকাশ করুন ↗</button></div><div className="trial-toolbar panel"><div><b>প্রকাশের scope</b><small>Public event page-এ কোন তালিকা দেখা যাবে তা নির্বাচন করুন</small></div><div className="scope-pickers"><button className={`scope-all${hasSelection ? "" : " selected"}`} onClick={() => changeScope(EMPTY_TRIAL_SCOPE)}>সব প্রান্ত</button><MultiPicker label="বিভাগ" options={divisionPickerOptions} selected={scopeSelection.divisions} onChange={(divisions) => changeScope({ divisions })} /><MultiPicker label="জেলা" options={districtPickerOptions} selected={scopeSelection.districts} onChange={(districts) => changeScope({ districts })} /><MultiPicker label="উপজেলা" options={upazilaPickerOptions} selected={scopeSelection.upazilas} onChange={(upazilas) => changeScope({ upazilas })} /></div>{publishStatus === "unsaved" ? <button className="publish-state unsaved" onClick={saveNow} title={`${toBn(visible.length)}টি প্রান্ত সংরক্ষণ করুন`}>○ {toBn(visible.length)} সংরক্ষণ</button> : <span className={`publish-state ${publishStatus}`}>{publishStatus === "published" ? "● প্রকাশিত" : publishStatus === "saved" ? "✓ সংরক্ষিত" : "○ ড্রাফট"}</span>}</div><div className="trial-summary"><div><b>{toBn(visible.length)}</b><span>এই scope-এ প্রান্ত</span></div><div><b className="report-good">{toBn(ready)}</b><span>অডিও ও ভিডিও ঠিক</span></div><div><b className="report-warning">{toBn(visible.length - ready)}</b><span>আরও পরীক্ষা প্রয়োজন</span></div></div><div className="panel trial-table"><div className="trial-head"><span>প্রান্ত / দপ্তর</span><span>অডিও পরীক্ষা</span><span>ভিডিও পরীক্ষা</span><span>সামগ্রিক অবস্থা</span><span>অ্যাকশন</span></div>{visible.length === 0 && <p className="empty-state">এই নির্বাচনে কোনো প্রান্ত পাওয়া যায়নি।</p>}{visible.map((entry) => <div className="trial-row" key={entry.id}><div><b>{entry[3]}</b><small>{[entry[0], entry[1], entry[2]].filter(Boolean).join(" · ")}</small>{entry.note && noteDraftId !== entry.id && <small className="note-flag">নোট: {entry.note}</small>}</div><button className={`check-button ${entry.audio}`} onClick={() => updateCheck(entry.id, "audio")}>◉ {status(entry.audio)}</button><button className={`check-button ${entry.video}`} onClick={() => updateCheck(entry.id, "video")}>▣ {status(entry.video)}</button><span className={`trial-overall ${entry.audio === "ok" && entry.video === "ok" ? "ok" : "issue"}`}>{entry.audio === "ok" && entry.video === "ok" ? "প্রকাশযোগ্য" : "পুনরায় পরীক্ষা"}</span>{noteDraftId === entry.id ? <div className="note-editor"><input value={noteDraftText} onChange={(event) => setNoteDraftText(event.target.value)} placeholder="নোট লিখুন..." autoFocus onKeyDown={(event) => event.key === "Enter" && saveNote(entry)} /><div className="note-editor-actions"><button className="queue-action" onClick={() => saveNote(entry)}>সংরক্ষণ</button>{entry.note && <button className="queue-action remove" onClick={() => removeNote(entry)}>মুছুন</button>}<button className="queue-action remove" onClick={cancelNote}>বাতিল</button></div></div> : <button className={entry.note ? "text-button note-button-flagged" : "text-button"} onClick={() => startNote(entry)}>{entry.note ? "নোট ✎" : "নোট +"}</button>}</div>)}</div></section>;
}

function PublicBoard({ onBack }: { onBack: () => void }) {
  const waitingList = useSyncExternalStore(subscribeWaitingList, getWaitingListSnapshot, getWaitingListServerSnapshot);
  const trial = useSyncExternalStore(subscribeTrialResults, getTrialSnapshot, getTrialServerSnapshot);
  const webrtcLink = useSyncExternalStore(subscribeWebrtcLink, getWebrtcLinkSnapshot, getWebrtcLinkServerSnapshot);
  const notes = useSyncExternalStore(subscribeNotes, getNotesSnapshot, getNotesServerSnapshot);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportName, setSupportName] = useState("");
  const [supportOffice, setSupportOffice] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportError, setSupportError] = useState("");
  const [notice, setNotice] = useState("");
  const closeSupportModal = () => { setShowSupportModal(false); setSupportName(""); setSupportOffice(""); setSupportMessage(""); setSupportError(""); };
  const sendSupportMessage = async () => {
    if (!supportName.trim() || !supportOffice || !supportMessage.trim()) { setSupportError("নাম, অফিস ও সমস্যার বিবরণ আবশ্যক"); return; }
    if (!(await submitSupportMessage(supportName.trim(), supportOffice, supportMessage.trim()))) { setSupportError("বার্তা পাঠানো যায়নি, আবার চেষ্টা করুন"); return; }
    closeSupportModal();
    setNotice("আপনার বার্তা পাঠানো হয়েছে। সহায়তা টিম শীঘ্রই যোগাযোগ করবে।");
    window.setTimeout(() => setNotice(""), 3200);
  };
  const total = trial.entries.length;
  const ready = trial.entries.filter((entry) => entry.audio === "ok" && entry.video === "ok").length;
  const testing = trial.entries.filter((entry) => entry.audio !== "ok" || entry.video !== "ok").length;
  const progress = total > 0 ? Math.round((ready / total) * 100) : 0;
  return <section className="public-board"><div className="public-top"><button className="board-back" onClick={onBack}>← ইভেন্ট তালিকায় ফিরুন</button><span className="public-brand"><b>বিসিসি</b> · সরকারি ভিডিও কনফারেন্সিং</span><span className="public-live"><i /> পাবলিক মনিটর</span></div><div className="public-heading"><div><span className="eyebrow">লাইভ সেশন · VC-2026-0911-A · {trial.scopeLabel}</span><h2>জেলা প্রশাসক সমন্বয় সভা</h2><p>মন্ত্রিপরিষদ বিভাগ · আজ, ১১:০০ · সকল সংযুক্ত প্রান্তের প্রকাশ্য সংযোগ অবস্থা</p></div><button className="board-share" onClick={() => navigator.clipboard?.writeText(window.location.href)}>↗ বোর্ড লিংক কপি</button></div><div className="public-stats"><div><strong>{toBn(total)}</strong><span>মোট প্রান্ত</span></div><div><strong className="good">{toBn(ready)}</strong><span>সংযুক্ত ও প্রস্তুত</span></div><div><strong className="amber">{toBn(testing)}</strong><span>পরীক্ষা চলছে</span></div><div><strong>{toBn(waitingList.length)}</strong><span>অপেক্ষমাণ</span></div></div><div className="public-progress"><div><span>সংযোগ পরীক্ষা অগ্রগতি</span><b>{toBn(progress)}%</b></div><div className="progress"><i style={{ width: `${progress}%` }} /></div></div><div className="public-content"><div className="public-list"><div className="public-list-head"><h3>অংশগ্রহণকারী প্রান্তসমূহ</h3><span>সর্বশেষ আপডেট: ১১:০৩:১৮</span></div>{trial.entries.length === 0 && <p className="empty-state">এখনো কোনো তালিকা প্রকাশিত হয়নি।</p>}{trial.entries.map((entry) => { const info = describeTrialEntry(entry); return <div className="participant" key={entry.name}><span className={`participant-state ${info.tone}`} /> <div><b>{entry.name}</b><small>{info.detail}</small></div><span className={`participant-label ${info.tone === "warning" ? "warning" : ""}`}>{info.label}</span></div>; })}</div><aside className="public-side"><div><span className="eyebrow">বর্তমান কার্যক্রম</span><h3>অডিও ও ভিডিও পরীক্ষা</h3><p>নিয়ন্ত্রণ কক্ষ পর্যায়ক্রমে সব প্রান্ত যাচাই করছে। সভা শুরু হলে এই তালিকা স্বয়ংক্রিয়ভাবে আপডেট হবে।</p>{notes.length > 0 && <div className="activity-notes">{notes.map((note, index) => <div className="activity-note" key={index}><b>{note.name}</b><span>{note.text}</span></div>)}</div>}</div><div className="public-webrtc">{webrtcLink ? <><span className="eyebrow">যোগদানের লিংক</span><a href={webrtcLink} target="_blank" rel="noopener noreferrer" className="board-share webrtc-join">↗ মিটিংয়ে যোগ দিন</a></> : <><span className="eyebrow">যোগদানের লিংক</span><p>এখনো কোনো WebRTC লিংক প্রকাশিত হয়নি।</p></>}</div><div className="public-waiting"><div className="public-list-head"><div><span className="eyebrow">পরবর্তী কল</span><h3>অপেক্ষমাণ তালিকা</h3></div><span>{toBn(waitingList.length)} প্রান্ত</span></div>{waitingList.map((entry, index) => <div className="waiting-row" key={`${entry.type}-${entry.place}`}><b>{toBn(String(index + 1).padStart(2, "0"))}</b><div><strong>{entry.type}</strong><small>{entry.place}</small></div><time>{toBn(entry.time)}</time></div>)}</div><div className="public-help"><b>সংযোগে সমস্যা?</b><span>কন্ট্রোল রুম হটলাইন</span><strong>০২-৫৫০০৬৯৭৮</strong><button className="board-share support-btn" onClick={() => setShowSupportModal(true)}>বার্তা প্রেরণ</button></div></aside></div><footer className="public-footer"><span>বাংলাদেশ কম্পিউটার কাউন্সিল · আইসিটি বিভাগ</span><span>এই বোর্ডটি জনসাধারণের জন্য পর্যবেক্ষণযোগ্য</span></footer>{showSupportModal && <div className="modal-backdrop" role="presentation" onClick={closeSupportModal}><div className="modal support-modal" role="dialog" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={closeSupportModal}>×</button><span className="eyebrow">সহায়তা</span><h2>সমস্যার বার্তা পাঠান</h2><p>আপনার প্রান্তের নাম ও সমস্যার বিবরণ দিন — নিয়ন্ত্রণ কক্ষ শীঘ্রই সহায়তা করবে।</p><label>আপনার নাম<input value={supportName} onChange={(event) => setSupportName(event.target.value)} placeholder="যেমন: রফিক আহমেদ" /></label><label>অফিস<select value={supportOffice} onChange={(event) => setSupportOffice(event.target.value)}><option value="">অফিস নির্বাচন করুন</option>{bdOfficeRoster.map((office) => <option key={`${office.division}-${office.district}-${office.name}`} value={office.name}>{office.name}</option>)}</select></label><label>সমস্যার বিবরণ<textarea value={supportMessage} onChange={(event) => setSupportMessage(event.target.value)} placeholder="সমস্যাটি লিখুন..." rows={4} /></label>{supportError && <p className="form-error">{supportError}</p>}<button className="primary wide" onClick={sendSupportMessage}>বার্তা পাঠান <span>→</span></button></div></div>}{notice && <div className="toast">{notice}</div>}</section>;
}

function HelpCenter({ onNotify }: { onNotify: (message: string) => void }) {
  const messages = useSyncExternalStore(subscribeSupportMessages, getSupportSnapshot, getSupportServerSnapshot);
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const openCount = messages.filter((message) => message.status === "open").length;
  const sendSolution = (message: SupportMessage) => {
    const reply = (replyDrafts[message.id] ?? "").trim();
    if (!reply) { onNotify("সমাধান লিখুন"); return; }
    resolveSupportMessage(message.id, reply);
    onNotify(`${message.name}-কে সমাধান পাঠানো হয়েছে`);
  };
  return <section className="full-section"><div className="section-intro"><div><span className="eyebrow">সহায়তা কেন্দ্র</span><h2>পাবলিক বোর্ড থেকে আসা সহায়তা অনুরোধ</h2><p>জনসাধারণের &ldquo;বার্তা প্রেরণ&rdquo; থেকে পাঠানো সংযোগ সমস্যার বার্তা এখানে দেখুন ও সমাধান পাঠান। কন্ট্রোল রুম হটলাইন: ০২-৫৫০০৬৯৭৮</p></div></div><div className="coverage-summary"><div><b>{toBn(messages.length)}</b><span>মোট বার্তা</span></div><div><b>{toBn(openCount)}</b><span>সমাধান প্রয়োজন</span></div><div><b>{toBn(messages.length - openCount)}</b><span>সমাধান হয়েছে</span></div></div>{messages.length === 0 ? <p className="empty-state">এখনো কোনো সহায়তা বার্তা আসেনি।</p> : <div className="support-list">{messages.map((message) => <div className="panel support-card" key={message.id}><div className="support-card-top"><div><b>{message.name}</b><small>{message.office} · {formatSupportTime(message.submittedAt)}</small></div><span className={`status-pill ${message.status === "open" ? "warning" : "live"}`}>{message.status === "open" ? "সমাধান প্রয়োজন" : "সমাধান হয়েছে"}</span></div><p className="support-message">{message.message}</p>{message.status === "resolved" ? <div className="support-reply"><b>পাঠানো সমাধান:</b> {message.reply}</div> : <div className="support-reply-form"><textarea value={replyDrafts[message.id] ?? ""} onChange={(event) => setReplyDrafts({ ...replyDrafts, [message.id]: event.target.value })} placeholder="সমাধান লিখুন..." rows={2} /><button className="primary small" onClick={() => sendSolution(message)}>সমাধান পাঠান</button></div>}</div>)}</div>}</section>;
}

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const formatMoment = (ms: number) => new Date(ms).toLocaleString("bn-BD", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function reportsToCsv(rows: ReportRow[]) {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const header = ["সেশনের নাম", "তারিখ", "আয়োজক", "সহযোগী", "সংযুক্ত / আমন্ত্রিত প্রান্ত", "সাফল্য", "মোট সংযোগ সময়", "গড় সংযোগ সময়", "অবস্থা"].map(escape).join(",");
  const lines = rows.map((row) => [row.title, row.date, row.owner, row.partner, row.endpoints, row.success, row.duration, row.avgDuration, row.status].map(escape).join(","));
  return [header, ...lines].join("\r\n");
}

function connectionsToCsv(row: ReportRow) {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const header = ["অফিস", "নাম", "যোগদান", "বিচ্ছিন্ন", "সময়"].map(escape).join(",");
  const lines = row.connections.map((connection) => [connection.office, connection.name, formatMoment(connection.joinedAt), connection.leftAt ? formatMoment(connection.leftAt) : "সংযুক্ত আছে", connection.durationSec === null ? "চলমান" : formatDuration(connection.durationSec)].map(escape).join(","));
  return [header, ...lines].join("\r\n");
}

// Report data includes names typed on the public pages, so escape everything written into the print window
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
const PRINT_STYLE = "body{font-family:'Hind Siliguri',sans-serif;padding:28px;color:#193038}h1{font-size:20px;margin-bottom:4px}h2{font-size:17px;margin:18px 0 0}h3{font-size:15px;margin:20px 0 0}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{border:1px solid #ccc;padding:8px 10px;text-align:left;font-size:13px}th{background:#f4f8f7}.note{margin-top:18px;font-size:13px;line-height:1.6}";

function openPrintWindow(title: string, body: string, onNotify: (message: string) => void) {
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) { onNotify("পপ-আপ ব্লক করা হয়েছে — ব্রাউজার সেটিংসে পপ-আপ অনুমতি দিন"); return; }
  printWindow.document.write(`<!DOCTYPE html><html lang="bn"><head><meta charSet="utf-8" /><title>${escapeHtml(title)}</title><style>${PRINT_STYLE}</style></head><body>${body}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 300);
}

function printReports(rows: ReportRow[], summary: ReportSummary, onNotify: (message: string) => void) {
  const tableRows = rows.map((row) => `<tr>${[row.title, row.date, row.owner, row.endpoints, row.success, row.duration, row.status].map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
  openPrintWindow("অপারেশন রিপোর্ট", `<h1>বিসিসি ভিডিও কনফারেন্সিং — অপারেশন রিপোর্ট</h1><p>রপ্তানি সময়: ${new Date().toLocaleString("bn-BD")}</p><p>মোট সেশন: ${escapeHtml(summary.totalSessions)} · গড় সংযোগ সাফল্য: ${escapeHtml(summary.avgSuccess)} · অংশগ্রহণকারী প্রান্ত: ${escapeHtml(summary.participants)} · গড় সংযোগ সময়: ${escapeHtml(summary.avgDuration)}</p><table><thead><tr><th>সেশনের নাম</th><th>তারিখ</th><th>আয়োজক</th><th>সংযুক্ত / আমন্ত্রিত</th><th>সাফল্য</th><th>মোট সংযোগ সময়</th><th>অবস্থা</th></tr></thead><tbody>${tableRows}</tbody></table>`, onNotify);
}

function printReportDetail(row: ReportRow, onNotify: (message: string) => void) {
  const fields = [["আয়োজক", row.owner], ["সহযোগী", row.partner || "—"], ["তারিখ", row.date], ["সংযুক্ত / আমন্ত্রিত প্রান্ত", row.endpoints], ["সাফল্য", row.success], ["মোট সংযোগ সময়", row.duration], ["গড় সংযোগ সময়", row.avgDuration], ["অবস্থা", row.status]];
  const fieldRows = fields.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join("");
  const connectionRows = row.connections.map((connection) => `<tr>${[connection.office, connection.name || "—", formatMoment(connection.joinedAt), connection.leftAt ? formatMoment(connection.leftAt) : "সংযুক্ত আছে", connection.durationSec === null ? "চলমান" : formatDuration(connection.durationSec)].map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
  const connectionTable = row.connections.length ? `<h3>সংযোগের বিবরণ</h3><table><thead><tr><th>অফিস</th><th>নাম</th><th>যোগদান</th><th>বিচ্ছিন্ন</th><th>সময়</th></tr></thead><tbody>${connectionRows}</tbody></table>` : "";
  openPrintWindow(`${row.title} — রিপোর্ট`, `<h1>বিসিসি ভিডিও কনফারেন্সিং — সেশন রিপোর্ট</h1><p>রপ্তানি সময়: ${new Date().toLocaleString("bn-BD")}</p><h2>${escapeHtml(row.title)}</h2><table><tbody>${fieldRows}</tbody></table><p class="note"><b>মন্তব্য:</b> ${escapeHtml(row.note)}</p>${connectionTable}`, onNotify);
}

function Reports({ onNotify }: { onNotify: (message: string) => void }) {
  const report = useSyncExternalStore(subscribeReport, getReportSnapshot, getReportServerSnapshot);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [detailsTitle, setDetailsTitle] = useState<string | null>(null);
  // Follow live updates while the details window is open
  const detailsReport = detailsTitle === null ? undefined : report.rows.find((row) => row.title === detailsTitle);
  const loaded = report.generatedAt > 0;

  const downloadAllCsv = () => { downloadTextFile("bccvc-report.csv", reportsToCsv(report.rows), "text/csv;charset=utf-8"); onNotify("CSV ফাইল ডাউনলোড হয়েছে"); };
  const downloadAllJson = () => { downloadTextFile("bccvc-report.json", JSON.stringify(report, null, 2), "application/json"); onNotify("JSON ফাইল ডাউনলোড হয়েছে"); };
  const downloadAllPdf = () => { printReports(report.rows, report.summary, onNotify); };
  const close = async (id: string) => { onNotify(await closeConnection(id) ? "সংযোগটি বন্ধ করা হয়েছে" : "সংযোগ বন্ধ করা যায়নি"); };

  return <section className="full-section">
    <div className="section-intro"><div><span className="eyebrow">অপারেশন অ্যানালিটিক্স · লাইভ ডেটা</span><h2>সংযোগ ও সভার রিপোর্ট</h2><p>প্রতিটি সভায় কোন প্রান্ত কখন WebRTC লিংকে যুক্ত হয়েছে, কতক্ষণ সংযুক্ত ছিল এবং সংযোগ সাফল্যের হার দেখুন।</p></div><div className="download-menu-wrap"><button className="secondary" onClick={() => setDownloadMenuOpen(!downloadMenuOpen)} disabled={!loaded}>↓ রিপোর্ট ডাউনলোড</button>{downloadMenuOpen && <><div className="menu-backdrop" role="presentation" onClick={() => setDownloadMenuOpen(false)} /><div className="download-menu"><button onClick={() => { downloadAllCsv(); setDownloadMenuOpen(false); }}>CSV (.csv)</button><button onClick={() => { downloadAllJson(); setDownloadMenuOpen(false); }}>JSON (.json)</button><button onClick={() => { downloadAllPdf(); setDownloadMenuOpen(false); }}>প্রিন্ট / PDF</button></div></>}</div></div>
    <div className="coverage-summary report-stats"><div><b>{report.summary.totalSessions}</b><span>মোট সেশন</span></div><div><b>{report.summary.avgSuccess}</b><span>গড় সংযোগ সাফল্য</span></div><div><b>{report.summary.participants}</b><span>অংশগ্রহণকারী প্রান্ত</span></div><div><b>{report.summary.avgDuration}</b><span>গড় সংযোগ সময়</span></div></div>
    <div className="panel directory-panel">
      <div className="directory-tools"><div><h3>সেশন রিপোর্ট</h3><span className="report-subtitle">{loaded ? <>লাইভ · প্রতি ৫ সেকেন্ডে হালনাগাদ · এখন সংযুক্ত: {report.summary.activeNow}টি প্রান্ত</> : "লোড হচ্ছে..."}</span></div><button className="filter-button" onClick={downloadAllCsv} disabled={!loaded}>CSV ↓</button></div>
      <div className="directory-head"><span>সেশনের নাম</span><span>সংযুক্ত / আমন্ত্রিত</span><span>সাফল্য</span><span>মোট সংযোগ সময়</span><span>অবস্থা</span><span /></div>
      {loaded && report.rows.length === 0 && <p className="empty-state">এখনো কোনো সভা তৈরি হয়নি।</p>}
      {report.rows.map((row) => <div className="directory-row" key={row.title}><div className="report-name"><b>{row.title}</b><small>{row.date}</small></div><span>{row.endpoints}{row.activeNow > 0 && <em className="report-live-count"> · {toBn(row.activeNow)} সংযুক্ত</em>}</span><span className={row.tone === "warning" ? "report-warning" : "report-good"}>{row.success}</span><span>{row.duration}</span><span className={`report-status ${row.tone}`}>{row.status}</span><button onClick={() => setDetailsTitle(row.title)}>বিস্তারিত →</button></div>)}
    </div>
    {detailsReport && <div className="modal-backdrop" role="presentation" onClick={() => setDetailsTitle(null)}><div className="modal report-details-modal" role="dialog" onClick={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={() => setDetailsTitle(null)}>×</button>
      <span className="eyebrow">রিপোর্ট বিস্তারিত · লাইভ</span>
      <h2>{detailsReport.title}</h2>
      <p>{detailsReport.owner}{detailsReport.partner && <> · সহযোগী: {detailsReport.partner}</>} · {detailsReport.date}</p>
      <div className="report-detail-grid"><div><span>সংযুক্ত / আমন্ত্রিত</span><b>{detailsReport.endpoints}</b></div><div><span>সাফল্য</span><b className={detailsReport.tone === "warning" ? "report-warning" : "report-good"}>{detailsReport.success}</b></div><div><span>মোট সংযোগ সময়</span><b>{detailsReport.duration}</b></div><div><span>গড় সংযোগ সময়</span><b>{detailsReport.avgDuration}</b></div></div>
      <p className="report-detail-note"><b>মন্তব্য:</b> {detailsReport.note}</p>
      {detailsReport.connections.length > 0 && <div className="connection-log"><h3>সংযোগের বিবরণ</h3>{detailsReport.connections.map((connection) => <div className="connection-row" key={connection.id}><div><b>{connection.office}</b><small>{connection.name || "নাম দেওয়া হয়নি"}</small></div><div className="connection-times"><span>যোগদান: {formatMoment(connection.joinedAt)}</span><span>{connection.leftAt ? <>বিচ্ছিন্ন: {formatMoment(connection.leftAt)}</> : <em className="connection-open">● সংযুক্ত আছে</em>}</span></div><b className="connection-duration">{connection.durationSec === null ? formatDuration((report.generatedAt - connection.joinedAt) / 1000) : formatDuration(connection.durationSec)}</b>{connection.leftAt === null && <button className="text-button danger" onClick={() => close(connection.id)}>বন্ধ করুন</button>}</div>)}</div>}
      <div className="event-detail-actions"><button className="secondary" onClick={() => printReportDetail(detailsReport, onNotify)}>↓ এই রিপোর্ট PDF</button>{detailsReport.connections.length > 0 && <button className="secondary" onClick={() => { downloadTextFile(`${detailsReport.title}-connections.csv`, connectionsToCsv(detailsReport), "text/csv;charset=utf-8"); onNotify("সংযোগের CSV ডাউনলোড হয়েছে"); }}>↓ সংযোগ CSV</button>}</div>
    </div></div>}
  </section>;
}

function Settings({ onNotify }: { onNotify: (message: string) => void }) {
  const user = useSessionUser();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [publicBoard, setPublicBoard] = useState(true);
  const [alerts, setAlerts] = useState(true);
  const [twoFactor, setTwoFactor] = useState(false);
  return <section className="full-section"><div className="section-intro"><div><span className="eyebrow">সিস্টেম কনফিগারেশন</span><h2>অপারেশন সেন্টার সেটিংস</h2><p>আপনার প্রোফাইল, লাইভ মনিটরিং, অ্যাক্সেস ও টিম ব্যবস্থাপনা এক জায়গা থেকে পরিচালনা করুন।</p></div><button className="primary" onClick={() => onNotify("সেটিংস সংরক্ষণ হয়েছে")}>পরিবর্তন সংরক্ষণ</button></div><div className="settings-grid"><div className="panel settings-card"><div className="settings-heading"><span className="settings-icon">◎</span><div><h3>আমার প্রোফাইল</h3><p>আপনার লগইন পরিচয়</p></div></div><label>নাম<input value={user.name} readOnly /></label><label>ভূমিকা<input value={roleLabel(user.role)} readOnly /></label><label>ব্যবহারকারী নাম<input value={user.username} readOnly /></label></div><div className="panel settings-card"><div className="settings-heading"><span className="settings-icon">◌</span><div><h3>মনিটরিং পছন্দ</h3><p>লাইভ বোর্ডের আচরণ ও পাবলিক দৃশ্যমানতা</p></div></div><SettingToggle title="স্বয়ংক্রিয় ডেটা রিফ্রেশ" detail="প্রতি ৩০ সেকেন্ডে লাইভ স্ট্যাটাস আপডেট করুন" enabled={autoRefresh} onToggle={() => setAutoRefresh(!autoRefresh)} /><SettingToggle title="পাবলিক মনিটরিং বোর্ড" detail="অনুমোদিত ইভেন্টের পাবলিক স্ট্যাটাস দেখান" enabled={publicBoard} onToggle={() => setPublicBoard(!publicBoard)} /><SettingToggle title="সতর্কতা বিজ্ঞপ্তি" detail="অফলাইন বা দুর্বল সংযোগে সতর্ক করুন" enabled={alerts} onToggle={() => setAlerts(!alerts)} /></div></div><TeamPanel onNotify={onNotify} /><div className="panel security-panel"><div><span className="eyebrow">নিরাপত্তা</span><h3>অ্যাক্সেস ও সেশন</h3><p>শেষ লগইন: আজ, সকাল ০৮:৪২ · আগারগাঁও কন্ট্রোল রুম</p></div><div className="security-actions"><SettingToggle title="দ্বি-স্তর যাচাই (2FA)" detail="লগইনের সময় অতিরিক্ত নিরাপত্তা কোড আবশ্যক করুন" enabled={twoFactor} onToggle={() => setTwoFactor(!twoFactor)} /><button className="secondary" onClick={() => onNotify("পাসওয়ার্ড পরিবর্তনের ফর্ম খোলা হয়েছে")}>পাসওয়ার্ড পরিবর্তন</button></div></div></section>;
}

const emptyMemberForm = { name: "", username: "", password: "", role: "operator" as Role };

async function apiRequest(url: string, method: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: "সার্ভারের সাথে সংযোগ করা যায়নি" } };
  }
}

function TeamPanel({ onNotify }: { onNotify: (message: string) => void }) {
  const user = useSessionUser();
  const canManage = canManageTeam(user.role);
  const allowedRoles = manageableRoles(user.role);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(canManage);
  const [loadError, setLoadError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyMemberForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const applyMembers = useCallback(({ ok, data }: Awaited<ReturnType<typeof apiRequest>>) => {
    if (ok) { setMembers(data.users as TeamMember[]); setLoadError(""); } else setLoadError(String(data.error ?? "সদস্য তালিকা লোড করা যায়নি"));
    setLoading(false);
  }, []);
  const load = async () => applyMembers(await apiRequest("/api/users", "GET"));

  useEffect(() => {
    if (!canManage) return;
    let cancelled = false;
    apiRequest("/api/users", "GET").then((result) => { if (!cancelled) applyMembers(result); });
    return () => { cancelled = true; };
  }, [canManage, applyMembers]);

  const closeAdd = () => { setShowAdd(false); setForm(emptyMemberForm); setFormError(""); };
  const addMember = async () => {
    if (!form.name.trim() || !form.username.trim() || !form.password) { setFormError("নাম, ব্যবহারকারী নাম ও পাসওয়ার্ড আবশ্যক"); return; }
    setSaving(true);
    const { ok, data } = await apiRequest("/api/users", "POST", { ...form, name: form.name.trim(), username: form.username.trim() });
    setSaving(false);
    if (!ok) { setFormError(String(data.error ?? "সদস্য যোগ করা যায়নি")); return; }
    onNotify(`${form.name.trim()}-কে ${roleLabel(form.role)} হিসেবে যোগ করা হয়েছে`);
    closeAdd();
    void load();
  };
  const updateMember = async (member: TeamMember, change: Record<string, string>, message: string) => {
    const { ok, data } = await apiRequest(`/api/users/${member.id}`, "PATCH", change);
    if (!ok) { onNotify(String(data.error ?? "পরিবর্তন সংরক্ষণ করা যায়নি")); return false; }
    onNotify(message);
    void load();
    return true;
  };
  const submitReset = async (member: TeamMember) => {
    if (await updateMember(member, { password: resetPassword }, `${member.name}-এর পাসওয়ার্ড পরিবর্তন হয়েছে`)) { setResetId(null); setResetPassword(""); }
  };
  const removeMember = async (member: TeamMember) => {
    if (!window.confirm(`${member.name}-কে স্থায়ীভাবে অপসারণ করবেন?`)) return;
    const { ok, data } = await apiRequest(`/api/users/${member.id}`, "DELETE");
    if (!ok) { onNotify(String(data.error ?? "অপসারণ করা যায়নি")); return; }
    onNotify(`${member.name}-কে টিম থেকে সরানো হয়েছে`);
    void load();
  };

  const heading = <div><span className="eyebrow">অ্যাক্সেস নিয়ন্ত্রণ</span><h3>অ্যাডমিন ও অপারেটর ব্যবস্থাপনা</h3><p className="panel-sub">কারা কন্ট্রোল রুম অ্যাক্সেস করতে পারবেন তা পরিচালনা করুন</p></div>;
  if (!canManage) return <div className="panel team-panel"><div className="panel-heading">{heading}</div><p className="muted-note">শুধু সুপার অ্যাডমিন ও অ্যাডমিন সদস্য যোগ, সম্পাদনা ও অপসারণ করতে পারেন।</p></div>;

  // The built-in super admin from .env.local is always listed first and cannot be edited here
  const builtIn: TeamMember = { ...user, status: "active", createdAt: 0 };
  const rows = user.builtIn ? [builtIn, ...members] : [{ id: "env", username: "", name: "প্রধান সুপার অ্যাডমিন", role: "super-admin" as Role, builtIn: true, status: "active" as const, createdAt: 0 }, ...members];

  return <div className="panel team-panel">
    <div className="panel-heading">{heading}<button className="primary small" onClick={() => setShowAdd(true)}>{user.role === "super-admin" ? "+ নতুন অ্যাডমিন / অপারেটর" : "+ নতুন অপারেটর"}</button></div>
    {showAdd && <div className="add-admin-form">
      <div className="form-row"><label>নাম<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="পূর্ণ নাম" /></label><label>ব্যবহারকারী নাম / ইমেইল<input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="name@bcc.gov.bd" autoComplete="off" /></label></div>
      <div className="form-row"><label>প্রাথমিক পাসওয়ার্ড<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="কমপক্ষে ৮ অক্ষর" autoComplete="new-password" /></label><label>ভূমিকা<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })} disabled={allowedRoles.length === 1}>{allowedRoles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label></div>
      {formError && <p className="form-error">{formError}</p>}
      <div className="add-admin-actions"><button className="primary small" onClick={addMember} disabled={saving}>{saving ? "সংরক্ষণ হচ্ছে..." : "সদস্য যোগ করুন"}</button><button className="secondary small" onClick={closeAdd}>বাতিল</button></div>
    </div>}
    {loadError && <p className="form-error">{loadError}</p>}
    <div className="admin-table">
      <div className="admin-head"><span>সদস্য</span><span>ভূমিকা</span><span>অবস্থা</span><span>অ্যাকশন</span></div>
      {loading ? <p className="muted-note team-loading">লোড হচ্ছে...</p> : rows.map((member) => {
        const isSelf = member.id === user.id;
        const active = member.status === "active";
        return <div className="admin-row" key={member.id}>
          <div className="admin-identity"><span className="avatar">{member.name[0]}</span><div><b>{member.name}{isSelf && <span className="self-tag">আপনি</span>}</b><small>{member.builtIn ? "প্রধান অ্যাকাউন্ট (.env.local)" : member.username}</small></div></div>
          <span className={`role-badge ${member.role}`}>{roleLabel(member.role)}</span>
          <span className={`status-pill ${active ? "live" : "draft"}`}>{active ? "সক্রিয়" : "নিষ্ক্রিয়"}</span>
          <div className="admin-actions">{member.builtIn || !allowedRoles.includes(member.role) ? <small className="muted-note">সম্পাদনাযোগ্য নয়</small> : isSelf ? <small className="muted-note">নিজের অ্যাক্সেস সম্পাদনাযোগ্য নয়</small> : resetId === member.id ? <>
            <input className="reset-password-input" type="password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} placeholder="নতুন পাসওয়ার্ড" autoComplete="new-password" autoFocus />
            <button className="text-button" onClick={() => submitReset(member)}>সংরক্ষণ</button><button className="text-button" onClick={() => { setResetId(null); setResetPassword(""); }}>বাতিল</button>
          </> : <>
            {allowedRoles.length > 1 && <select className="role-select" aria-label="ভূমিকা পরিবর্তন" value={member.role} onChange={(event) => { const role = event.target.value as Role; void updateMember(member, { role }, `${member.name}-কে ${roleLabel(role)} করা হয়েছে`); }}>{ROLES.filter((role) => allowedRoles.includes(role)).map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select>}
            <button className="text-button" onClick={() => updateMember(member, { status: active ? "disabled" : "active" }, active ? `${member.name}-কে নিষ্ক্রিয় করা হয়েছে` : `${member.name}-কে সক্রিয় করা হয়েছে`)}>{active ? "নিষ্ক্রিয় করুন" : "সক্রিয় করুন"}</button>
            <button className="text-button" onClick={() => { setResetId(member.id); setResetPassword(""); }}>পাসওয়ার্ড রিসেট</button>
            <button className="text-button danger" onClick={() => removeMember(member)}>অপসারণ</button>
          </>}</div>
        </div>;
      })}
      {!loading && !loadError && members.length === 0 && <p className="muted-note team-loading">এখনো কোনো অ্যাডমিন বা অপারেটর যোগ করা হয়নি।</p>}
    </div>
  </div>;
}

function SettingToggle({ title, detail, enabled, onToggle }: { title: string; detail: string; enabled: boolean; onToggle: () => void }) {
  return <div className="setting-toggle"><div><b>{title}</b><small>{detail}</small></div><button className={`toggle ${enabled ? "on" : ""}`} onClick={onToggle} aria-pressed={enabled}><i /></button></div>;
}
