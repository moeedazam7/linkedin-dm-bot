const express = require("express");
const { Client } = require("linkedin-private-api");

const app = express();
app.use(express.json());

app.post("/send-linkedin-message", async (req, res) => {
  const { li_at_cookie, recipientProfileId, message } = req.body;

  try {
    const client = new Client();
    await client.login.userCookie({ li_at: li_at_cookie, useCache: false, });

    await client.message.sendText(recipientProfileId, message);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
