// src/cloud.js
// Small helper used by the React app to talk to your Apps Script backend.

export const ENDPOINT = "https://script.google.com/macros/s/AKfycbw3Yb6gw8HSTVNUNQkET9dHD-8rVZq6auOkKkGnT6eQ6a70SMuAi3Jat3EkCoJ0giA-/exec";
// ^^^ Your NEW Apps Script URL

export const SHARED_SECRET = "my_super_secret_sales_game_2024!";
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
    const res = await fetch(`${ENDPOINT}?action=leaderboard&days=${encodeURIComponent(days)}&secret=${encodeURIComponent(SHARED_SECRET)}`, {
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
