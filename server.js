require("dotenv").config();

const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const path = require("path");
const nodemailer = require("nodemailer");

const app = express();

// 🔥 LIMITS
const LIMITS = {
  temperature: { min: 0, max: 35 },
  humidity: { min: 20, max: 80 },
  pressure: { min: 950, max: 1050 },
  illuminance: { min: 0, max: 1000 }
};

// 🔥 ANTI-SPAM
let lastAlertTime = 0;
const ALERT_INTERVAL = 60000; // 60 sec

// 🔥 VALIDARE
function isValid(value) {
  return value !== null && value !== undefined && !isNaN(value);
}

// 🔥 ALERT CHECK
function checkAlerts({ temperature, humidity, pressure, illuminance }) {
  let alerts = [];

  if (isValid(temperature) &&
      (temperature < LIMITS.temperature.min || temperature > LIMITS.temperature.max)) {
    alerts.push(`🌡️ Temperatura anormală: ${temperature}`);
  }

  if (isValid(humidity) &&
      (humidity < LIMITS.humidity.min || humidity > LIMITS.humidity.max)) {
    alerts.push(`💧 Umiditate anormală: ${humidity}`);
  }

  if (isValid(pressure) &&
      (pressure < LIMITS.pressure.min || pressure > LIMITS.pressure.max)) {
    alerts.push(`🌪️ Presiune anormală: ${pressure}`);
  }

  if (isValid(illuminance) &&
      (illuminance < LIMITS.illuminance.min || illuminance > LIMITS.illuminance.max)) {
    alerts.push(`☀️ Lumină anormală: ${illuminance}`);
  }

  return alerts;
}

app.use(cors());
app.use(express.json());

// 🔥 STATIC
app.use(express.static(path.join(__dirname, "public")));

// 🔥 DB (IMPORTANT → folosește DATABASE_URL din Render)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// 🔥 CREATE TABLE
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sensor_data (
        id SERIAL PRIMARY KEY,
        temperature FLOAT,
        humidity FLOAT,
        pressure FLOAT,
        illuminance FLOAT,
        command INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ TABLE READY");
  } catch (err) {
    console.error("❌ DB ERROR:", err.message);
  }
}

initDB();

// 🔥 EMAIL FUNCTION
async function sendEmail(subject, message) {
  try {
    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    let info = await transporter.sendMail({
      from: `"Sistem Irigatii" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject,
      text: message
    });

    console.log("📧 Email trimis:", info.response);

  } catch (err) {
    console.error("❌ EMAIL ERROR:", err.message);
  }
}

// 🔥 TEST ROUTE
app.get("/", (req, res) => {
  res.send("API WORKING");
});

// 🔥 INSERT + ALERTĂ
app.post("/insert", async (req, res) => {
  try {
    const { temperature, humidity, pressure, illuminance } = req.body;

    // 🔥 ignoră dacă toate sunt invalide
    if (
      !isValid(temperature) &&
      !isValid(humidity) &&
      !isValid(pressure) &&
      !isValid(illuminance)
    ) {
      return res.send("IGNORED - INVALID DATA");
    }

    // 🔥 salvare DB
    await pool.query(
      "INSERT INTO sensor_data (temperature, humidity, pressure, illuminance) VALUES ($1,$2,$3,$4)",
      [temperature, humidity, pressure, illuminance]
    );

    // 🔥 ALERTĂ
    const alerts = checkAlerts({ temperature, humidity, pressure, illuminance });

    if (alerts.length > 0 && Date.now() - lastAlertTime > ALERT_INTERVAL) {
      const message = alerts.join("\n");

      await sendEmail("⚠️ ALERTĂ SISTEM IRIGAȚII", message);

      lastAlertTime = Date.now();
    }

    res.send("DATA SAVED");

  } catch (err) {
    console.error("❌ INSERT ERROR:", err.message);
    res.status(500).send("ERROR");
  }
});

// 🔥 COMMAND
app.post("/command", async (req, res) => {
  try {
    const { command } = req.body;

    await pool.query(
      "INSERT INTO sensor_data (command) VALUES ($1)",
      [command]
    );

    res.send("COMMAND SAVED");

  } catch (err) {
    console.error(err);
    res.status(500).send("ERROR");
  }
});

// 🔥 GET DATA
app.get("/data", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM sensor_data ORDER BY id DESC"
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).send("ERROR");
  }
});

// 🔥 START SERVER
app.listen(process.env.PORT || 10000, () => {
  console.log("🚀 Server running");
});
