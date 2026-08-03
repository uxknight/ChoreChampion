"use client";
import React, { useEffect, useState } from "react";
import { useApp } from "@/components/provider";
import { ChoreList } from "@/components/choreList";
import { AdminView } from "@/components/admin";
import * as api from "@/lib/api";
import { money as fmtMoney, starStr } from "@/lib/format";
import type { CartoonState, Profile } from "@/lib/types";

type Tab = "home" | "rewards" | "rules" | "admin";

const TABS: { id: Tab; ic: string; label: string; parentOnly?: boolean }[] = [
  { id: "home", ic: "🏠", label: "Home" },
  { id: "rewards", ic: "🎁", label: "Rewards" },
  { id: "rules", ic: "📜", label: "Rules" },
  { id: "admin", ic: "🔒", label: "Admin", parentOnly: true },
];

function prettyDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function AppShell() {
  const { snap, isParent, selectedKid, setSelectedKid } = useApp();
  const [tab, setTab] = useState<Tab>("home");
  const kid = snap.kids.find((k) => k.id === selectedKid) ?? snap.kids[0];
  const money = (p: number) => fmtMoney(p, snap.settings.point_value);

  const tabs = TABS.filter((t) => !t.parentOnly || isParent);

  return (
    <>
      <header className="top">
        <div>
          <h1>Chore Champions</h1>
          <div className="sub">{prettyDate(snap.today)}</div>
        </div>
        <div className="chip gold">
          Week {snap.isoWeek}
          {snap.biweeklyOn ? " · Bonus week!" : ""}
        </div>
      </header>

      {isParent && (
        <div className="kids">
          {snap.kids.map((k) => (
            <button
              key={k.id}
              className={"kidbtn" + (selectedKid === k.id ? " active" : "")}
              style={{ ["--kc" as string]: k.color ?? "#7c5cff" }}
              onClick={() => setSelectedKid(k.id)}
            >
              <span className="em">{k.emoji}</span>
              {k.name}
              <span className="pts">
                {k.mode === "points" ? `${k.week} pts this week` : `${k.stickers} stickers`}
              </span>
            </button>
          ))}
        </div>
      )}

      {!isParent && kid && (
        <div className="kids">
          <div className="kidbtn active kid-self" style={{ ["--kc" as string]: kid.color ?? "#7c5cff" }}>
            <span className="em">{kid.emoji}</span>
            {kid.name}
            <span className="pts">
              {kid.mode === "points" ? `${kid.week} pts this week` : `${kid.stickers} stickers`}
            </span>
          </div>
        </div>
      )}

      <div className="view">
        {(() => {
          if (tab === "admin" && isParent) return <AdminView />;
          if (tab === "rules") return <Rules money={money} />;
          if (!kid) return <NoKids isParent={isParent} onGoAdmin={() => setTab("admin")} />;
          if (kid.mode === "stickers") return <EllieHome kid={kid} money={money} />;
          if (tab === "home") return <Home key={kid.id} kid={kid} money={money} />;
          return <Rewards kid={kid} money={money} />;
        })()}
      </div>

      <nav className="tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "active" : ""}
            onClick={() => {
              setTab(t.id);
              window.scrollTo(0, 0);
            }}
          >
            <span className="ic">{t.ic}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </>
  );
}

// Household-wide cartoon rule: cartoons unlock only when EVERY daily-chore slot
// for the family is done and rated ★★★ (chores are shared, so it's a family goal).
// Shown when a family has no kids yet (e.g. right after a parent creates it).
function NoKids({ isParent, onGoAdmin }: { isParent: boolean; onGoAdmin: () => void }) {
  const [code, setCode] = useState("");
  useEffect(() => {
    api.getFamilyCode().then(setCode);
  }, []);

  if (!isParent) {
    return (
      <div className="card">
        <h3>👋 Almost there</h3>
        <div className="muted">Ask a parent to finish setting up your profile.</div>
      </div>
    );
  }
  return (
    <>
      <div className="checkin-hero">
        <div style={{ fontSize: 18, fontWeight: 800 }}>Welcome! 👋</div>
        <div className="muted" style={{ marginTop: 2 }}>Let’s add your kids to get started.</div>
      </div>
      <div className="card">
        <h3>👧 Add your kids</h3>
        <div className="muted" style={{ marginBottom: 10 }}>
          Add each child in Admin, then their chores appear here and they can start earning.
        </div>
        <button className="btn" onClick={onGoAdmin}>
          Go to Admin → add kids
        </button>
      </div>
      <div className="card">
        <h3>📣 Your family code</h3>
        <div className="muted">Kids enter this on their own device to join:</div>
        <div className="big" style={{ letterSpacing: 6, marginTop: 8 }}>{code || "…"}</div>
      </div>
    </>
  );
}

function cartoonStatus(snap: ReturnType<typeof useApp>["snap"]): CartoonState {
  const dailyIds = new Set(snap.chores.filter((c) => c.freq === "daily" || c.freq === "twice_daily").map((c) => c.id));
  const totalSlots = snap.chores
    .filter((c) => dailyIds.has(c.id))
    .reduce((n, c) => n + (c.freq === "twice_daily" ? 2 : 1), 0);
  const entries = snap.completions.filter((e) => e.occurred_on === snap.today && dailyIds.has(e.chore_id));
  if (totalSlots === 0 || entries.length === 0) return "none";
  if (entries.some((e) => e.status === "rated" && e.stars < 3)) return "missed";
  const rated3 = entries.filter((e) => e.status === "rated" && e.stars === 3).length;
  if (rated3 >= totalSlots) return "earned";
  return "pending";
}

function Home({ kid, money }: { kid: Profile; money: (p: number) => string }) {
  const { snap, burst, toast, refresh } = useApp();
  const s = snap.settings;
  const checked = snap.checkins.some((c) => c.kid_id === kid.id && c.occurred_on === snap.today);
  const [dissipating, setDissipating] = useState(false);
  const myDeductions = snap.deductionEvents; // shared across all kids
  const myBonuses = snap.bonusEvents.filter((e) => e.kid_id === kid.id);

  async function handleCheckIn(e: React.MouseEvent) {
    burst(e, ["👋", "☀️", "⭐"]);
    setDissipating(true); // start the dissipate animation; chores reveal on animation end
    try {
      await api.checkIn(kid.id);
      toast("Checked in! Let’s see today’s chores.");
    } catch (err) {
      setDissipating(false);
      toast(api.friendlyError(err));
    }
  }
  const cs = cartoonStatus(snap);
  const pend = snap.completions.filter((e) => e.kid_id === kid.id && e.status === "pending").length;
  const ratedWk = snap.completions.filter(
    (e) => e.kid_id === kid.id && e.status === "rated" && e.week_key === snap.weekKey
  );
  const tv: Record<CartoonState, string> = {
    none: `📺 Do today’s chores at ★★★ to earn ${s.cartoon_minutes} min of cartoons!`,
    pending: "📺 Cartoon check: waiting on parent quality review… ⏳",
    earned: `📺 CARTOONS UNLOCKED! ${s.cartoon_minutes} minutes earned today! 🎉`,
    missed: "📺 Not an all-★★★ day. Tomorrow’s a fresh start!",
  };

  return (
    <>
      {!checked && (
        <div
          className={"checkin-hero" + (dissipating ? " dissipate" : "")}
          onAnimationEnd={() => {
            if (dissipating) void refresh(); // reveal chores as the bar finishes dissipating
          }}
        >
          <div className="row">
            <div className="grow">
              <div style={{ fontSize: 18, fontWeight: 800 }}>
                Good day, {kid.name}! {kid.emoji}
              </div>
              <div className="muted" style={{ marginTop: 2 }}>
                Tap to start your day.
              </div>
            </div>
            <button className="btn" onClick={handleCheckIn}>
              Check in ☀️
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="row" style={{ textAlign: "center" }}>
          <div className="grow">
            <div className="big">{kid.week}</div>
            <div className="muted">pts this week<br />{money(kid.week)}</div>
          </div>
          <div className="grow">
            <div className="big">{kid.bank}</div>
            <div className="muted">banked<br />{money(kid.bank)}</div>
          </div>
          <div className="grow">
            <div className="big">🔥{kid.quality_streak}</div>
            <div className="muted">★★★ streak<br />({s.quality_streak_len} = +{s.quality_streak_bonus})</div>
          </div>
          <div className="grow">
            <div className="big">🏠{kid.clean_days}</div>
            <div className="muted">clean days<br />({s.personal_streak_days} = +{s.personal_streak_bonus})</div>
          </div>
        </div>
      </div>

      <div className="tv">
        <b>{tv[cs]}</b>
      </div>

      {myBonuses.length > 0 && (
        <div className="card">
          <h3>🌟 Bonus points this week</h3>
          <div className="muted" style={{ marginBottom: 6 }}>Extra points for going above and beyond!</div>
          {myBonuses.map((ev) => (
            <div className="chore" key={ev.id}>
              <div className="grow">
                <div className="ttl">{ev.title}</div>
                <div className="meta">{ev.occurred_on}</div>
              </div>
              <span className="chip green">+{ev.pts} pts</span>
            </div>
          ))}
        </div>
      )}

      {myDeductions.length > 0 && (
        <div className="card">
          <h3>🏚️ Shared deductions this week</h3>
          <div className="muted" style={{ marginBottom: 6 }}>
            These hit <b>every kid</b> — protect each other!
          </div>
          {myDeductions.map((ev) => (
            <div className="chore" key={ev.id}>
              <div className="grow">
                <div className="ttl">{ev.title}</div>
                <div className="meta">{ev.occurred_on}</div>
              </div>
              <span className="chip red">−{ev.amounts[kid.id] ?? 0} pts</span>
            </div>
          ))}
        </div>
      )}

      {pend > 0 && (
        <div className="card">
          <h3>⏳ Waiting for quality check</h3>
          <div className="muted">
            {pend} chore{pend > 1 ? "s" : ""} waiting for a parent to rate. Points land after rating!
          </div>
        </div>
      )}

      {checked && (
        <div className="card reveal">
          <h3>🎯 Today’s chores</h3>
          <ChoreList scope="today" />
        </div>
      )}

      {checked && (
        <div className="card reveal">
          <h3>
            🗓️ Weekly &amp; biweekly
            {snap.biweeklyOn && <span className="chip gold"> ✨ bonus week</span>}
          </h3>
          <ChoreList scope="weekly" />
        </div>
      )}

      {ratedWk.length > 0 && (
        <div className="card">
          <h3>🗒️ This week’s scorecard</h3>
          {ratedWk
            .slice(-8)
            .reverse()
            .map((e) => (
              <div className="chore" key={e.id}>
                <div className="grow">
                  <div className="ttl">{e.title_snapshot}</div>
                  <div className="meta">{e.occurred_on}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="starline">{starStr(e.stars)}</div>
                  <div className="meta">+{e.earned} pts</div>
                </div>
              </div>
            ))}
        </div>
      )}
    </>
  );
}

function Rewards({ kid, money }: { kid: Profile; money: (p: number) => string }) {
  const { snap, selectedKid, run, toast, confirm, promptNumber } = useApp();
  const goals = snap.goals.filter((g) => g.kid_id === kid.id && !g.done);
  const hist = snap.redemptions.filter((x) => x.kid_id === kid.id).slice(0, 5);

  return (
    <>
      <div className="card">
        <div className="row">
          <div className="grow">
            <div className="muted">Banked points</div>
            <div className="big">
              {kid.bank} pts · {money(kid.bank)}
            </div>
          </div>
          <div style={{ fontSize: 36 }}>🏦</div>
        </div>
        <div className="muted" style={{ marginTop: 6 }}>
          Payday is Sunday — this week’s {kid.week} pts move here at the tally.
        </div>
      </div>

      {goals.length > 0 && (
        <div className="card">
          <h3>🚀 Goal trackers</h3>
          {goals.map((g) => {
            const pct = Math.min(100, Math.round((g.saved / g.target) * 100));
            return (
              <div key={g.id} style={{ marginBottom: 14 }}>
                <div className="row">
                  <div className="grow" style={{ fontWeight: 700, fontSize: 14 }}>
                    {g.title}
                  </div>
                  <span className="chip">
                    {g.saved} / {g.target} pts
                  </span>
                </div>
                <div className="bar" style={{ margin: "8px 0" }}>
                  <div style={{ width: pct + "%" }} />
                </div>
                <div className="row">
                  {g.saved >= g.target ? (
                    <button
                      className="btn grow"
                      style={{ background: "var(--gold)" }}
                      onClick={(e) => run(() => api.finishGoal(g.id), "Redeemed the big one: " + g.title + " 🏆", e, ["🏆", "🎉", "🌺"])}
                    >
                      🏆 Redeem it!
                    </button>
                  ) : (
                    <>
                      <button
                        className="btn ghost small grow"
                        onClick={async () => {
                          const amt = await promptNumber(
                            `How many banked points to add toward ${g.title}? (You have ${kid.bank})`,
                            Math.min(10, kid.bank),
                            { confirmLabel: "Add" }
                          );
                          if (!amt || amt <= 0) return;
                          run(() => api.allocateToGoal(g.id, amt), "Added toward " + g.title);
                        }}
                      >
                        ＋ Add banked points
                      </button>
                      <span className="muted">
                        {pct}% · {money(g.saved)} saved
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card">
        <h3>🎁 Reward catalog</h3>
        {snap.rewards.map((r) => {
          const afford = kid.bank >= r.cost_pts;
          const meta =
            r.type === "flexible"
              ? `You choose the points · about ${r.cost_pts} pts (${money(r.cost_pts)})`
              : `${r.cost_pts} pts · ${money(r.cost_pts)}`;
          return (
            <div className="chore" key={r.id}>
              <div className="grow">
                <div className="ttl">{r.title}</div>
                <div className="meta">
                  {meta}
                  {r.note ? " — " + r.note : ""}
                </div>
              </div>
              {r.type === "goal" ? (
                <button
                  className="btn orange small"
                  onClick={() => run(() => api.startGoal(r.id, selectedKid), "Goal started! Add banked points anytime.")}
                >
                  Save up 🚀
                </button>
              ) : r.type === "flexible" ? (
                <button
                  className="btn small"
                  disabled={kid.bank <= 0}
                  onClick={async () => {
                    if (kid.bank <= 0) return toast("No banked points yet — keep going!");
                    const amt = await promptNumber(
                      `How many points to put toward ${r.title}? (You have ${kid.bank})`,
                      Math.min(r.cost_pts, kid.bank),
                      { confirmLabel: "Redeem" }
                    );
                    if (!amt || amt <= 0) return;
                    if (amt > kid.bank) return toast("That’s more than you have banked.");
                    run(() => api.redeemFlexible(r.id, amt, selectedKid), `Redeemed ${amt} pts on ${r.title} 🎁`, undefined, ["🎁", "🎉", "💸"]);
                  }}
                >
                  Redeem
                </button>
              ) : (
                <button
                  className="btn small"
                  disabled={!afford}
                  onClick={async (e) => {
                    if (!afford) return toast("Not enough banked points yet — keep going!");
                    const pt = { clientX: e.clientX, clientY: e.clientY };
                    const ok = await confirm(`Redeem "${r.title}" for ${r.cost_pts} pts (${money(r.cost_pts)})?`, { confirmLabel: "Redeem" });
                    if (!ok) return;
                    run(() => api.redeemReward(r.id, selectedKid), "Redeemed: " + r.title + " 🎁", pt, ["🎁", "🎉", "💸"]);
                  }}
                >
                  Redeem
                </button>
              )}
            </div>
          );
        })}
      </div>

      {hist.length > 0 && (
        <div className="card">
          <h3>🧾 Recently redeemed</h3>
          {hist.map((x) => (
            <div className="adminrow" key={x.id}>
              <div className="grow">{x.title}</div>
              <span className="muted">{x.occurred_on}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function EllieHome({ kid, money }: { kid: Profile; money: (p: number) => string }) {
  const { snap, run, toast } = useApp();
  const n = kid.stickers || 0;
  const filled = n % 10 === 0 && n > 0 ? 10 : n % 10;
  void money;
  return (
    <>
      <div className="checkin-hero" style={{ background: "linear-gradient(135deg,#2bb673,#7bd8a8)" }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Ellie’s Sticker Chart 🐣</div>
        <div className="muted">Little helpers earn stickers. 10 stickers = a prize!</div>
      </div>
      <div className="card">
        <h3>
          ⭐ {n} sticker{n === 1 ? "" : "s"}
        </h3>
        <div className="stickergrid">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className={"stickerslot" + (i < filled ? " filled" : "")}>
              {i < filled ? "⭐" : ""}
            </div>
          ))}
        </div>
        <button
          className="btn green"
          style={{ width: "100%" }}
          onClick={(e) => run(() => api.addSticker(kid.id), n + 1 >= 10 ? "🎉 Ellie filled her chart! Pick a prize!" : "Sticker added! ⭐", e, ["⭐", "🐣", "💛"])}
        >
          ＋ Add a sticker (parent taps!)
        </button>
      </div>
      <div className="card">
        <h3>🎁 Ellie’s prizes</h3>
        {snap.ellieRewards.map((r) => (
          <div className="chore" key={r.id}>
            <div className="grow">
              <div className="ttl">{r.title}</div>
              <div className="meta">{r.stickers} stickers</div>
            </div>
            <button
              className="btn small"
              disabled={n < r.stickers}
              onClick={(e) => {
                if (n < r.stickers) return toast("Not enough stickers yet!");
                run(() => api.redeemEllie(r.id, kid.id), "Ellie earned: " + r.title + " 🎁", e, ["🎁", "🐣", "🎉"]);
              }}
            >
              Redeem
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function Rules({ money }: { money: (p: number) => string }) {
  const { snap } = useApp();
  const s = snap.settings;
  const mult = s.mult as number[];
  return (
    <>
      <div className="card">
        <h3>📜 Ground rules (the fine print)</h3>
        <ol className="rulelist">
          <li><b>1.</b> Your own stuff — room, laundry, bed, backpack — is <b>never paid</b>. That’s just being part of the family.</li>
          <li><b>2.</b> Paid chores are first-come, first-served. Tapping <b>Done!</b> without actually doing it = the chore gets un-done and the other kid can take it.</li>
          <li><b>3.</b> A chore only counts after a <b>parent quality check</b>. ★ = half points (a parent had to fix it), ★★ = full points, ★★★ = 1.5× points (a parent had to do <i>nothing</i>).</li>
          <li><b>4.</b> The parent’s star rating is <b>final</b>. Arguing about stars has never once created a star.</li>
          <li><b>5.</b> Room check every night. If anyone’s stuff is out, <b>both of you</b> lose points. Protect each other!</li>
          <li><b>6.</b> Deductions stop at {s.weekly_deduction_cap} pts a week and can never touch your banked points or take you below zero.</li>
          <li><b>7.</b> Payday is <b>Sunday</b>. Spend, save, or split — your call. Points in the bank are safe forever.</li>
          <li><b>8.</b> Big rewards use a <b>goal tracker</b> — add banked points each week and watch the bar fill up.</li>
          <li><b>9.</b> 🔔 <b>Hotspots</b> pop up when a parent activates them (entryway, garage…). First to grab it gets it — then it vanishes until it’s messy again.</li>
          <li><b>10.</b> Ellie’s stickers are Ellie’s. Helping her helps your ★★★ chances. 🐣</li>
        </ol>
      </div>
      <div className="card">
        <h3>🌟 Bonuses &amp; privileges</h3>
        <ol className="rulelist">
          <li><b>1.</b> 🏠🔥 <b>Clean-room streak:</b> {s.personal_streak_days} clean room-checks in a row = <b>+{s.personal_streak_bonus} bonus each</b>.</li>
          <li><b>2.</b> 🔥 <b>Quality streak:</b> {s.quality_streak_len} chores in a row at ★★★ = <b>+{s.quality_streak_bonus} bonus</b>.</li>
          <li><b>3.</b> 📺 <b>Cartoon time:</b> finish all of today’s chores at ★★★ and you’ve earned <b>{s.cartoon_minutes} minutes of cartoons</b> — automatically, no points needed.</li>
        </ol>
      </div>
      <div className="card">
        <div className="muted">
          Current exchange rate: <b>1 point = {money(1)}</b>. Multipliers: ★ ×{mult[0]} · ★★ ×{mult[1]} · ★★★ ×
          {mult[2]}
        </div>
      </div>
    </>
  );
}
