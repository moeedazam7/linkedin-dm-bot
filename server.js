const express = require("express");
const { Client } = require("linkedin-private-api");

const app = express();
app.use(express.json());

app.post("/send-linkedin-message", async (req, res) => {
  const { _li_at_cookie, recipientProfileId, message } = req.body;

  if (!_li_at_cookie || !recipientProfileId || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const client = new Client();
  try {
    await client.login.userCookie({ li_at: _li_at_cookie });
    await client.invitation.sendInvitation({
      profileId: recipientProfileId,
      message,
    });

    res.json({ status: "sent", recipientProfileId, preview: message.slice(0, 40) });
  } catch (err) {
    console.error("LinkedIn Bot Error:", err);
    res.status(500).json({ error: "Failed to send message", details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("LinkedIn Bot running on port " + PORT));
