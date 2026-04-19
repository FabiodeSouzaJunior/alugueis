import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { DEFAULT_PREFERENCES } from "@/lib/notificationPreferences";
import { withAuth } from "@/lib/auth";

const PREFS_FILE = path.join(process.cwd(), "data", "notification-preferences.json");

async function readPreferences() {
  try {
    const raw = await readFile(PREFS_FILE, "utf-8");
    const data = JSON.parse(raw);
    return { ...DEFAULT_PREFERENCES, ...data };
  } catch (_) {
    return { ...DEFAULT_PREFERENCES };
  }
}

async function _GET(request, context) {
  try {
    const preferences = await readPreferences();
    return NextResponse.json({ preferences });
  } catch (err) {
    console.error("GET /api/notification-preferences", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _PATCH(request, context) {
  try {
    const body = await request.json();
    const current = await readPreferences();
    const next = { ...current };
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === "boolean" && key in DEFAULT_PREFERENCES) {
        next[key] = value;
      }
    }
    await mkdir(path.dirname(PREFS_FILE), { recursive: true });
    await writeFile(PREFS_FILE, JSON.stringify(next, null, 2), "utf-8");
    return NextResponse.json({ preferences: next });
  } catch (err) {
    console.error("PATCH /api/notification-preferences", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(_GET);
export const PATCH = withAuth(_PATCH);
