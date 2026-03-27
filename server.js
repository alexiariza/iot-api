import express from "express";
import pkg from "pg";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import nodemailer from "nodemailer";


dotenv.config();

const { Pool } = pkg;

const app = express();

app.use(cors());
app.use(express.json());

// 🔥 FIX PUBLIC FOLDER
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "public")));

// 🔥 DB CONNECTION
const pool = new Pool({
  connectionString: "postgresql://iot_db_3whd_user:ql42HXPaY8poPqjoIrWz45yjdKSmITmJ@dpg-d6tvtqchg0os738338j0-a.oregon-postgres.render.com/iot_db_3whd",
  ssl: { rejectUnauthorized: false },
});

// 🔥 CREATE TABLE
async function initDB() {
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
}

initDB();

// 🔥 TEST API
app.get("/", (req, res) => {
  res.send("API WORKING");
});

// 🔥 FIX DB (opțional)
app.get("/fix-db", async (req, res) => {
  try {
    await pool.query("ALTER TABLE sensor_data ADD COLUMN command INTEGER");
    res.send("✅ command column added");
  } catch (err) {
    res.send("❌ " + err.message);
  }
});

// 🔥 COMMAND
app.post("/command", async (req, res) => {
  try {
    const { command } = req.body;

    console.log("🔥 COMMAND RECEIVED:", command);

    await pool.query(
      "INSERT INTO sensor_data (command) VALUES ($1)",
      [command]
    );

    res.json({ status: "command saved" }); // 🔥 FIX JSON

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
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
    res.status(500).json({ error: "server error" });
  }
});

// 🔥 INSERT DATA
app.post("/insert", async (req, res) => {
  try {
    const { temperature, humidity, pressure, illuminance } = req.body;

    // 🔥 ALERTĂ (ACUM E CORECT)
    if (
      temperature != null &&
      humidity != null &&
      pressure != null &&
      illuminance != null
    ) {
      if (true) {
        sendEmail("test","merge?");
        console.log("🔥 TRIMIT EMAIL TEST");
      }
    }

    await pool.query(
      "INSERT INTO sensor_data (temperature, humidity, pressure, illuminance) VALUES ($1,$2,$3,$4)",
      [temperature, humidity, pressure, illuminance]
    );

    res.json({ status: "ok" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (username === "admin" && password === "admin123") {
    return res.json({ success: true });
  }

  res.json({ success: false });
});
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

    console.log("📧 EMAIL TRIMIS:", info.response);

  } catch (err) {
    console.error("❌ EMAIL ERROR:", err.message);
  }
}

// 🔥 START SERVER
app.listen(process.env.PORT || 10000, () => {
  console.log("🚀 Server running");
});
