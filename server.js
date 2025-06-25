const express = require("express");
const { Client } = require("linkedin-private-api");

const app = express();
app.use(express.json());

// Health check endpoint
app.get("/", (req, res) => {
  const version = "1.0.5";
  const timestamp = new Date().toISOString();
  res.send("LinkedIn Bot Deployed - Version: " + version + " - " + timestamp);
});

// Main endpoint to send a LinkedIn message
app.post("/send-linkedin-message", async (req, res) => {
  const { li_at_cookie, recipientProfileId, message } = req.body;

  console.log("POST /send-linkedin-message called");
  console.log("Payload:", {
    recipientProfileId,
    message: message ? message.slice(0, 50) + "..." : ""
  });

  const client = new Client();

  try {
    console.log("Logging into LinkedIn...");
    await client.login.userCookie({
      li_at: li_at_cookie,
      cookieCsrfToken: "", // Required to disable cache fallback
      useCache: false
    });

    console.log("Login successful");

    console.log("Sending message to:", recipientProfileId);
    await client.message.sendText(recipientProfileId, message);

    console.log("Message sent successfully");
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error sending LinkedIn message:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const timestamp = new Date().toISOString();
  console.log("Server started on port " + PORT + " at " + timestamp);
});
