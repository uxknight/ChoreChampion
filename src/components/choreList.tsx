"use client";
import React, { useState } from "react";
import { useApp } from "@/components/provider";
import { claimChore, markDone, cancelClaim, friendlyError } from "@/lib/api";
import { FREQ_LABEL, half, starStr } from "@/lib/format";
import type { ChoreWithEntries } from "@/lib/types";

function activeThisWeek(c: ChoreWithEntries, biweeklyOn: boolean) {
  if (c.freq === "ondemand") return !!c.active;
  return c.freq !== "biweekly" || biweeklyOn;
}

// ---- available chores (not yet accepted by this kid) ----------------------
export function ChoreList({ scope }: { scope: "today" | "weekly" }) {
  const { snap, selectedKid, burst, toast, refresh } = useApp();
  const [pulse, setPulse] = useState<string | null>(null);
  const kidById = (id: string) => snap.kids.find((k) => k.id === id);
  const mult = snap.settings.mult as number[];

  const chores = snap.chores.filter((c) => {
    if (!activeThisWeek(c, snap.biweeklyOn)) return false;
    const inScope = scope === "today" ? c.freq === "daily" || c.freq === "twice_daily" || c.freq === "ondemand" : c.freq === "weekly" || c.freq === "biweekly";
    if (!inScope) return false;
    // hide chores this kid is already on (they live in the "You're on it" section)
    const mine = (c.period_entries || []).find((e) => e.kid_id === selectedKid);
    if (mine && (mine.status === "claimed" || mine.status === "pending")) return false;
    return true;
  });

  if (!chores.length) return <div className="muted">Nothing up for grabs right now.</div>;

  async function onIt(e: React.MouseEvent, choreId: string) {
    setPulse(choreId);
    burst(e, ["🙌", "✨", "💪"]);
    try {
      await claimChore(choreId, selectedKid);
      toast("You’re on it! 💪");
      await refresh();
    } catch (err) {
      toast(friendlyError(err));
    } finally {
      setTimeout(() => setPulse(null), 650);
    }
  }

  return (
    <>
      {chores.map((c) => {
        const entries = c.period_entries || [];
        const used = entries.length;
        const limit = c.freq === "twice_daily" ? 2 : 1;
        const mine = entries.find((e) => e.kid_id === selectedKid); // only 'rated' possible here
        const others = entries.filter((e) => e.kid_id !== selectedKid);
        const nodes: React.ReactNode[] = [];

        others.forEach((e) => {
          const who = kidById(e.kid_id);
          if (e.status === "rated")
            nodes.push(<span key={e.id} className="chip green">{starStr(e.stars)} {who?.name} +{e.earned}</span>);
          else if (e.status === "pending")
            nodes.push(<span key={e.id} className="chip orange">⏳ {who?.name} — quality check</span>);
          else nodes.push(<span key={e.id} className="chip claimed">🙌 {who?.name} is on it</span>);
        });

        if (mine && mine.status === "rated")
          nodes.push(<span key="mine" className="chip green">{starStr(mine.stars)} You +{mine.earned}</span>);
        if (used < limit)
          nodes.push(
            <button key="onit" className="btn small onit" onClick={(e) => onIt(e, c.id)}>
              On it! ✋
            </button>
          );

        return (
          <div className={"chore" + (c.freq === "ondemand" ? " hotspot" : "") + (pulse === c.id ? " claiming" : "")} key={c.id}>
            <div className="ptbadge">
              <b>{c.base_pts}</b>
              <span>pts</span>
            </div>
            <span className="cem">{c.emoji || "🧩"}</span>
            <div className="grow">
              <div className="ttl">{c.title}</div>
              <div className="meta">
                {FREQ_LABEL[c.freq]} · <b style={{ color: "var(--brand)" }}>★★★ pays {half(c.base_pts * mult[2])}</b>
              </div>
            </div>
            <div className="row" style={{ gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {nodes}
            </div>
          </div>
        );
      })}
    </>
  );
}

// ---- "You're on it" — chores this kid has accepted (claimed/pending) -------
export function InProgress() {
  const { snap, selectedKid, run, toast, refresh } = useApp();
  const items: { c: ChoreWithEntries; e: ChoreWithEntries["period_entries"][number] }[] = [];
  snap.chores.forEach((c) => {
    (c.period_entries || []).forEach((e) => {
      if (e.kid_id === selectedKid && (e.status === "claimed" || e.status === "pending")) items.push({ c, e });
    });
  });
  if (!items.length) return null;

  async function doCancel(completionId: string) {
    try {
      await cancelClaim(completionId, selectedKid);
      toast("Released — back up for grabs.");
      await refresh();
    } catch (err) {
      toast(friendlyError(err));
    }
  }

  return (
    <div className="card">
      <h3>🙌 You’re on it</h3>
      {items.map(({ c, e }) => (
        <div className="chore-wrap" key={e.id}>
          <div className="chore" style={{ borderBottom: "none" }}>
            <div className="ptbadge">
              <b>{c.base_pts}</b>
              <span>pts</span>
            </div>
            <span className="cem">{c.emoji || "🧩"}</span>
            <div className="grow">
              <div className="ttl">{c.title}</div>
              <div className="meta">{FREQ_LABEL[c.freq]}</div>
            </div>
            {e.status === "claimed" ? (
              <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                <button className="btn ghost tiny" onClick={() => doCancel(e.id)}>
                  Cancel
                </button>
                <button
                  className="btn green small"
                  onClick={(ev) => run(() => markDone(e.id, selectedKid), "Nice! Waiting for a parent quality check 🔍", ev, ["✅", "🎉", "⭐", "💪"])}
                >
                  Done ✓
                </button>
              </div>
            ) : (
              <span className="chip orange">⏳ Waiting for a parent</span>
            )}
          </div>
          {c.description && <div className="chore-desc">{c.description}</div>}
        </div>
      ))}
    </div>
  );
}
