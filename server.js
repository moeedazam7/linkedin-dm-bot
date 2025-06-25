const express = require("express");
const { Client } = require("linkedin-private-api");

const app = express();
app.use(express.json());

// Health check endpoint to confirm deployment
app.get("/", (req, res) => {
  const version = "1.0.3";
  const timestamp = new Date().toISOString();
  res.send(⁠ ✅ LinkedIn Bot Deployed – Version: ${version} – ${timestamp} ⁠);
});

// Main route to send LinkedIn message
app.post("/send-linkedin-message", async (req, res) => {
  const { li_at_cookie, recipientProfileId, message } = req.body;

  console.log("🟢 /send-linkedin-message endpoint hit");
  console.log("➡️ Payload received:", {
    recipientProfileId,
    message: message.slice(0, 50) + "...", // limit log size
  });

  try {
    const client = new Client();

    console.log("🔐 Logging into LinkedIn...");
    await client.login.userCookie({
      li_at: li_at_cookie,
      cookieCsrfToken: '',   // ✅ required to bypass cache logic
      useCache: false        // ✅ ensure no stale session is used
    });
    console.log("✅ LinkedIn login successful");

    console.log("📨 Sending message to:", recipientProfileId);
    await client.message.sendText(recipientProfileId, message);
    console.log("✅ Message sent successfully");

    res.json({ success: true });
  } catch (error) {
    console.error("❌ Error sending LinkedIn message:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const timestamp = new Date().toISOString();
  console.log(⁠ 🚀 Server running on port ${PORT} – Started at ${timestamp} ⁠);
});
