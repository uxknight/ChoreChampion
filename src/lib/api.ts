"use client";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { FamilySnapshot } from "@/lib/types";
import type { Database } from "@/lib/database.types";

type ChoreUpdate = Database["public"]["Tables"]["chores"]["Update"];
type SettingsUpdate = Database["public"]["Tables"]["settings"]["Update"];

const sb = () => supabaseBrowser();

// Friendly messages for the exceptions raised by the RPCs.
const ERROR_MESSAGES: Record<string, string> = {
  chore_period_full: "Someone’s already on it!",
  not_your_claim: "Only the kid who’s on it can mark it done.",
  not_claimed: "That chore isn’t claimed yet.",
  hotspot_not_active: "That hotspot isn’t live right now.",
  not_biweekly_week: "That’s a next-week chore.",
  kid_only: "Only a kid device can do that.",
  parent_only: "Parents only.",
  insufficient_bank: "Not enough banked points yet — keep going!",
  insufficient_stickers: "Not enough stickers yet!",
  nothing_to_add: "No banked points to add.",
  goal_exists: "Already saving for this!",
  room_check_done: "Room check already logged today.",
  already_rated: "Already rated.",
  bad_invite_code: "That family code didn’t match.",
  not_your_goal: "That isn’t your goal.",
};

export function friendlyError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  for (const key of Object.keys(ERROR_MESSAGES)) {
    if (msg.includes(key)) return ERROR_MESSAGES[key];
  }
  return msg.replace(/^.*?:\s*/, "");
}

async function rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb().rpc(fn as never, args as never);
  if (error) throw new Error(error.message);
  return data as T;
}

type RawSnapshot = {
  family_id: string;
  viewer: { kind: string; profile_id: string | null; approved: boolean };
  today: string;
  week_key: string;
  iso_week: number;
  biweekly_on: boolean;
  settings: FamilySnapshot["settings"];
  kids: FamilySnapshot["kids"];
  chores: FamilySnapshot["chores"];
  rewards: FamilySnapshot["rewards"];
  ellie_rewards: FamilySnapshot["ellieRewards"];
  deductions: FamilySnapshot["deductions"];
  deduction_events: FamilySnapshot["deductionEvents"];
  bonus_rules: FamilySnapshot["bonusRules"];
  bonus_events: FamilySnapshot["bonusEvents"];
  goals: FamilySnapshot["goals"];
  redemptions: FamilySnapshot["redemptions"];
  completions: FamilySnapshot["completions"];
  checkins: FamilySnapshot["checkins"];
  room_check_today: boolean;
  tally_ran: boolean;
  pending_devices: FamilySnapshot["pendingDevices"];
};

// Loads the one-call snapshot and maps snake_case JSON -> the camelCase app type.
export async function loadSnapshot(): Promise<FamilySnapshot | null> {
  const raw = await rpc<RawSnapshot | { viewer: { kind: "none" } }>("family_snapshot");
  if (!raw || (raw as { viewer: { kind: string } }).viewer?.kind === "none") return null;
  const r = raw as RawSnapshot;
  return {
    familyId: r.family_id,
    viewer: { kind: r.viewer.kind as "parent" | "kid", profileId: r.viewer.profile_id, approved: r.viewer.approved },
    today: r.today,
    weekKey: r.week_key,
    isoWeek: r.iso_week,
    biweeklyOn: r.biweekly_on,
    settings: r.settings,
    kids: r.kids ?? [],
    chores: r.chores ?? [],
    rewards: r.rewards ?? [],
    ellieRewards: r.ellie_rewards ?? [],
    deductions: r.deductions ?? [],
    deductionEvents: r.deduction_events ?? [],
    bonusRules: r.bonus_rules ?? [],
    bonusEvents: r.bonus_events ?? [],
    goals: r.goals ?? [],
    redemptions: r.redemptions ?? [],
    completions: r.completions ?? [],
    checkins: r.checkins ?? [],
    roomCheckToday: r.room_check_today,
    tallyRanThisWeek: r.tally_ran,
    pendingDevices: r.pending_devices ?? [],
  };
}

// ---- kid actions (p_kid_id is honored only for a parent session) ----
export const checkIn = (kidId: string) => rpc("check_in", { p_kid_id: kidId });
export const claimChore = (choreId: string, kidId: string) => rpc("claim_chore", { p_chore_id: choreId, p_kid_id: kidId });
export const markDone = (completionId: string, kidId: string) => rpc("mark_done", { p_completion_id: completionId, p_kid_id: kidId });
export const redeemReward = (rewardId: string, kidId: string) => rpc<{ title: string; cost: number }>("redeem_reward", { p_reward_id: rewardId, p_kid_id: kidId });
export const redeemFlexible = (rewardId: string, amount: number, kidId: string) =>
  rpc<{ title: string; cost: number }>("redeem_flexible", { p_reward_id: rewardId, p_amount: amount, p_kid_id: kidId });
export const startGoal = (rewardId: string, kidId: string) => rpc("start_goal", { p_reward_id: rewardId, p_kid_id: kidId });
export const allocateToGoal = (goalId: string, amount: number) =>
  rpc<{ added: number; saved: number; target: number; reached: boolean }>("allocate_to_goal", { p_goal_id: goalId, p_amount: amount });
export const finishGoal = (goalId: string) => rpc("finish_goal", { p_goal_id: goalId });

// ---- parent actions ----
export const rate = (completionId: string, stars: number) =>
  rpc<{ earned: number; stars: number; streak_bonus: number; kid_id: string }>("rate_completion", { p_completion_id: completionId, p_stars: stars });
export const applyDeduction = (ruleId: string) => rpc<Record<string, number>>("apply_deduction", { p_rule_id: ruleId });
export const awardBonus = (ruleId: string, kidId: string) =>
  rpc<{ title: string; pts: number; kid_id: string }>("award_bonus", { p_rule_id: ruleId, p_kid_id: kidId });
export const roomCheck = () => rpc<{ bonus: boolean; bonus_pts: number }>("room_check");
export const runTally = () => rpc<{ ran: boolean; week_key: string }>("run_tally");
export const toggleHotspot = (choreId: string) => rpc<boolean>("toggle_hotspot", { p_chore_id: choreId });
export const addSticker = (kidId: string) => rpc<number>("add_sticker", { p_kid_id: kidId });
export const redeemEllie = (rewardId: string, kidId: string) =>
  rpc<{ title: string; stickers: number }>("redeem_ellie", { p_reward_id: rewardId, p_kid_id: kidId });
export const approveDevice = (deviceId: string, approved = true) =>
  rpc("approve_device", { p_device_id: deviceId, p_approved: approved });
export const addKid = (name: string, emoji: string, color: string, mode: string) =>
  rpc("add_kid", { p_name: name, p_emoji: emoji, p_color: color, p_mode: mode });
export const updateKid = (kidId: string, name: string, emoji: string, color: string) =>
  rpc("update_kid", { p_kid_id: kidId, p_name: name, p_emoji: emoji, p_color: color });
export const deleteKid = (kidId: string) => rpc("delete_kid", { p_kid_id: kidId });

// The family invite code (readable by any family member via RLS).
export async function getFamilyCode(): Promise<string> {
  const { data } = await sb().from("families").select("invite_code").maybeSingle();
  return data?.invite_code ?? "";
}

// ---- onboarding ----
export const createFamily = (familyName: string, parentName: string, emoji = "👑", color = "#7c5cff") =>
  rpc<{ family_id: string; invite_code: string }>("create_family", { p_family_name: familyName, p_parent_name: parentName, p_parent_emoji: emoji, p_parent_color: color });
export const familyKids = (code: string) =>
  rpc<{ id: string; name: string; emoji: string; color: string; mode: string }[]>("family_kids", { p_invite_code: code });
export const requestDevice = (code: string, kidId: string, label?: string) =>
  rpc("request_device", { p_invite_code: code, p_kid_id: kidId, p_label: label ?? null });

// ---- catalog CRUD (parent, direct table writes via RLS) ----
export async function upsertChore(row: { id?: string; emoji: string; title: string; description: string; base_pts: number; freq: string; family_id: string; active?: boolean }) {
  const c = sb();
  if (row.id) {
    const patch: ChoreUpdate = { emoji: row.emoji, title: row.title, description: row.description, base_pts: row.base_pts, freq: row.freq };
    if (row.freq !== "ondemand") patch.active = true;
    const { error } = await c.from("chores").update(patch).eq("id", row.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await c.from("chores").insert({ emoji: row.emoji, title: row.title, description: row.description, base_pts: row.base_pts, freq: row.freq, family_id: row.family_id, active: row.freq !== "ondemand" });
    if (error) throw new Error(error.message);
  }
}
export async function upsertBonus(row: { id?: string; title: string; pts: number; family_id: string }) {
  const c = sb();
  const { error } = row.id
    ? await c.from("bonus_rules").update({ title: row.title, pts: row.pts }).eq("id", row.id)
    : await c.from("bonus_rules").insert({ title: row.title, pts: row.pts, family_id: row.family_id });
  if (error) throw new Error(error.message);
}
export const softDelete = async (table: "chores" | "deduction_rules" | "rewards" | "ellie_rewards" | "bonus_rules", id: string) => {
  const { error } = await sb().from(table).update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
};
export async function upsertDeduction(row: { id?: string; title: string; pts: number; family_id: string }) {
  const c = sb();
  const { error } = row.id
    ? await c.from("deduction_rules").update({ title: row.title, pts: row.pts }).eq("id", row.id)
    : await c.from("deduction_rules").insert({ title: row.title, pts: row.pts, family_id: row.family_id });
  if (error) throw new Error(error.message);
}
export async function upsertReward(row: { id?: string; title: string; cost_pts: number; type: string; note: string; family_id: string }) {
  const c = sb();
  const { error } = row.id
    ? await c.from("rewards").update({ title: row.title, cost_pts: row.cost_pts, type: row.type, note: row.note }).eq("id", row.id)
    : await c.from("rewards").insert({ title: row.title, cost_pts: row.cost_pts, type: row.type, note: row.note, family_id: row.family_id });
  if (error) throw new Error(error.message);
}
export async function upsertEllieReward(row: { id?: string; title: string; stickers: number; family_id: string }) {
  const c = sb();
  const { error } = row.id
    ? await c.from("ellie_rewards").update({ title: row.title, stickers: row.stickers }).eq("id", row.id)
    : await c.from("ellie_rewards").insert({ title: row.title, stickers: row.stickers, family_id: row.family_id });
  if (error) throw new Error(error.message);
}
export async function updateSettings(familyId: string, patch: SettingsUpdate) {
  const { error } = await sb().from("settings").update(patch).eq("family_id", familyId);
  if (error) throw new Error(error.message);
}
