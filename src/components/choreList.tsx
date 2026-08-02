"use client";
import React from "react";
import { useApp } from "@/components/provider";
import { claimChore } from "@/lib/api";
import { FREQ_LABEL, half, starStr } from "@/lib/format";
import type { ChoreWithEntries } from "@/lib/types";

function activeThisWeek(c: ChoreWithEntries, biweeklyOn: boolean) {
  if (c.freq === "ondemand") return !!c.active;
  return c.freq !== "biweekly" || biweeklyOn;
}

export function ChoreList({ scope }: { scope: "today" | "week" }) {
  const { snap, selectedKid, run } = useApp();
  const kidById = (id: string) => snap.kids.find((k) => k.id === id);

  const chores = snap.chores.filter((c) => {
    if (!activeThisWeek(c, snap.biweeklyOn)) return false;
    if (scope === "today") return c.freq === "daily" || c.freq === "twice_daily" || c.freq === "ondemand";
    return true;
  });

  if (!chores.length) return <div className="muted">No chores here yet.</div>;

  return (
    <>
      {chores.map((c) => {
        const entries = c.period_entries || [];
        const used = entries.length;
        const limit = c.freq === "twice_daily" ? 2 : 1;
        const mult = snap.settings.mult as number[];
        let right: React.ReactNode;

        if (used >= limit) {
          const last = entries[entries.length - 1];
          const who = kidById(last.kid_id);
          right =
            last.status === "pending" ? (
              <span className="chip orange">⏳ {who?.name} — quality check</span>
            ) : (
              <span className="chip green">
                {starStr(last.stars)} {who?.name} +{last.earned}
              </span>
            );
        } else {
          const btn = (
            <button
              className="btn green small"
              onClick={(e) =>
                run(
                  () => claimChore(c.id, selectedKid),
                  "Nice! Waiting for a parent quality check 🔍",
                  e,
                  ["✅", "🎉", "⭐", "💪"]
                )
              }
            >
              Done! ✓
            </button>
          );
          right =
            c.freq === "twice_daily" && used === 1 ? (
              <>
                <span className="chip green" style={{ marginRight: 6 }}>
                  1/2 ✓
                </span>
                {btn}
              </>
            ) : (
              btn
            );
        }

        return (
          <div className={"chore" + (c.freq === "ondemand" ? " hotspot" : "")} key={c.id}>
            <div className="ptbadge">
              <b>{c.base_pts}</b>
              <span>pts</span>
            </div>
            <span className="cem">{c.emoji || "🧩"}</span>
            <div className="grow">
              <div className="ttl">{c.title}</div>
              <div className="meta">
                {FREQ_LABEL[c.freq]} ·{" "}
                <b style={{ color: "var(--brand)" }}>★★★ pays {half(c.base_pts * mult[2])}</b>
              </div>
            </div>
            {right}
          </div>
        );
      })}
    </>
  );
}
