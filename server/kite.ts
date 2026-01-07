import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.KITE_API_KEY || "";
const API_SECRET = process.env.KITE_API_SECRET || "";
const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;

const app = express();
app.use(bodyParser.json());

// Step 1: Redirect user to Kite login
app.get("/kite/login", (req, res) => {
  const redirectUrl = `https://kite.trade/connect/login?api_key=${API_KEY}&v=3`;
  res.redirect(redirectUrl);
});

// Step 2: Exchange request_token for access_token
app.post("/kite/token", async (req, res) => {
  const { request_token } = req.body;
  try {
    const response = await axios.post(
      "https://api.kite.trade/session/token",
      {
        api_key: API_KEY,
        request_token,
        api_secret: API_SECRET,
      }
    );
    res.json({ access_token: response.data.data.access_token });
  } catch (error) {
    res.status(400).json({ error: error.response?.data || error.message });
  }
});

// Step 3: Fetch orders using access_token
app.get("/kite/orders", async (req, res) => {
  const { access_token } = req.query;
  try {
    const response = await axios.get("https://api.kite.trade/orders", {
      headers: {
        "X-Kite-Version": "3",
        Authorization: `token ${API_KEY}:${access_token}`,
      },
    });
    res.json(response.data);
  } catch (error) {
    res.status(400).json({ error: error.response?.data || error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Kite backend running on port ${PORT}`);
});
