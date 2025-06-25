
Mohsin Ali Tanvir
5:03 PM (0 minutes ago)
to me

const express = require("express");
const { Client } = require("linkedin-private-api");

const app = express();
app.use(express.json());

// ✅ Health check to confirm deployment and version
app.get("/", (req, res) => {
  const version = "1.0.4";
  const timestamp = new Date().toISOString();
  res.send(`✅ LinkedIn Bot Deployed - Version: ${version} - ${timestamp}`);
});

// ✅ Main message sender route
app.post("/send-linkedin-message", async (req, res) => {
  const { li_at_cookie, recipientProfileId, message } = req.body;

  console.log("🟢 POST /send-linkedin-message hit");
  console.log("➡️ Payload received:", {
    recipientProfileId,
    message: message?.slice(0, 50) + "...",
  });

  const client = new Client();

  try {
    // 🔐 Login using li_at cookie
    console.log("🔐 Logging in...");
    await client.login.userCookie({
      li_at: li_at_cookie,
      cookieCsrfToken: "", // required to bypass caching behavior
      useCache: false,
    });

    console.log("✅ Login successful");

    // 📨 Send LinkedIn message
    console.log("📨 Sending message to:", recipientProfileId);
    await client.message.sendText(recipientProfileId, message);
    console.log("✅ Message sent successfully");

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Error occurred:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const startedAt = new Date().toISOString();
  console.log(`🚀 LinkedIn Bot server started on port ${PORT} at ${startedAt}`);
});
