"use client";
import React, { useEffect, useRef } from "react";
import { useApp } from "@/components/provider";
import { markAlertSeen } from "@/lib/api";

const RISING = ["🎈", "🎉", "🎊", "⭐", "✨", "🌟", "🥳", "🎆", "💜", "🧡", "💛", "💚"];

// Full-screen "moment" a kid sees when a parent awarded or docked points.
export function Celebration() {
  const { snap, selectedKid, burst, refresh } = useApp();
  const alerts = snap.pointAlerts.filter((x) => x.kid_id === selectedKid);
  const a = alerts[0];
  const fired = useRef<string | null>(null);

  useEffect(() => {
    if (a && a.kind === "award" && fired.current !== a.id) {
      fired.current = a.id;
      const em = ["🎉", "🎊", "✨", "⭐", "💜", "🥳", "🎆", "🌈"];
      for (let i = 0; i < 4; i++) setTimeout(() => burst(null, em), i * 350);
    }
  }, [a, burst]);

  if (!a) return null;
  const award = a.kind === "award";
  const amount = Math.abs(Number(a.delta));

  const dismiss = async () => {
    try {
      await markAlertSeen(a.id);
    } catch {
      /* ignore */
    }
    await refresh();
  };

  return (
    <div className={"celebrate-overlay " + (award ? "award" : "deduct")}>
      {award && (
        <div className="celebrate-sky">
          {RISING.map((e, i) => (
            <span
              key={i}
              className="rise"
              style={{ left: `${(i * 8 + 4) % 96}%`, animationDelay: `${(i % 6) * 0.4}s`, animationDuration: `${3 + (i % 4)}s` }}
            >
              {e}
            </span>
          ))}
        </div>
      )}
      <div className="celebrate-card">
        <div className="celebrate-face">{award ? "🥳" : "😢"}</div>
        <div className="celebrate-delta">
          {award ? "+" : "−"}
          {amount} {amount === 1 ? "point" : "points"}
        </div>
        <div className="celebrate-msg">“{a.title}”</div>
        <div className="celebrate-sub">— from your parent {award ? "💛" : ""}</div>
        {award && <div className="celebrate-dance">🕺💃</div>}
        <button className={"btn celebrate-btn" + (award ? "" : " red")} onClick={dismiss}>
          {award ? "Woohoo! 🎉" : "Okay 😔"}
        </button>
      </div>
    </div>
  );
}
