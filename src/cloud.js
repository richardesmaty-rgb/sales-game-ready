// ==============================
// TAP-HR Productivity Game Cloud Helpers
// ==============================

// 🔹 Replace this with YOUR Google Apps Script Web App URL (must end with /exec)
const ENDPOINT = "https://script.google.com/macros/s/AKfycbwAfwb505oVKSKjBX847z4r5FtfD1QXJa410OQmHkdzJ9rp-FUb4mzXaIAxLMugW4aJGQ/exec";

// 🔹 Must match SHARED_SECRET in your Apps Script code
const SECRET = "CHANGE_ME_very_secret";

/**
 * Save a completed activity into Google Sheets.
 * Called automatically when a quest is completed.
 */
export async function saveActivityToSheet({ name, date, title, category, points, timestamp }) {
  try {
    const res = await fetch(`${ENDPOINT}?secret=${encodeURIComponent(SECRET)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, date, title, category, points, timestamp })
    });

    if (!res.ok) {
      console.warn("Google Sheets save failed:", res.statusText);
    }
  } catch (err) {
    console.error("❌ Save to Google Sheet failed:", err);
  }
}

/**
 * Fetch leaderboard (optional — if you want live scores from the sheet).
 * @param {number} days - number of days back to include (e.g. 7, 30).
 */
export async function fetchLeaderboardFromSheet(days = 7) {
  try {
    const res = await fetch(`${ENDPOINT}?action=leaderboard&days=${days}`);
    const json = await res.json();
    return json.ok ? json.leaderboard : [];
  } catch (err) {
    console.error("❌ Fetch leaderboard failed:", err);
    return [];
  }
}
