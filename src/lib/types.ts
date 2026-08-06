import type { Database } from "@/lib/database.types";

type T = Database["public"]["Tables"];
export type Profile = T["profiles"]["Row"];
export type Chore = T["chores"]["Row"];
export type Completion = T["completions"]["Row"];
export type DeductionRule = T["deduction_rules"]["Row"];
export type Reward = T["rewards"]["Row"];
export type EllieReward = T["ellie_rewards"]["Row"];
export type Redemption = T["redemptions"]["Row"];
export type Goal = T["goals"]["Row"];
export type Settings = T["settings"]["Row"];
export type BonusRule = T["bonus_rules"]["Row"];
export type BonusEvent = T["bonus_events"]["Row"];
export type PointAlert = T["point_alerts"]["Row"];

export type CartoonState = "none" | "pending" | "earned" | "missed";

export type ChoreWithEntries = Chore & { period_entries: Completion[] };

export type DeductionEvent = {
  id: string;
  title: string;
  occurred_on: string;
  week_key: string;
  amounts: Record<string, number>;
  created_at: string;
};

export type SnapshotViewer = {
  kind: "parent" | "kid";
  profileId: string | null;
  approved: boolean;
};

// Everything the app needs for one family, loaded together and kept fresh.
export type FamilySnapshot = {
  familyId: string;
  viewer: SnapshotViewer;
  today: string; // YYYY-MM-DD (PT)
  weekKey: string;
  isoWeek: number;
  biweeklyOn: boolean;
  settings: Settings;
  kids: Profile[];
  chores: ChoreWithEntries[];
  rewards: Reward[];
  ellieRewards: EllieReward[];
  deductions: DeductionRule[];
  deductionEvents: DeductionEvent[];
  bonusRules: BonusRule[];
  bonusEvents: BonusEvent[];
  pointAlerts: PointAlert[];
  goals: Goal[];
  redemptions: Redemption[];
  completions: Completion[];
  checkins: { kid_id: string; occurred_on: string }[];
  roomCheckToday: boolean;
  tallyRanThisWeek: boolean;
  pendingDevices: { id: string; kid_id: string; device_label: string | null }[];
};

// The viewer's identity/role for this device.
export type Viewer =
  | { kind: "parent"; profileId: string; familyId: string }
  | { kind: "kid"; profileId: string; familyId: string; approved: boolean }
  | { kind: "kid-pending"; familyId: string }
  | { kind: "none" };
