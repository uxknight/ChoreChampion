"use client";
import React, { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { loadSnapshot } from "@/lib/api";
import { AppProvider } from "@/components/provider";
import { AppShell } from "@/components/shell";
import { Landing, ParentAuth, ParentOnboard, KidOnboard, KidWaiting } from "@/components/auth";
import type { FamilySnapshot } from "@/lib/types";

type Phase = "loading" | "landing" | "parent" | "parent-onboard" | "kid" | "kid-wait" | "app";

export default function Page() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [snap, setSnap] = useState<FamilySnapshot | null>(null);

  const gate = useCallback(async () => {
    const sb = supabaseBrowser();
    const {
      data: { session },
    } = await sb.auth.getSession();
    if (!session) {
      setPhase((p) => (p === "parent" || p === "kid" ? p : "landing"));
      return;
    }
    const s = await loadSnapshot();
    if (s) {
      setSnap(s);
      setPhase("app");
      return;
    }
    if (session.user.is_anonymous) {
      const { data } = await sb
        .from("device_registrations")
        .select("approved")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();
      setPhase(data ? "kid-wait" : "kid");
    } else {
      setPhase("parent-onboard");
    }
  }, []);

  useEffect(() => {
    // gate() is async; any setState happens after an await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void gate();
    const { data } = supabaseBrowser().auth.onAuthStateChange(() => void gate());
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => data.subscription.unsubscribe();
  }, [gate]);

  // While a kid device waits for approval, poll for the unlock.
  useEffect(() => {
    if (phase !== "kid-wait") return;
    const t = setInterval(() => void gate(), 4000);
    return () => clearInterval(t);
  }, [phase, gate]);

  const signOut = async () => {
    await supabaseBrowser().auth.signOut();
    setPhase("landing");
  };

  if (phase === "loading")
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  if (phase === "app" && snap)
    return (
      <AppProvider initial={snap}>
        <AppShell />
      </AppProvider>
    );
  if (phase === "parent") return <ParentAuth onBack={() => setPhase("landing")} onDone={() => void gate()} />;
  if (phase === "parent-onboard") return <ParentOnboard onDone={() => void gate()} />;
  if (phase === "kid") return <KidOnboard onBack={() => setPhase("landing")} onRequested={() => setPhase("kid-wait")} />;
  if (phase === "kid-wait") return <KidWaiting onSignOut={signOut} />;
  return <Landing onPick={(m) => setPhase(m)} />;
}
