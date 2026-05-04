import express from "express";
import pkg from "pg";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;
const app = express();

app.use(cors());
app.use(express.json());

// ================= PUBLIC =================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

// ================= CONTROL GLOBAL =================
let manual_control = false; // 🔥 AUTO implicit
let manual_state = 0;       // 🔥 0 = OFF, 1 = ON

// ================= DB =================
const pool = new Pool({
  connectionString: "postgresql://iot_db_3whd_user:ql42HXPaY8poPqjoIrWz45yjdKSmITmJ@dpg-d6tvtqchg0os738338j0-a/iot_db_3whd",
  ssl: { rejectUnauthorized: false },
});

// ================= INIT DB =================
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sensor_data (
        id SERIAL PRIMARY KEY,
        temperature FLOAT,
        humidity FLOAT,
        pressure FLOAT,
        illuminance FLOAT,
        co2 FLOAT,
        soil FLOAT,
        water_temp FLOAT,
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

// ================= ROOT =================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/login.html"));
});

// ================= GET CONTROL =================
app.get("/get_control", (req, res) => {
  res.json({
    manual_control: manual_control,
    state: manual_state
  });
});

// ================= SET MANUAL =================
app.post("/command", (req, res) => {
  try {
    const { command } = req.body;

    console.log("🔥 COMMAND RECEIVED:", command);

    manual_control = true;                 // 🔥 activăm manual
    manual_state = command === 1 ? 1 : 0;  // 🔥 siguranță 0/1

    console.log("🎮 MANUAL MODE:", manual_state);

    res.json({
      status: "manual mode ON",
      state: manual_state
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

// ================= SET AUTO =================
app.post("/auto", (req, res) => {
  manual_control = false;
  manual_state = 0;

  console.log("🤖 AUTO MODE ACTIVAT");

  res.json({
    status: "auto mode ON"
  });
});

// ================= GET DATA =================
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

// ================= INSERT =================
app.post("/insert", async (req, res) => {
  let client;

  try {
    let { temperature, humidity, pressure, illuminance, co2, soil, water_temp } = req.body;

    console.log("📥 RAW:", req.body);

    // retry connect
    for (let i = 0; i < 3; i++) {
      try {
        client = await pool.connect();
        break;
      } catch (err) {
        console.log("🔁 Retry DB connect...");
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (!client) throw new Error("DB connect failed");

    const last = await client.query(
      "SELECT * FROM sensor_data ORDER BY id DESC LIMIT 1"
    );

    const prev = last.rows[0] || {};

    const t = temperature  ?? null;
    const h = humidity  ?? null;
    const p = pressure  ?? null;
    const l = illuminance  ?? null;
    const c = co2  ?? null;
    const s = soil  ?? null;
    const w = water_temp  ?? null;

    console.log("✅ FINAL INSERT:", { t, h, p, l, c, s, w });

    await client.query(
      `INSERT INTO sensor_data 
      (temperature, humidity, pressure, illuminance, co2, soil, water_temp) 
      VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [t, h, p, l, c, s, w]
    );

    res.json({ status: "ok" });

  } catch (err) {
    console.error("❌ INSERT ERROR:", err.message);
    res.status(500).json({ error: "server error" });

  } finally {
    if (client) client.release();
  }
});

// ================= LOGIN =================
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (username === "admin" && password === "admin123") {
    return res.json({ success: true });
  }

  res.json({ success: false });
});

// ================= START =================
app.listen(process.env.PORT || 10000, () => {
  console.log("🚀 Server running");
});
