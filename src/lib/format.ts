// Display helpers mirrored from the prototype.

export const half = (x: number) => Math.round(x * 2) / 2;

export const money = (pts: number, pointValue: number) =>
  "$" + (pts * pointValue).toFixed(2);

export const starStr = (n: number) => "★".repeat(n) + "☆".repeat(3 - n);

export const num = (n: number) => (Number.isInteger(n) ? String(n) : String(n));

export const FREQ_LABEL: Record<string, string> = {
  twice_daily: "2× daily (lunch & dinner)",
  daily: "daily",
  weekly: "weekly",
  biweekly: "biweekly ✨",
  ondemand: "🔔 hotspot — live now!",
};

// Animal emojis offered when picking a kid's avatar.
export const ANIMAL_EMOJIS = [
  "🦊", "🐯", "🐱", "🐶", "🐰", "🐻", "🐼", "🐨", "🦁", "🐮",
  "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🐤", "🦄", "🐝", "🦋",
  "🐙", "🦈", "🐬", "🐢", "🦉", "🦕", "🦖", "🐳", "🦒", "🦓",
  "🦔", "🦦", "🦥", "🐺", "🐗", "🐴", "🦇", "🦩", "🦜", "🐛",
];

export const randomAnimal = () => ANIMAL_EMOJIS[Math.floor(Math.random() * ANIMAL_EMOJIS.length)];

// Vibrant avatar colors offered when creating/editing a kid.
export const VIBRANT_COLORS = [
  "#7c5cff", "#ff8a3d", "#2bb673", "#e5484d", "#12c2e9", "#f5b301",
  "#ff5da2", "#6c5ce7", "#00b894", "#0984e3", "#e84393", "#00cec9",
  "#fd7e14", "#20c997", "#845ef7", "#f06595",
];

export const randomColor = () => VIBRANT_COLORS[Math.floor(Math.random() * VIBRANT_COLORS.length)];

// Household / task emojis offered when creating or editing a chore.
export const CHORE_EMOJIS = [
  "🧹", "🧽", "🧼", "🧺", "🧻", "🪣", "🧴", "🧯", "🗑️", "♻️",
  "🍽️", "🫧", "🍴", "🥄", "🔪", "🍳", "🧂", "🧊", "🥫", "🧇",
  "🚽", "🛁", "🚿", "🪥", "🧷", "🪒", "🛏️", "🛋️", "🪟", "🚪",
  "👶", "🐾", "🌱", "🪴", "🌿", "🍂", "👕", "👚", "🧦", "🥾",
  "🧸", "📚", "🎒", "🚗", "🚙", "🧰", "🔧", "🔨", "🪜", "🪛",
  "💡", "🔌", "🕯️", "📦", "✨", "🌀", "⭐", "🧩",
];

export const FREQ_OPTIONS = [
  { v: "twice_daily", t: "Twice a day" },
  { v: "daily", t: "Daily" },
  { v: "weekly", t: "Weekly" },
  { v: "biweekly", t: "Biweekly" },
  { v: "ondemand", t: "Hotspot (parent-activated)" },
];
