"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { bdOfficeRoster } from "./bd-geo";
import { formatClockDuration, formatDuration } from "./connection-types";
import { endConnection, getActiveConnection, getActiveConnectionServerSnapshot, startConnection, subscribeActiveConnection } from "./connection-store";

/**
 * "Join meeting" button that records connection time: asks which office is joining,
 * opens the WebRTC link, then shows a running timer with a disconnect button.
 */
export default function JoinMeeting({ eventTitle, link, className, onNotify }: { eventTitle: string; link: string; className: string; onNotify: (message: string) => void }) {
  const active = useSyncExternalStore(subscribeActiveConnection, getActiveConnection, getActiveConnectionServerSnapshot);
  const [now, setNow] = useState(() => Date.now());
  const [showForm, setShowForm] = useState(false);
  const [office, setOffice] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  const join = async () => {
    if (!office) { setError("আপনার অফিস নির্বাচন করুন"); return; }
    // Open the meeting first so the browser does not treat it as an unrequested pop-up
    window.open(link, "_blank", "noopener,noreferrer");
    setBusy(true);
    const problem = await startConnection(eventTitle, office, name, link);
    setBusy(false);
    if (problem) { setError(`মিটিং খোলা হয়েছে, কিন্তু সংযোগ সময় রেকর্ড হয়নি: ${problem}`); return; }
    setShowForm(false);
    setError("");
    onNotify("মিটিংয়ে যুক্ত হয়েছেন — সংযোগ সময় গণনা শুরু হয়েছে");
  };

  const leave = async () => {
    if (!active) return;
    setBusy(true);
    const seconds = await endConnection(active.id);
    setBusy(false);
    onNotify(seconds === null ? "সংযোগ বিচ্ছিন্ন রেকর্ড করা যায়নি, আবার চেষ্টা করুন" : `সংযোগ বিচ্ছিন্ন হয়েছে · মোট সময় ${formatDuration(seconds)}`);
  };

  if (active) {
    return <div className="join-active" role="status">
      <span className="join-active-dot" />
      <div className="join-active-info"><b>সংযুক্ত · {formatClockDuration((now - active.joinedAt) / 1000)}</b><small>{active.office}{active.eventTitle !== eventTitle && <> · {active.eventTitle}</>}</small></div>
      <a href={active.link} target="_blank" rel="noopener noreferrer" className="join-active-return">মিটিংয়ে ফিরুন ↗</a>
      <button className="join-active-leave" onClick={leave} disabled={busy}>{busy ? "..." : "সংযোগ বিচ্ছিন্ন করুন"}</button>
    </div>;
  }

  return <>
    <button className={className} onClick={() => { setShowForm(true); setError(""); }}>↗ মিটিংয়ে যোগ দিন</button>
    {showForm && <div className="modal-backdrop" role="presentation" onClick={() => setShowForm(false)}><div className="modal support-modal" role="dialog" aria-label="মিটিংয়ে যোগ দিন" onClick={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
      <span className="eyebrow">মিটিংয়ে যোগ দিন</span>
      <h2>{eventTitle}</h2>
      <p>কোন প্রান্ত থেকে যুক্ত হচ্ছেন তা নির্বাচন করুন। যোগ দেওয়া থেকে সংযোগ বিচ্ছিন্ন করা পর্যন্ত সময় রিপোর্টে যুক্ত হবে।</p>
      <label>অফিস<select value={office} onChange={(event) => setOffice(event.target.value)}><option value="">অফিস নির্বাচন করুন</option>{bdOfficeRoster.map((entry) => <option key={`${entry.division}-${entry.district}-${entry.name}`} value={entry.name}>{entry.name}</option>)}</select></label>
      <label>আপনার নাম (ঐচ্ছিক)<input value={name} onChange={(event) => setName(event.target.value)} placeholder="পূর্ণ নাম" /></label>
      {error && <p className="form-error">{error}</p>}
      <button className="primary wide" onClick={join} disabled={busy}>{busy ? "যুক্ত হচ্ছে..." : "যোগ দিন ও সময় গণনা শুরু করুন ↗"}</button>
    </div></div>}
  </>;
}
