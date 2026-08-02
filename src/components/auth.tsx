"use client";
import React, { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import * as api from "@/lib/api";
import { friendlyError } from "@/lib/api";

const EMOJIS = ["🦊", "🐯", "🐣", "🐼", "🦁", "🐸", "🐙", "🦄", "🐨", "🐵"];

export function Landing({ onPick }: { onPick: (m: "parent" | "kid") => void }) {
  return (
    <div className="center-screen">
      <div style={{ fontSize: 48 }}>🏆</div>
      <h1 style={{ margin: 0 }}>Chore Champions</h1>
      <div className="muted">Who’s using this device?</div>
      <div className="stack">
        <button className="btn" onClick={() => onPick("parent")}>
          I’m a parent 👑
        </button>
        <button className="btn orange" onClick={() => onPick("kid")}>
          I’m a kid 🧒
        </button>
      </div>
    </div>
  );
}

export function ParentAuth({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr("");
    setBusy(true);
    try {
      const sb = supabaseBrowser();
      const res =
        mode === "in"
          ? await sb.auth.signInWithPassword({ email, password: pw })
          : await sb.auth.signUp({ email, password: pw });
      if (res.error) throw res.error;
      onDone();
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <h2 style={{ margin: 0 }}>{mode === "in" ? "Parent sign in" : "Create parent account"}</h2>
      <div className="stack">
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === "in" ? "current-password" : "new-password"} />
        </div>
        {err && <div className="err">{err}</div>}
        <button className="btn" disabled={busy || !email || !pw} onClick={submit}>
          {busy ? "…" : mode === "in" ? "Sign in" : "Create account"}
        </button>
        <button className="linkbtn" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "Need an account? Create one" : "Have an account? Sign in"}
        </button>
        <button className="linkbtn" onClick={onBack}>
          ← Back
        </button>
      </div>
    </div>
  );
}

export function ParentOnboard({ onDone }: { onDone: () => void }) {
  const [familyName, setFamilyName] = useState("");
  const [parentName, setParentName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    setErr("");
    setBusy(true);
    try {
      await api.createFamily(familyName || "My Family", parentName || "Parent");
      onDone();
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <div style={{ fontSize: 40 }}>🏡</div>
      <h2 style={{ margin: 0 }}>Set up your family</h2>
      <div className="stack">
        <div className="field">
          <label>Family name</label>
          <input value={familyName} onChange={(e) => setFamilyName(e.target.value)} placeholder="Knight Family" />
        </div>
        <div className="field">
          <label>Your name</label>
          <input value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="Parent" />
        </div>
        {err && <div className="err">{err}</div>}
        <button className="btn" disabled={busy} onClick={create}>
          {busy ? "…" : "Create family"}
        </button>
        <div className="muted">You’ll add the kids and get a family code next.</div>
      </div>
    </div>
  );
}

export function KidOnboard({ onBack, onRequested }: { onBack: () => void; onRequested: () => void }) {
  const [code, setCode] = useState("");
  const [kids, setKids] = useState<{ id: string; name: string; emoji: string; color: string }[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function findFamily() {
    setErr("");
    setBusy(true);
    try {
      const list = await api.familyKids(code.trim());
      if (!list.length) throw new Error("That family code didn’t match, or it has no kids yet.");
      setKids(list);
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function pick(kidId: string) {
    setErr("");
    setBusy(true);
    try {
      const sb = supabaseBrowser();
      const { data } = await sb.auth.getSession();
      if (!data.session) {
        const anon = await sb.auth.signInAnonymously();
        if (anon.error) throw anon.error;
      }
      await api.requestDevice(code.trim(), kidId, navigator.userAgent.slice(0, 40));
      onRequested();
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <div style={{ fontSize: 40 }}>🧒</div>
      <h2 style={{ margin: 0 }}>Join your family</h2>
      {!kids ? (
        <div className="stack">
          <div className="field">
            <label>Family code</label>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123" style={{ textAlign: "center", letterSpacing: 4, fontSize: 20 }} />
          </div>
          {err && <div className="err">{err}</div>}
          <button className="btn" disabled={busy || code.length < 4} onClick={findFamily}>
            {busy ? "…" : "Find my family"}
          </button>
          <button className="linkbtn" onClick={onBack}>
            ← Back
          </button>
        </div>
      ) : (
        <>
          <div className="muted">Tap your avatar</div>
          <div className="avatar-pick">
            {kids.map((k) => (
              <button key={k.id} className="kidbtn" style={{ ["--kc" as string]: k.color, minWidth: 90, flex: "0 0 auto" }} disabled={busy} onClick={() => pick(k.id)}>
                <span className="em">{k.emoji}</span>
                {k.name}
              </button>
            ))}
          </div>
          {err && <div className="err">{err}</div>}
          <button className="linkbtn" onClick={() => setKids(null)}>
            ← Different family
          </button>
        </>
      )}
    </div>
  );
}

export function KidWaiting({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="center-screen">
      <div className="spinner" />
      <h2 style={{ margin: 0 }}>Waiting for a parent…</h2>
      <div className="muted" style={{ maxWidth: 300 }}>
        Ask a parent to open <b>Admin → Device approvals</b> and tap <b>Approve</b>. This screen unlocks
        automatically.
      </div>
      <button className="linkbtn" onClick={onSignOut}>
        Cancel
      </button>
    </div>
  );
}

export { EMOJIS };
