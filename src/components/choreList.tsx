"use client";
import React, { useState } from "react";
import { useApp } from "@/components/provider";
import { claimChore, markDone, friendlyError } from "@/lib/api";
import { FREQ_LABEL, half, starStr } from "@/lib/format";
import type { ChoreWithEntries } from "@/lib/types";

function activeThisWeek(c: ChoreWithEntries, biweeklyOn: boolean) {
  if (c.freq === "ondemand") return !!c.active;
  return c.freq !== "biweekly" || biweeklyOn;
}

export function ChoreList({ scope }: { scope: "today" | "weekly" }) {
  const { snap, selectedKid, run, burst, toast, refresh } = useApp();
  const [pulse, setPulse] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const kidById = (id: string) => snap.kids.find((k) => k.id === id);
  const mult = snap.settings.mult as number[];

  const chores = snap.chores.filter((c) => {
    if (!activeThisWeek(c, snap.biweeklyOn)) return false;
    if (scope === "today") return c.freq === "daily" || c.freq === "twice_daily" || c.freq === "ondemand";
    return c.freq === "weekly" || c.freq === "biweekly";
  });

  if (!chores.length) return <div className="muted">No chores here yet.</div>;

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
        const mine = entries.find((e) => e.kid_id === selectedKid);
        const others = entries.filter((e) => e.kid_id !== selectedKid);
        const nodes: React.ReactNode[] = [];

        if (c.description) {
          nodes.push(
            <button
              key="help"
              className="help-btn"
              aria-label="What’s this chore?"
              onClick={() => setInfo(info === c.id ? null : c.id)}
            >
              ?
            </button>
          );
        }

        // other kids' status on this chore (informational)
        others.forEach((e) => {
          const who = kidById(e.kid_id);
          if (e.status === "rated")
            nodes.push(
              <span key={e.id} className="chip green">
                {starStr(e.stars)} {who?.name} +{e.earned}
              </span>
            );
          else if (e.status === "pending")
            nodes.push(
              <span key={e.id} className="chip orange">
                ⏳ {who?.name} — quality check
              </span>
            );
          else
            nodes.push(
              <span key={e.id} className="chip claimed">
                🙌 {who?.name} is on it
              </span>
            );
        });

        // exactly one control for the current kid
        if (mine) {
          if (mine.status === "claimed")
            nodes.push(
              <button
                key="done"
                className="btn green small"
                onClick={(e) =>
                  run(() => markDone(mine.id, selectedKid), "Nice! Waiting for a parent quality check 🔍", e, ["✅", "🎉", "⭐", "💪"])
                }
              >
                Done ✓
              </button>
            );
          else if (mine.status === "pending")
            nodes.push(
              <span key="mine" className="chip orange">
                ⏳ You — quality check
              </span>
            );
          else
            nodes.push(
              <span key="mine" className="chip green">
                {starStr(mine.stars)} You +{mine.earned}
              </span>
            );
        } else if (used < limit) {
          nodes.push(
            <button key="onit" className="btn small onit" onClick={(e) => onIt(e, c.id)}>
              On it! ✋
            </button>
          );
        }

        return (
          <div className="chore-wrap" key={c.id}>
            <div className={"chore" + (c.freq === "ondemand" ? " hotspot" : "") + (pulse === c.id ? " claiming" : "")}>
              <div className="ptbadge">
                <b>{c.base_pts}</b>
                <span>pts</span>
              </div>
              <span className="cem">{c.emoji || "🧩"}</span>
              <div className="grow" onClick={() => c.description && setInfo(info === c.id ? null : c.id)} style={c.description ? { cursor: "pointer" } : undefined}>
                <div className="ttl">{c.title}</div>
                <div className="meta">
                  {FREQ_LABEL[c.freq]} · <b style={{ color: "var(--brand)" }}>★★★ pays {half(c.base_pts * mult[2])}</b>
                </div>
              </div>
              <div className="row" style={{ gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {nodes}
              </div>
            </div>
            {info === c.id && c.description && <div className="chore-desc">{c.description}</div>}
          </div>
        );
      })}
    </>
  );
}
