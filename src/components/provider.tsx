"use client";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { loadSnapshot, friendlyError } from "@/lib/api";
import type { FamilySnapshot } from "@/lib/types";

type Mouseish = { clientX?: number; clientY?: number };

type Ctx = {
  snap: FamilySnapshot;
  isParent: boolean;
  refresh: () => Promise<void>;
  selectedKid: string;
  setSelectedKid: (id: string) => void;
  toast: (m: string) => void;
  burst: (e?: Mouseish | null, emojis?: string[]) => void;
  run: (fn: () => Promise<unknown>, ok?: string, ev?: Mouseish, emojis?: string[]) => Promise<void>;
};

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp used outside AppProvider");
  return c;
};

export function AppProvider({ initial, children }: { initial: FamilySnapshot; children: React.ReactNode }) {
  const [snap, setSnap] = useState<FamilySnapshot>(initial);
  const isParent = snap.viewer.kind === "parent";

  // Parents can switch kids; a kid device is pinned to its own profile.
  const defaultKid = isParent ? snap.kids[0]?.id ?? "" : snap.viewer.profileId ?? snap.kids[0]?.id ?? "";
  const [selectedKid, setSelectedKid] = useState<string>(defaultKid);

  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((m: string) => {
    setToastMsg(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2600);
  }, []);

  const burst = useCallback((ev?: Mouseish | null, emojis?: string[]) => {
    const em = emojis || ["🎉", "⭐", "✨", "🎊", "💜"];
    const x = ev?.clientX ?? window.innerWidth / 2;
    const y = ev?.clientY ?? window.innerHeight / 2;
    for (let i = 0; i < 22; i++) {
      const p = document.createElement("span");
      p.className = "particle";
      p.textContent = em[i % em.length];
      p.style.left = x + "px";
      p.style.top = y + "px";
      document.body.appendChild(p);
      const a = Math.random() * Math.PI * 2,
        r = 60 + Math.random() * 130;
      requestAnimationFrame(() => {
        p.style.transform = `translate(${Math.cos(a) * r}px,${Math.sin(a) * r - 40}px) rotate(${Math.random() * 360}deg)`;
        p.style.opacity = "0";
      });
      setTimeout(() => p.remove(), 1100);
    }
  }, []);

  const refresh = useCallback(async () => {
    const next = await loadSnapshot();
    if (next) setSnap(next);
  }, []);

  const run = useCallback(
    async (fn: () => Promise<unknown>, ok?: string, ev?: Mouseish, emojis?: string[]) => {
      try {
        await fn();
        if (emojis) burst(ev ?? null, emojis);
        if (ok) toast(ok);
        await refresh();
      } catch (e) {
        toast(friendlyError(e));
      }
    },
    [burst, toast, refresh]
  );

  // keep the selected kid valid across refreshes (parent view)
  useEffect(() => {
    // Correct a stale selection (e.g. a kid was removed). Terminal: once fixed the
    // guard is false, so it cannot cascade.
    if (isParent && !snap.kids.some((k) => k.id === selectedKid) && snap.kids[0]) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedKid(snap.kids[0].id);
    }
  }, [snap.kids, selectedKid, isParent]);

  // realtime: refresh on any completion/profile change in this family
  useEffect(() => {
    const c = supabaseBrowser();
    const fam = initial.familyId;
    const ch = c
      .channel("family:" + fam)
      .on("postgres_changes", { event: "*", schema: "public", table: "completions", filter: `family_id=eq.${fam}` }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `family_id=eq.${fam}` }, () => void refresh())
      .subscribe();
    return () => {
      void c.removeChannel(ch);
    };
  }, [initial.familyId, refresh]);

  return (
    <AppCtx.Provider value={{ snap, isParent, refresh, selectedKid, setSelectedKid, toast, burst, run }}>
      {children}
      <div id="toast" className={toastMsg ? "show" : ""}>
        {toastMsg}
      </div>
    </AppCtx.Provider>
  );
}
