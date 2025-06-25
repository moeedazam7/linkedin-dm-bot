const express = require("express");
const { Client } = require("linkedin-private-api");

const app = express();
app.use(express.json());

app.post("/send-linkedin-message", async (req, res) => {
  const { _li_at_cookie, recipientProfileId, message } = req.body;

  console.log("Request received:", req.body);

  if (!_li_at_cookie || !recipientProfileId || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const client = new Client();

  try {
    await client.login.userCookie({
      cookies: {
        li_at: _li_at_cookie,
      },
      cookieCsrfToken: "",
      useCache: false,
    });

    await client.message.sendMessage({
      profileId: recipientProfileId,
      text: message,
    });

    res.status(200).json({ success: true, to: recipientProfileId });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/", (req, res) => {
  res.send("LinkedIn bot is running locally.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server started on http://localhost:" + PORT);
});
