"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) { setError("ব্যবহারকারী নাম ও পাসওয়ার্ড দিন"); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "লগইন করা যায়নি, আবার চেষ্টা করুন");
        setSubmitting(false);
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("সার্ভারের সাথে সংযোগ করা যায়নি");
      setSubmitting(false);
    }
  };

  return <main className="login-shell">
    <form className="login-card" onSubmit={submit}>
      <div className="login-brand"><span className="lp-logo">VC</span><span><b>বিসিসি ভিডিও কনফারেন্সিং</b><small>অপারেশন সেন্টার</small></span></div>
      <span className="eyebrow">অ্যাডমিন লগইন</span>
      <h1>অ্যাডমিন প্যানেলে প্রবেশ করুন</h1>
      <label>ব্যবহারকারী নাম<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" autoFocus /></label>
      <label>পাসওয়ার্ড<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary wide" type="submit" disabled={submitting}>{submitting ? "যাচাই করা হচ্ছে..." : "লগইন করুন"}</button>
      <Link href="/" className="login-back">← হোম পেজে ফিরে যান</Link>
    </form>
  </main>;
}
