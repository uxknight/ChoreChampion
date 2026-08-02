#!/usr/bin/env node
// One-time migration: import a prototype JSON export (Admin → Export backup from
// chore-champions.html) into a production family, so no earned points are lost at
// cutover. Carries over per-kid bank/week/streak/stickers, goals, redemptions,
// this-week's rated scorecard, and today's check-ins.
//
// Usage:
//   SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... \
//   node scripts/import-prototype.mjs --file backup.json --family KNIGHT [--dry]
//
// Env is also read from .env.local if present.

import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// ---- tiny .env.local loader ------------------------------------------------
function loadEnv() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

// ---- args ------------------------------------------------------------------
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const filePath = opt("--file");
const familyCode = opt("--family");
const dry = args.includes("--dry");
if (!filePath || !familyCode) {
  console.error("Usage: node scripts/import-prototype.mjs --file <backup.json> --family <INVITE_CODE> [--dry]");
  process.exit(1);
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const S = JSON.parse(readFileSync(filePath, "utf8"));
const db = createClient(URL, KEY, { auth: { persistSession: false } });

const norm = (s) => String(s || "").trim().toLowerCase();
const half = (x) => Math.round(x * 2) / 2;

function isoWeekKey(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const t = new Date(d.getTime());
  t.setHours(0, 0, 0, 0);
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const w1 = new Date(t.getFullYear(), 0, 4);
  const week = 1 + Math.round(((t - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7);
  return t.getFullYear() + "-W" + String(week).padStart(2, "0");
}

async function main() {
  const { data: fam, error: fe } = await db.from("families").select("id").eq("invite_code", familyCode.toUpperCase()).maybeSingle();
  if (fe || !fam) throw new Error("Family not found for invite code " + familyCode);
  const familyId = fam.id;

  const { data: kids } = await db.from("profiles").select("*").eq("family_id", familyId).eq("role", "kid");
  const { data: chores } = await db.from("chores").select("id,title").eq("family_id", familyId).is("deleted_at", null);

  const kidByName = new Map(kids.map((k) => [norm(k.name), k]));
  const choreByTitle = new Map(chores.map((c) => [norm(c.title), c.id]));
  // prototype kid id -> name (for goals/redeemed/log lookups)
  const protoIdToName = new Map((S.kids || []).map((k) => [k.id, k.name]));
  const profileForProtoId = (pid) => kidByName.get(norm(protoIdToName.get(pid)));

  const plan = { profiles: [], goals: 0, redemptions: 0, completions: 0, checkins: 0, stickerEvents: 0, skipped: [] };

  // 1) per-kid state
  for (const pk of S.kids || []) {
    const prof = kidByName.get(norm(pk.name));
    if (!prof) { plan.skipped.push("kid " + pk.name); continue; }
    if (pk.mode === "stickers" || prof.mode === "stickers") {
      plan.profiles.push({ id: prof.id, patch: { stickers: pk.stickers || 0 } });
    } else {
      plan.profiles.push({
        id: prof.id,
        patch: {
          bank: half(pk.bank || 0),
          week: half(pk.week || 0),
          week_deducted: half(pk.weekDeducted || 0),
          clean_days: pk.cleanDays || 0,
          quality_streak: pk.qualityStreak || 0,
        },
      });
    }
  }

  // 2) goals
  const goalRows = [];
  for (const g of S.goals || []) {
    const prof = profileForProtoId(g.kidId);
    if (!prof) { plan.skipped.push("goal " + g.title); continue; }
    goalRows.push({ family_id: familyId, kid_id: prof.id, title: g.title, target: g.target, saved: half(g.saved || 0), done: !!g.done });
  }
  plan.goals = goalRows.length;

  // 3) redemptions
  const redRows = [];
  for (const r of S.redeemed || []) {
    const prof = profileForProtoId(r.kidId);
    if (!prof) continue;
    redRows.push({ family_id: familyId, kid_id: prof.id, title: r.title, cost: String(r.cost), occurred_on: r.date });
  }
  plan.redemptions = redRows.length;

  // 4) this-week rated completions (the scorecard) + sticker events
  const compRows = [];
  const stickerRows = [];
  for (const e of S.log || []) {
    const prof = profileForProtoId(e.kidId);
    if (!prof) continue;
    // strip a leading emoji from the stored title to match a chore
    const bareTitle = norm(String(e.title).replace(/^\S+\s/, ""));
    const choreId = choreByTitle.get(bareTitle) ?? choreByTitle.get(norm(e.title));
    if (!choreId) { plan.skipped.push("log " + e.title); continue; }
    const wk = e.weekKey || (e.date ? isoWeekKey(e.date) : null);
    compRows.push({
      family_id: familyId, chore_id: choreId, kid_id: prof.id,
      title_snapshot: e.title, pts_snapshot: e.pts,
      occurred_on: e.date, week_key: wk,
      status: e.status === "rated" ? "rated" : "pending",
      stars: e.stars || 0, earned: e.earned || 0,
    });
  }
  plan.completions = compRows.length;

  // 5) checkins (today only, cosmetic)
  const checkRows = [];
  for (const [pid, date] of Object.entries(S.checkins || {})) {
    const prof = profileForProtoId(pid);
    if (prof) checkRows.push({ family_id: familyId, kid_id: prof.id, occurred_on: date });
  }
  plan.checkins = checkRows.length;

  console.log("Import plan:", JSON.stringify({ familyId, ...plan }, null, 2));
  if (dry) { console.log("--dry: no writes performed."); return; }

  for (const p of plan.profiles) {
    const { error } = await db.from("profiles").update(p.patch).eq("id", p.id);
    if (error) throw new Error("profiles: " + error.message);
  }
  if (goalRows.length) { const { error } = await db.from("goals").insert(goalRows); if (error) throw new Error("goals: " + error.message); }
  if (redRows.length) { const { error } = await db.from("redemptions").insert(redRows); if (error) throw new Error("redemptions: " + error.message); }
  if (compRows.length) { const { error } = await db.from("completions").insert(compRows); if (error) throw new Error("completions: " + error.message); }
  if (checkRows.length) { const { error } = await db.from("checkins").upsert(checkRows, { onConflict: "kid_id,occurred_on" }); if (error) throw new Error("checkins: " + error.message); }
  void stickerRows;

  console.log("✓ Import complete.");
}

main().catch((e) => { console.error("Import failed:", e.message); process.exit(1); });
