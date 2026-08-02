import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Vercel Cron hits this Sunday ~19:00 PT. Runs the weekly tally for every family.
// _tally() is idempotent per (family_id, week_key), so re-runs and a parent having
// already tallied are both safe. Guarded by the CRON_SECRET bearer token.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const { data: families, error } = await admin.from("families").select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: { family_id: string; ran: boolean; week_key: string }[] = [];
  for (const f of families ?? []) {
    // wk defaults to app_week_key() (PT) inside the function.
    const { data, error: e } = await admin.rpc("_tally", { fam: f.id });
    if (e) return NextResponse.json({ error: e.message, family_id: f.id }, { status: 500 });
    const r = data as { ran: boolean; week_key: string };
    results.push({ family_id: f.id, ran: r.ran, week_key: r.week_key });
  }
  return NextResponse.json({ ok: true, count: results.length, results });
}
