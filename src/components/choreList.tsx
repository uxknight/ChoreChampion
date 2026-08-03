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
        const nodes: React.ReactNode[] = [];

        entries.forEach((entry) => {
          const who = kidById(entry.kid_id);
          if (entry.status === "rated") {
            nodes.push(
              <span key={entry.id} className="chip green">
                {starStr(entry.stars)} {who?.name} +{entry.earned}
              </span>
            );
          } else if (entry.status === "pending") {
            nodes.push(
              <span key={entry.id} className="chip orange">
                ⏳ {who?.name} — quality check
              </span>
            );
          } else {
            // claimed reservation
            if (entry.kid_id === selectedKid) {
              nodes.push(
                <button
                  key={entry.id}
                  className="btn green small"
                  onClick={(e) =>
                    run(() => markDone(entry.id, selectedKid), "Nice! Waiting for a parent quality check 🔍", e, ["✅", "🎉", "⭐", "💪"])
                  }
                >
                  Done ✓
                </button>
              );
            } else {
              nodes.push(
                <span key={entry.id} className="chip claimed">
                  🙌 {who?.name} is on it
                </span>
              );
            }
          }
        });

        if (used < limit) {
          nodes.push(
            <button key="onit" className="btn small onit" onClick={(e) => onIt(e, c.id)}>
              On it! ✋
            </button>
          );
        }

        return (
          <div
            className={"chore" + (c.freq === "ondemand" ? " hotspot" : "") + (pulse === c.id ? " claiming" : "")}
            key={c.id}
          >
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
