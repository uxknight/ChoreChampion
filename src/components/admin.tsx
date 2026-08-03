"use client";
import React, { useState } from "react";
import { useApp } from "@/components/provider";
import { FormModal, type Field } from "@/components/modal";
import { supabaseBrowser } from "@/lib/supabase/client";
import * as api from "@/lib/api";
import { friendlyError } from "@/lib/api";
import { money as fmtMoney, starStr, half } from "@/lib/format";
import { FREQ_OPTIONS } from "@/lib/format";

type ModalState =
  | { kind: "chore"; id?: string }
  | { kind: "deduction"; id?: string }
  | { kind: "reward"; id?: string }
  | { kind: "ellie"; id?: string }
  | { kind: "settings" }
  | null;

export function AdminView() {
  const { snap, toast, burst, refresh, run, confirm } = useApp();
  const s = snap.settings;
  const mult = s.mult as number[];
  const money = (p: number) => fmtMoney(p, s.point_value);
  const [modal, setModal] = useState<ModalState>(null);

  const pending = snap.completions.filter((e) => e.status === "pending");
  const kidById = (id: string) => snap.kids.find((k) => k.id === id);
  const pointKids = snap.kids.filter((k) => k.mode === "points");

  async function doRate(ev: React.MouseEvent, id: string, stars: number, kidName: string) {
    try {
      const res = await api.rate(id, stars);
      let msg = `${kidName} earned ${res.earned} pts (${starStr(stars)})`;
      if (res.streak_bonus > 0) {
        msg += ` · 🔥 streak! +${res.streak_bonus} bonus!`;
        burst(ev, ["🔥", "⭐", "🎉"]);
      }
      toast(msg);
      await refresh();
    } catch (e) {
      toast(friendlyError(e));
    }
  }

  async function doRoomCheck(ev: React.MouseEvent) {
    try {
      const res = await api.roomCheck();
      if (res.bonus) {
        burst(ev, ["🏠", "✨", "🎉"]);
        toast(`🏠 CLEAN STREAK! +${res.bonus_pts} pts each!`);
      } else toast("Clean check logged ✓ Streak grows…");
      await refresh();
    } catch (e) {
      toast(friendlyError(e));
    }
  }

  async function doTally() {
    const lines = pointKids.map((k) => `${k.emoji} ${k.name}: ${k.week} pts (${money(k.week)})`).join("\n");
    if (!(await confirm(`Run the Sunday Tally?\n\n${lines}\n\nWeekly counters reset.`, { confirmLabel: "Run payday" }))) return;
    try {
      const res = await api.runTally();
      toast(res.ran ? "💰 Payday! Weekly points banked." : "Tally already ran this week.");
      await refresh();
    } catch (e) {
      toast(friendlyError(e));
    }
  }

  async function doToggleHotspot(id: string) {
    try {
      const active = await api.toggleHotspot(id);
      toast(active ? "🔔 Hotspot live! It’s on the kids’ board now." : "Hotspot deactivated.");
      await refresh();
    } catch (e) {
      toast(friendlyError(e));
    }
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "chore-champions-backup-" + snap.today + ".json";
    a.click();
  }

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    window.location.reload();
  }

  const hotspots = snap.chores.filter((c) => c.freq === "ondemand");

  return (
    <>
      {/* pending device approvals */}
      {snap.pendingDevices.length > 0 && (
        <div className="card">
          <h3>
            📱 Device approvals <span className="chip red">{snap.pendingDevices.length}</span>
          </h3>
          {snap.pendingDevices.map((d) => {
            const k = kidById(d.kid_id);
            return (
              <div className="adminrow" key={d.id}>
                <div className="grow">
                  {k?.emoji} {k?.name}
                  <div className="muted">{d.device_label || "new device"}</div>
                </div>
                <button className="btn green tiny" onClick={() => run(() => api.approveDevice(d.id, true), "Device approved ✓")}>
                  Approve
                </button>
                <button className="btn ghost tiny" onClick={() => run(() => api.approveDevice(d.id, false), "Device rejected")}>
                  Reject
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* pending reviews */}
      <div className="card">
        <h3>
          🔍 Quality checks pending <span className="chip red">{pending.length}</span>
        </h3>
        {pending.length ? (
          pending.map((e) => {
            const k = kidById(e.kid_id);
            return (
              <div key={e.id} style={{ padding: "10px 0", borderBottom: "1px dashed #eee" }}>
                <div className="row">
                  <div className="grow">
                    <div className="ttl" style={{ fontWeight: 700, fontSize: 14 }}>
                      {e.title_snapshot}
                    </div>
                    <div className="meta">
                      {k?.emoji} {k?.name} · {e.occurred_on} · base {e.pts_snapshot} pts
                    </div>
                  </div>
                </div>
                <div className="ratebtns">
                  {[1, 2, 3].map((st) => (
                    <button key={st} onClick={(ev) => doRate(ev, e.id, st, k?.name ?? "")}>
                      {starStr(st).slice(0, 3)}
                      <small>{half(e.pts_snapshot * mult[st - 1])} pts</small>
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          <div className="muted">Nothing waiting. ✨</div>
        )}
      </div>

      {/* daily ops */}
      <div className="card">
        <h3>🛠️ Daily ops</h3>
        <div className="row" style={{ marginBottom: 10 }}>
          <button className="btn green grow" disabled={snap.roomCheckToday} onClick={doRoomCheck}>
            🏠 Room check: all clear{snap.roomCheckToday ? " (done today)" : ""}
          </button>
        </div>
        <div className="muted" style={{ marginBottom: 6 }}>
          Or apply a deduction (hits both kids, shared-pool rule):
        </div>
        {snap.deductions.map((d) => (
          <div className="adminrow" key={d.id}>
            <div className="grow">
              {d.title} <span className="chip red">−{d.pts} each</span>
            </div>
            <button
              className="btn red tiny"
              onClick={async () => {
                const ok = await confirm(`Apply "${d.title}"?\n\n−${d.pts} pts to EACH kid (shared-pool rule). Clean streaks reset.`, {
                  confirmLabel: "Apply deduction",
                  danger: true,
                });
                if (!ok) return;
                run(() => api.applyDeduction(d.id), "Deduction applied. Streaks reset. 🏚️");
              }}
            >
              Apply
            </button>
            <button className="btn ghost tiny" onClick={() => setModal({ kind: "deduction", id: d.id })}>
              ✎
            </button>
            <button
              className="btn ghost tiny"
              onClick={async () => (await confirm("Delete this rule?", { danger: true })) && run(() => api.softDelete("deduction_rules", d.id))}
            >
              🗑
            </button>
          </div>
        ))}
        <button className="btn ghost small" style={{ marginTop: 8 }} onClick={() => setModal({ kind: "deduction" })}>
          ＋ Add deduction rule
        </button>
      </div>

      {/* tally */}
      <div className="card">
        <h3>💰 Sunday tally</h3>
        <div className="muted" style={{ marginBottom: 8 }}>
          {pointKids.map((k) => `${k.emoji} ${k.name}: ${k.week} pts (${money(k.week)})`).join(" · ")}
        </div>
        <button className="btn orange" style={{ width: "100%" }} onClick={doTally}>
          Run payday tally 🎉{snap.tallyRanThisWeek ? " (already ran)" : ""}
        </button>
      </div>

      {/* hotspots */}
      <div className="card">
        <h3>🔔 Hotspots</h3>
        <div className="muted" style={{ marginBottom: 6 }}>
          Activate a hotspot to make it appear on the kids’ board. It disappears once claimed.
        </div>
        {hotspots.length ? (
          hotspots.map((c) => (
            <div className="adminrow" key={c.id}>
              <div className="grow">
                {c.emoji} {c.title} <span className={"chip " + (c.active ? "green" : "red")}>{c.active ? "LIVE" : "off"}</span>
              </div>
              <button className={"btn " + (c.active ? "red" : "green") + " tiny"} onClick={() => doToggleHotspot(c.id)}>
                {c.active ? "Deactivate" : "Activate 🔔"}
              </button>
            </div>
          ))
        ) : (
          <div className="muted">No hotspot chores yet — add one below with frequency “Hotspot”.</div>
        )}
      </div>

      {/* manage chores */}
      <div className="card">
        <h3>🧹 Paid chores</h3>
        {snap.chores.map((c) => (
          <div className="adminrow" key={c.id}>
            <div className="grow">
              {c.emoji} {c.title}
              <div className="muted">
                {c.base_pts} pts · {c.freq}
              </div>
            </div>
            <button className="btn ghost tiny" onClick={() => setModal({ kind: "chore", id: c.id })}>
              ✎
            </button>
            <button
              className="btn ghost tiny"
              onClick={async () => (await confirm("Delete this chore?", { danger: true })) && run(() => api.softDelete("chores", c.id))}
            >
              🗑
            </button>
          </div>
        ))}
        <button className="btn ghost small" style={{ marginTop: 8 }} onClick={() => setModal({ kind: "chore" })}>
          ＋ Add paid chore
        </button>
      </div>

      {/* manage rewards */}
      <div className="card">
        <h3>🎁 Rewards catalog</h3>
        {snap.rewards.map((r) => (
          <div className="adminrow" key={r.id}>
            <div className="grow">
              {r.title}
              <div className="muted">
                {r.cost_pts} pts ({money(r.cost_pts)}) · {r.type === "goal" ? "savings goal" : "instant"}
              </div>
            </div>
            <button className="btn ghost tiny" onClick={() => setModal({ kind: "reward", id: r.id })}>
              ✎
            </button>
            <button
              className="btn ghost tiny"
              onClick={async () => (await confirm("Delete this reward?", { danger: true })) && run(() => api.softDelete("rewards", r.id))}
            >
              🗑
            </button>
          </div>
        ))}
        <button className="btn ghost small" style={{ marginTop: 8 }} onClick={() => setModal({ kind: "reward" })}>
          ＋ Add reward
        </button>
      </div>

      {/* Ellie prizes */}
      <div className="card">
        <h3>🐣 Ellie’s prizes</h3>
        {snap.ellieRewards.map((r) => (
          <div className="adminrow" key={r.id}>
            <div className="grow">
              {r.title}
              <div className="muted">{r.stickers} stickers</div>
            </div>
            <button className="btn ghost tiny" onClick={() => setModal({ kind: "ellie", id: r.id })}>
              ✎
            </button>
            <button
              className="btn ghost tiny"
              onClick={async () => (await confirm("Delete this prize?", { danger: true })) && run(() => api.softDelete("ellie_rewards", r.id))}
            >
              🗑
            </button>
          </div>
        ))}
        <button className="btn ghost small" style={{ marginTop: 8 }} onClick={() => setModal({ kind: "ellie" })}>
          ＋ Add Ellie prize
        </button>
      </div>

      {/* system */}
      <div className="card">
        <h3>⚙️ System</h3>
        <div className="muted" style={{ marginBottom: 8 }}>
          1 pt = {money(1)} · ★×{mult[0]} ★★×{mult[1]} ★★★×{mult[2]} · streaks: {s.personal_streak_days}d/+
          {s.personal_streak_bonus} & {s.quality_streak_len}×★★★/+{s.quality_streak_bonus}
        </div>
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          <button className="btn small" onClick={() => setModal({ kind: "settings" })}>
            Edit settings
          </button>
          <button className="btn ghost small" onClick={exportBackup}>
            Export backup
          </button>
          <button className="btn ghost small" onClick={signOut}>
            Sign out 🔒
          </button>
        </div>
      </div>

      {modal && (
        <CatalogModal
          modal={modal}
          familyId={snap.familyId}
          onClose={() => setModal(null)}
          afterSave={async () => {
            setModal(null);
            await refresh();
          }}
          onError={(e) => toast(friendlyError(e))}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
function CatalogModal({
  modal,
  familyId,
  onClose,
  afterSave,
  onError,
}: {
  modal: NonNullable<ModalState>;
  familyId: string;
  onClose: () => void;
  afterSave: () => Promise<void>;
  onError: (e: unknown) => void;
}) {
  const { snap, toast } = useApp();

  if (modal.kind === "chore") {
    const c = modal.id ? snap.chores.find((x) => x.id === modal.id) : undefined;
    const fields: Field[] = [
      { label: "Emoji", value: c?.emoji || "🧩" },
      { label: "Description", value: c?.title ?? "" },
      { label: "Base points", type: "number", step: "0.5", value: c?.base_pts ?? 1 },
      { label: "Frequency", options: FREQ_OPTIONS, value: c?.freq ?? "daily" },
    ];
    return (
      <FormModal
        title={modal.id ? "Edit chore" : "New paid chore"}
        fields={fields}
        onCancel={onClose}
        onSave={async (v) => {
          if (!v[1] || !(Number(v[2]) > 0)) return toast("Need a description and points.");
          try {
            await api.upsertChore({ id: modal.id, emoji: String(v[0]), title: String(v[1]), base_pts: Number(v[2]), freq: String(v[3]), family_id: familyId });
            await afterSave();
          } catch (e) {
            onError(e);
          }
        }}
      />
    );
  }

  if (modal.kind === "deduction") {
    const d = modal.id ? snap.deductions.find((x) => x.id === modal.id) : undefined;
    return (
      <FormModal
        title={modal.id ? "Edit deduction rule" : "New deduction rule"}
        fields={[
          { label: "Description", value: d?.title ?? "" },
          { label: "Points deducted (each kid)", type: "number", step: "0.5", value: d?.pts ?? 1 },
        ]}
        onCancel={onClose}
        onSave={async (v) => {
          if (!v[0] || !(Number(v[1]) > 0)) return toast("Need a description and points.");
          try {
            await api.upsertDeduction({ id: modal.id, title: String(v[0]), pts: Number(v[1]), family_id: familyId });
            await afterSave();
          } catch (e) {
            onError(e);
          }
        }}
      />
    );
  }

  if (modal.kind === "reward") {
    const r = modal.id ? snap.rewards.find((x) => x.id === modal.id) : undefined;
    return (
      <FormModal
        title={modal.id ? "Edit reward" : "New reward"}
        fields={[
          { label: "Title", value: r?.title ?? "" },
          { label: "Cost (points)", type: "number", step: "1", value: r?.cost_pts ?? 20 },
          { label: "Type", options: [{ v: "spend", t: "Instant redeem" }, { v: "goal", t: "Savings goal (tracker)" }], value: r?.type ?? "spend" },
          { label: "Note (shown to kids)", value: r?.note ?? "" },
        ]}
        onCancel={onClose}
        onSave={async (v) => {
          if (!v[0] || !(Number(v[1]) > 0)) return toast("Need a title and cost.");
          try {
            await api.upsertReward({ id: modal.id, title: String(v[0]), cost_pts: Number(v[1]), type: String(v[2]), note: String(v[3]), family_id: familyId });
            await afterSave();
          } catch (e) {
            onError(e);
          }
        }}
      />
    );
  }

  if (modal.kind === "ellie") {
    const r = modal.id ? snap.ellieRewards.find((x) => x.id === modal.id) : undefined;
    return (
      <FormModal
        title={modal.id ? "Edit Ellie reward" : "New Ellie reward"}
        fields={[
          { label: "Title", value: r?.title ?? "" },
          { label: "Stickers needed", type: "number", step: "1", value: r?.stickers ?? 10 },
        ]}
        onCancel={onClose}
        onSave={async (v) => {
          if (!v[0] || !(Number(v[1]) > 0)) return toast("Need a title and sticker count.");
          try {
            await api.upsertEllieReward({ id: modal.id, title: String(v[0]), stickers: Number(v[1]), family_id: familyId });
            await afterSave();
          } catch (e) {
            onError(e);
          }
        }}
      />
    );
  }

  // settings
  const s = snap.settings;
  const mult = s.mult as number[];
  return (
    <FormModal
      title="System settings"
      fields={[
        { label: "Point value ($ per point)", type: "number", step: "0.01", value: s.point_value },
        { label: "★ multiplier", type: "number", step: "0.1", value: mult[0] },
        { label: "★★ multiplier", type: "number", step: "0.1", value: mult[1] },
        { label: "★★★ multiplier", type: "number", step: "0.1", value: mult[2] },
        { label: "Clean-room streak: days needed", type: "number", step: "1", value: s.personal_streak_days },
        { label: "Clean-room streak: bonus pts (each kid)", type: "number", step: "0.5", value: s.personal_streak_bonus },
        { label: "★★★ streak: chores in a row needed", type: "number", step: "1", value: s.quality_streak_len },
        { label: "★★★ streak: bonus pts", type: "number", step: "0.5", value: s.quality_streak_bonus },
        { label: "Weekly deduction cap per kid", type: "number", step: "1", value: s.weekly_deduction_cap },
        { label: "Cartoon minutes for an all-★★★ day", type: "number", step: "5", value: s.cartoon_minutes },
      ]}
      onCancel={onClose}
      onSave={async (v) => {
        try {
          await api.updateSettings(familyId, {
            point_value: Number(v[0]) || 0.25,
            mult: [Number(v[1]), Number(v[2]), Number(v[3])],
            personal_streak_days: Number(v[4]),
            personal_streak_bonus: Number(v[5]),
            quality_streak_len: Number(v[6]),
            quality_streak_bonus: Number(v[7]),
            weekly_deduction_cap: Number(v[8]),
            cartoon_minutes: Number(v[9]),
          });
          await afterSave();
        } catch (e) {
          onError(e);
        }
      }}
    />
  );
}
