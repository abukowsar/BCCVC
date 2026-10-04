"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { bdDivisions, bdOfficeRoster } from "./bd-geo";
import { toBn } from "./bn-utils";
import { getTrialServerSnapshot, getTrialSnapshot, subscribeTrialResults } from "./trial-store";
import { getWebrtcLinkServerSnapshot, getWebrtcLinkSnapshot, subscribeWebrtcLink } from "./webrtc-store";
import { getLiveEventsServerSnapshot, getLiveEventsSnapshot, subscribeLiveEvents } from "./events-store";
import { submitSupportMessage } from "./support-store";
import HeroIllustration from "./hero-illustration";

const LIVE_EVENT_ID = "VC-2026-0911-A";
const districtCount = new Set(bdOfficeRoster.filter((office) => office.type === "জেলা অফিস").map((office) => office.district)).size;
const upazilaCount = bdOfficeRoster.filter((office) => office.type === "উপজেলা অফিস").length;

const steps = [
  { icon: "◎", title: "সংযোগ পরীক্ষা", text: "সভার আগে নিয়ন্ত্রণ কক্ষ প্রতিটি প্রান্তের অডিও ও ভিডিও যাচাই করে।" },
  { icon: "↗", title: "তালিকা প্রকাশ", text: "প্রস্তুত প্রান্তের তালিকা পাবলিক বোর্ডে প্রকাশ করা হয় — সবাই দেখতে পারেন।" },
  { icon: "▶", title: "লাইভ সভা", text: "যোগদানের লিংক থেকে সরাসরি সভায় যুক্ত হন, অগ্রগতি রিয়েল-টাইমে দেখুন।" },
];

export default function LandingPage() {
  const trial = useSyncExternalStore(subscribeTrialResults, getTrialSnapshot, getTrialServerSnapshot);
  const webrtcLink = useSyncExternalStore(subscribeWebrtcLink, getWebrtcLinkSnapshot, getWebrtcLinkServerSnapshot);
  const liveEvents = useSyncExternalStore(subscribeLiveEvents, getLiveEventsSnapshot, getLiveEventsServerSnapshot);
  const readyCount = trial.entries.filter((entry) => entry.audio === "ok" && entry.video === "ok").length;
  const progress = trial.entries.length > 0 ? Math.round((readyCount / trial.entries.length) * 100) : 0;

  const [showSupport, setShowSupport] = useState(false);
  const [supportName, setSupportName] = useState("");
  const [supportOffice, setSupportOffice] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportError, setSupportError] = useState("");
  const [notice, setNotice] = useState("");
  const closeSupport = () => { setShowSupport(false); setSupportName(""); setSupportOffice(""); setSupportMessage(""); setSupportError(""); };
  const sendSupport = async () => {
    if (!supportName.trim() || !supportOffice || !supportMessage.trim()) { setSupportError("নাম, অফিস ও সমস্যার বিবরণ আবশ্যক"); return; }
    if (!(await submitSupportMessage(supportName.trim(), supportOffice, supportMessage.trim()))) { setSupportError("বার্তা পাঠানো যায়নি, আবার চেষ্টা করুন"); return; }
    closeSupport();
    setNotice("আপনার বার্তা পাঠানো হয়েছে। সহায়তা টিম শীঘ্রই যোগাযোগ করবে।");
    window.setTimeout(() => setNotice(""), 3200);
  };

  return <main className="lp">
    <header className="lp-nav">
      <Link href="/" className="lp-brand"><span className="lp-logo">VC</span><span><b>বিসিসি ভিডিও কনফারেন্সিং</b><small>বাংলাদেশ কম্পিউটার কাউন্সিল</small></span></Link>
      <nav className="lp-links" aria-label="প্রধান নেভিগেশন"><a href="#live">লাইভ সভা</a><a href="#how">কীভাবে কাজ করে</a><a href="#coverage">কভারেজ</a><a href="#support">সহায়তা</a></nav>
      <Link href="/login" className="lp-login">অ্যাডমিন লগইন →</Link>
    </header>

    <section className="lp-hero">
      <div className="lp-hero-top">
      <div className="lp-hero-copy">
        <span className="lp-kicker"><i /> সরকারি ভিডিও কনফারেন্সিং নেটওয়ার্ক</span>
        <h1>সারাদেশের সরকারি দপ্তর, <em>এক সংযোগে</em></h1>
        <p>বিভাগ, জেলা ও উপজেলা পর্যায়ের প্রতিটি দপ্তরকে নির্ভরযোগ্য ভিডিও সংযোগে যুক্ত রাখে বাংলাদেশ কম্পিউটার কাউন্সিল। চলমান সভার সংযোগ অবস্থা যে কেউ সরাসরি দেখতে পারেন।</p>
        <div className="lp-cta"><Link href={`/event/${LIVE_EVENT_ID}`} className="lp-btn primary-lg">লাইভ সভা দেখুন →</Link><button className="lp-btn ghost" onClick={() => setShowSupport(true)}>সংযোগে সমস্যা? বার্তা দিন</button></div>
      </div>
      <div className="lp-hero-art"><HeroIllustration liveTitle={liveEvents[0]?.title} /></div>
      </div>
      <div className="lp-stats">
        <div><b>{toBn(bdDivisions.length)}</b><span>বিভাগ</span></div>
        <div><b>{toBn(districtCount)}</b><span>জেলা</span></div>
        <div><b>{toBn(upazilaCount)}</b><span>উপজেলা</span></div>
        <div><b>২৪/৭</b><span>নিয়ন্ত্রণ কক্ষ</span></div>
      </div>
    </section>

    <section className="lp-section" id="live">
      {liveEvents.length === 0 ? <div className="lp-live lp-live-empty">
        <div className="lp-live-main">
          <span className="lp-badge idle"><i /> লাইভ সভা নেই</span>
          <h2>এই মুহূর্তে কোনো লাইভ সভা চলছে না</h2>
          <p>পরবর্তী সভা লাইভ হলে এখানে স্বয়ংক্রিয়ভাবে দেখা যাবে।</p>
        </div>
      </div> : liveEvents.map((liveEvent) => {
        const joinLink = liveEvent.webrtcLink || webrtcLink;
        return <div className="lp-live" key={liveEvent.title}>
          <div className="lp-live-main">
            <span className="lp-badge"><i /> এখন লাইভ</span>
            <h2>{liveEvent.title}</h2>
            <p>{liveEvent.owner}{liveEvent.partner && <> · সহযোগী: {liveEvent.partner}</>} · {liveEvent.date} · প্রকাশিত তালিকা: {trial.scopeLabel}</p>
            <div className="lp-progress-label"><span>সংযোগ পরীক্ষা অগ্রগতি</span><b>{toBn(readyCount)} / {toBn(trial.entries.length)} প্রান্ত প্রস্তুত</b></div>
            <div className="lp-progress"><i style={{ width: `${progress}%` }} /></div>
          </div>
          <div className="lp-live-actions">
            <Link href={`/event/${LIVE_EVENT_ID}`} className="lp-btn primary-lg">পাবলিক বোর্ড খুলুন</Link>
            {joinLink ? <a href={joinLink} target="_blank" rel="noopener noreferrer" className="lp-btn outline">↗ মিটিংয়ে যোগ দিন</a> : <span className="lp-muted">যোগদানের লিংক এখনো প্রকাশিত হয়নি</span>}
          </div>
        </div>;
      })}
    </section>

    <section className="lp-section" id="how">
      <div className="lp-section-head"><span className="eyebrow">কীভাবে কাজ করে</span><h2>সভার আগে থেকে সভা চলাকালীন — পুরো প্রক্রিয়া স্বচ্ছ</h2></div>
      <div className="lp-steps">{steps.map((step, index) => <div className="lp-step" key={step.title}><span className="lp-step-icon">{step.icon}</span><small>ধাপ {toBn(index + 1)}</small><h3>{step.title}</h3><p>{step.text}</p></div>)}</div>
    </section>

    <section className="lp-section" id="coverage">
      <div className="lp-section-head"><span className="eyebrow">দেশজুড়ে কভারেজ</span><h2>৮টি বিভাগের প্রতিটি দপ্তর নেটওয়ার্কে যুক্ত</h2></div>
      <div className="lp-divisions">{bdDivisions.map((division) => { const offices = bdOfficeRoster.filter((office) => office.division === `${division} বিভাগ`).length; return <div className="lp-division" key={division}><b>{division}</b><span>{toBn(offices)} দপ্তর</span></div>; })}</div>
    </section>

    <section className="lp-section" id="support">
      <div className="lp-support">
        <div><span className="eyebrow">সহায়তা</span><h2>সংযোগে সমস্যা হচ্ছে?</h2><p>আপনার দপ্তর নির্বাচন করে সমস্যা লিখুন — নিয়ন্ত্রণ কক্ষ সরাসরি সমাধান পাঠাবে। জরুরি প্রয়োজনে হটলাইনে কল করুন।</p></div>
        <div className="lp-support-actions"><a className="lp-hotline" href="tel:+880255006978"><small>কন্ট্রোল রুম হটলাইন</small><b>০২-৫৫০০৬৯৭৮</b></a><button className="lp-btn primary-lg" onClick={() => setShowSupport(true)}>বার্তা প্রেরণ</button></div>
      </div>
    </section>

    <footer className="lp-footer"><span>© ২০২৬ বাংলাদেশ কম্পিউটার কাউন্সিল · তথ্য ও যোগাযোগ প্রযুক্তি বিভাগ</span><Link href="/admin">অ্যাডমিন প্যানেল</Link></footer>

    {showSupport && <div className="modal-backdrop" role="presentation" onClick={closeSupport}><div className="modal support-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><button className="modal-close" aria-label="বন্ধ করুন" onClick={closeSupport}>×</button><span className="eyebrow">সহায়তা</span><h2>সমস্যার বার্তা পাঠান</h2><p>আপনার নাম, দপ্তর ও সমস্যার বিবরণ দিন — নিয়ন্ত্রণ কক্ষ শীঘ্রই সহায়তা করবে।</p><label>আপনার নাম<input value={supportName} onChange={(event) => setSupportName(event.target.value)} placeholder="যেমন: রফিক আহমেদ" /></label><label>অফিস<select value={supportOffice} onChange={(event) => setSupportOffice(event.target.value)}><option value="">অফিস নির্বাচন করুন</option>{bdOfficeRoster.map((office) => <option key={`${office.division}-${office.district}-${office.name}`} value={office.name}>{office.name}</option>)}</select></label><label>সমস্যার বিবরণ<textarea value={supportMessage} onChange={(event) => setSupportMessage(event.target.value)} placeholder="সমস্যাটি লিখুন..." rows={4} /></label>{supportError && <p className="form-error">{supportError}</p>}<button className="primary wide" onClick={sendSupport}>বার্তা পাঠান <span>→</span></button></div></div>}
    {notice && <div className="toast" role="status">{notice}</div>}
  </main>;
}
