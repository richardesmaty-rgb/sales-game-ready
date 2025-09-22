// src/cloud.js
const ENDPOINT = "https://script.google.com/macros/s/AKfycbyiuh4wLlxOT8g_El6wUtdd5JFwH-qGbq5bWS_fUf20jNK69Brm-b4lUhF4CR_hhm-UYQ/exec";
const SHARED_SECRET = 'CHANGE_ME_very_secret';

// Save a single activity row
export async function saveActivityToSheet({ name, date, title, category, points, timestamp }) {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, date, title, category, points, timestamp }),
    });
    const json = await res.json();
    if (!json.ok) console.warn("Sheet save failed:", json);
    return json;
  } catch (e) {
    console.error("Save to Google Sheet failed:", e);
  }
}

// Fetch leaderboard from the Sheet
export async function fetchLeaderboardFromSheet(days = 7) {
  try {
    const res = await fetch(`${ENDPOINT}?action=leaderboard&days=${days}`);
    const json = await res.json();
    return json.ok ? json.leaderboard : [];
  } catch (e) {
    console.error("Fetch leaderboard failed:", e);
    return [];
  }
}
