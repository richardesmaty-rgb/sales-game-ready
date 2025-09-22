// src/cloud.js
// Small helper used by the React app to talk to your Apps Script backend.

export const ENDPOINT = "https://script.google.com/macros/s/AKfycbyiuh4wLlxOT8g_El6wUtdd5JFwH-qGbq5bWS_fUf20jNK69Brm-b4lUhF4CR_hhm-UYQ/exec";
// ^^^ Replace if you re-deploy and the URL changes.

export const SHARED_SECRET = "CHANGE_ME_very_secret";
// ^^^ MUST match SHARED_SECRET in Code.gs

/** Save a single activity to the Google Sheet (fire-and-forget). */
export async function saveActivityToSheet({ name, date, title, category, points, timestamp }) {
  try {
    await fetch(`${ENDPOINT}?secret=${encodeURIComponent(SHARED_SECRET)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        date,
        title,
        category: category || "",
        points: Number(points || 0),
        timestamp: timestamp || Date.now()
      })
    });
  } catch (err) {
    // Non-blocking: we still keep everything locally.
    console.warn("saveActivityToSheet failed:", err);
  }
}

/** Get leaderboard (last N days). Returns [] on failure. */
export async function fetchLeaderboardFromSheet(days = 7) {
  try {
    const res = await fetch(`${ENDPOINT}?action=leaderboard&days=${encodeURIComponent(days)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });
    const json = await res.json();
    return json && json.ok && Array.isArray(json.leaderboard) ? json.leaderboard : [];
  } catch (err) {
    console.warn("fetchLeaderboardFromSheet failed:", err);
    return [];
  }
}
