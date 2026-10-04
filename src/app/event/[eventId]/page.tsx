"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { toBn } from "../../bn-utils";
import { getWaitingListServerSnapshot, getWaitingListSnapshot, subscribeWaitingList } from "../../waiting-store";
import { describeTrialEntry, getTrialServerSnapshot, getTrialSnapshot, subscribeTrialResults } from "../../trial-store";
import { getWebrtcLinkServerSnapshot, getWebrtcLinkSnapshot, subscribeWebrtcLink } from "../../webrtc-store";
import { getNotesServerSnapshot, getNotesSnapshot, subscribeNotes } from "../../note-store";
import { getLiveEventsServerSnapshot, getLiveEventsSnapshot, subscribeLiveEvents } from "../../events-store";
import { submitSupportMessage } from "../../support-store";
import { bdOfficeRoster } from "../../bd-geo";
import JoinMeeting from "../../join-meeting";

export default function PublicEventPage() {
  const [notice, setNotice] = useState("");
  const waitingList = useSyncExternalStore(subscribeWaitingList, getWaitingListSnapshot, getWaitingListServerSnapshot);
  const trial = useSyncExternalStore(subscribeTrialResults, getTrialSnapshot, getTrialServerSnapshot);
  const webrtcLink = useSyncExternalStore(subscribeWebrtcLink, getWebrtcLinkSnapshot, getWebrtcLinkServerSnapshot);
  const notes = useSyncExternalStore(subscribeNotes, getNotesSnapshot, getNotesServerSnapshot);
  const liveEvents = useSyncExternalStore(subscribeLiveEvents, getLiveEventsSnapshot, getLiveEventsServerSnapshot);
  const liveEvent = liveEvents[0];
  const { eventId } = useParams<{ eventId: string }>();
  const sessionId = decodeURIComponent(eventId ?? "");
  // The live event's own join link takes priority over the shared one
  const joinLink = liveEvent?.webrtcLink || webrtcLink;
  const total = trial.entries.length;
  const ready = trial.entries.filter((entry) => entry.audio === "ok" && entry.video === "ok").length;
  const testing = trial.entries.filter((entry) => entry.audio !== "ok" || entry.video !== "ok").length;
  const progress = total > 0 ? Math.round((ready / total) * 100) : 0;
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportName, setSupportName] = useState("");
  const [supportOffice, setSupportOffice] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportError, setSupportError] = useState("");
  const closeSupportModal = () => { setShowSupportModal(false); setSupportName(""); setSupportOffice(""); setSupportMessage(""); setSupportError(""); };
  const sendSupportMessage = async () => {
    if (!supportName.trim() || !supportOffice || !supportMessage.trim()) { setSupportError("নাম, অফিস ও সমস্যার বিবরণ আবশ্যক"); return; }
    if (!(await submitSupportMessage(supportName.trim(), supportOffice, supportMessage.trim()))) { setSupportError("বার্তা পাঠানো যায়নি, আবার চেষ্টা করুন"); return; }
    closeSupportModal();
    setNotice("আপনার বার্তা পাঠানো হয়েছে। সহায়তা টিম শীঘ্রই যোগাযোগ করবে।");
    window.setTimeout(() => setNotice(""), 3200);
  };
  const copyLink = async () => {
    await navigator.clipboard?.writeText(window.location.href);
    setNotice("পাবলিক বোর্ডের লিংক কপি হয়েছে");
    window.setTimeout(() => setNotice(""), 2400);
  };

  return <main className="public-board public-landing">
    <div className="public-top"><Link href="/" className="public-brand"><b>বিসিসি</b> · সরকারি ভিডিও কনফারেন্সিং</Link><span className="public-live"><i /> লাইভ মনিটরিং</span></div>
    <header className="public-heading"><div><span className="eyebrow">{liveEvent ? "লাইভ সেশন" : "সেশন"} · {sessionId} · {trial.scopeLabel}</span><h1>{liveEvent ? liveEvent.title : "এই মুহূর্তে কোনো লাইভ সভা নেই"}</h1><p>{liveEvent ? <>{liveEvent.owner}{liveEvent.partner && <> · সহযোগী: {liveEvent.partner}</>} · {liveEvent.date}{liveEvent.trialDate && <> · ট্রায়াল: {liveEvent.trialDate}</>} · সকল সংযুক্ত প্রান্তের প্রকাশ্য সংযোগ অবস্থা</> : "পরবর্তী সভা লাইভ হলে এখানে স্বয়ংক্রিয়ভাবে দেখা যাবে · সর্বশেষ প্রকাশিত সংযোগ অবস্থা নিচে দেখুন"}</p></div><button className="board-share" onClick={copyLink}>↗ বোর্ড লিংক কপি</button></header>
    <section className="public-stats"><div><strong>{toBn(total)}</strong><span>মোট প্রান্ত</span></div><div><strong className="good">{toBn(ready)}</strong><span>সংযুক্ত ও প্রস্তুত</span></div><div><strong className="amber">{toBn(testing)}</strong><span>পরীক্ষা চলছে</span></div><div><strong>{toBn(waitingList.length)}</strong><span>অপেক্ষমাণ</span></div></section>
    <section className="public-progress"><div><span>সংযোগ পরীক্ষা অগ্রগতি</span><b>{toBn(progress)}%</b></div><div className="progress"><i style={{ width: `${progress}%` }} /></div></section>
    <div className="public-content"><section className="public-list"><div className="public-list-head"><h2>অংশগ্রহণকারী প্রান্তসমূহ</h2><span>স্বয়ংক্রিয় হালনাগাদ · প্রতি ৫ সেকেন্ডে</span></div>{trial.entries.length === 0 && <p className="empty-state">এখনো কোনো তালিকা প্রকাশিত হয়নি।</p>}{trial.entries.map((entry) => { const info = describeTrialEntry(entry); return <div className="participant" key={entry.name}><span className={`participant-state ${info.tone}`} /><div><b>{entry.name}</b><small>{info.detail}</small></div><span className={`participant-label ${info.tone === "warning" ? "warning" : ""}`}>{info.label}</span></div>; })}</section><aside className="public-side"><div><span className="eyebrow">বর্তমান কার্যক্রম</span><h2>অডিও ও ভিডিও পরীক্ষা</h2><p>নিয়ন্ত্রণ কক্ষ পর্যায়ক্রমে সব প্রান্ত যাচাই করছে। সভা শুরু হলে এই তালিকা স্বয়ংক্রিয়ভাবে আপডেট হবে।</p><div className="public-board-steps"><span className="done">✓</span> অডিও সংযোগ <span className="done">✓</span> ভিডিও সংযোগ <span className="active">◉</span> ক্যামেরা পরীক্ষা</div>{notes.length > 0 && <div className="activity-notes">{notes.map((note, index) => <div className="activity-note" key={index}><b>{note.name}</b><span>{note.text}</span></div>)}</div>}</div><div className="public-webrtc">{joinLink ? <><span className="eyebrow">যোগদানের লিংক</span>{liveEvent ? <JoinMeeting eventTitle={liveEvent.title} link={joinLink} className="board-share webrtc-join" onNotify={(message) => { setNotice(message); window.setTimeout(() => setNotice(""), 3200); }} /> : <a href={joinLink} target="_blank" rel="noopener noreferrer" className="board-share webrtc-join">↗ মিটিংয়ে যোগ দিন</a>}</> : <><span className="eyebrow">যোগদানের লিংক</span><p>এখনো কোনো WebRTC লিংক প্রকাশিত হয়নি।</p></>}</div><div className="public-waiting"><div className="public-list-head"><div><span className="eyebrow">পরবর্তী কল</span><h2>অপেক্ষমাণ তালিকা</h2></div><span>{toBn(waitingList.length)} প্রান্ত</span></div>{waitingList.map((entry, index) => <div className="waiting-row" key={`${entry.type}-${entry.place}`}><b>{toBn(String(index + 1).padStart(2, "0"))}</b><div><strong>{entry.type}</strong><small>{entry.place}</small></div><time>{toBn(entry.time)}</time></div>)}</div><div className="public-help"><b>সংযোগে সমস্যা?</b><span>কন্ট্রোল রুম হটলাইন</span><strong>০২-৫৫০০৬৯৭৮</strong><button className="board-share support-btn" onClick={() => setShowSupportModal(true)}>বার্তা প্রেরণ</button></div></aside></div>
    <footer className="public-footer"><span>বাংলাদেশ কম্পিউটার কাউন্সিল · আইসিটি বিভাগ</span><span>এই বোর্ডটি জনসাধারণের জন্য পর্যবেক্ষণযোগ্য</span></footer>
    {showSupportModal && <div className="modal-backdrop" role="presentation" onClick={closeSupportModal}><div className="modal support-modal" role="dialog" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={closeSupportModal}>×</button><span className="eyebrow">সহায়তা</span><h2>সমস্যার বার্তা পাঠান</h2><p>আপনার প্রান্তের নাম ও সমস্যার বিবরণ দিন — নিয়ন্ত্রণ কক্ষ শীঘ্রই সহায়তা করবে।</p><label>আপনার নাম<input value={supportName} onChange={(event) => setSupportName(event.target.value)} placeholder="যেমন: রফিক আহমেদ" /></label><label>অফিস<select value={supportOffice} onChange={(event) => setSupportOffice(event.target.value)}><option value="">অফিস নির্বাচন করুন</option>{bdOfficeRoster.map((office) => <option key={`${office.division}-${office.district}-${office.name}`} value={office.name}>{office.name}</option>)}</select></label><label>সমস্যার বিবরণ<textarea value={supportMessage} onChange={(event) => setSupportMessage(event.target.value)} placeholder="সমস্যাটি লিখুন..." rows={4} /></label>{supportError && <p className="form-error">{supportError}</p>}<button className="primary wide" onClick={sendSupportMessage}>বার্তা পাঠান <span>→</span></button></div></div>}
    {notice && <div className="toast">{notice}</div>}
  </main>;
}
