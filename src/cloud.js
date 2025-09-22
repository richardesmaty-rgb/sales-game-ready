// Code.gs - Google Apps Script with CORS headers and secret validation

// Add CORS headers function
function setCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function doPost(e) {
  const SHARED_SECRET = "my_super_secret_sales_game_2024!";
  
  // Handle OPTIONS preflight request
  if (e.parameter && e.parameter.options) {
    return ContentService.createTextOutput()
      .setHeaders(setCorsHeaders())
      .setStatusCode(200);
  }
  
  // Check if the secret matches
  if (e.parameter.secret !== SHARED_SECRET) {
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: "Invalid secret"
    }))
    .setHeaders(setCorsHeaders())
    .setMimeType(ContentService.MimeType.JSON);
  }
  
  // Your existing doPost code here - process the data and save to sheet
  // ... your existing data processing logic ...
  
  // Example response (modify based on your existing code)
  var response = {
    ok: true,
    message: "Data saved successfully"
  };
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setHeaders(setCorsHeaders())
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const SHARED_SECRET = "my_super_secret_sales_game_2024!";
  
  // Handle OPTIONS preflight request
  if (e.parameter && e.parameter.options) {
    return ContentService.createTextOutput()
      .setHeaders(setCorsHeaders())
      .setStatusCode(200);
  }
  
  // Check if the secret matches
  if (e.parameter.secret !== SHARED_SECRET) {
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: "Invalid secret"
    }))
    .setHeaders(setCorsHeaders())
    .setMimeType(ContentService.MimeType.JSON);
  }
  
  // Your existing doGet code here - handle leaderboard requests
  // ... your existing leaderboard logic ...
  
  // Example response (modify based on your existing code)
  var response = {
    ok: true,
    leaderboard: [
      // your leaderboard data here
    ]
  };
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setHeaders(setCorsHeaders())
    .setMimeType(ContentService.MimeType.JSON);
}
