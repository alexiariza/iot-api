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

// ================= ROOT =================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/select-node.html"));
});

app.use(express.static(path.join(__dirname, "public")));

// ================= CONTROL GLOBAL =================
let manual_control = false;
let manual_command = 0;
let manual_duration = 0;          // durata folosită intern pentru timer
let manual_duration_display = 0;  // durata afișată în interfață
let irrigationTimer = null;

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
        duration INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query("ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS command INTEGER");
    await pool.query("ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS duration INTEGER");
    await pool.query("ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS auto_cmd INTEGER");
    console.log("✅ TABLE READY");

  } catch (err) {
    console.error("❌ DB ERROR:", err.message);
  }
}

initDB();

// ================= GET CONTROL =================
app.get("/get_control", (req, res) => {
  res.json({
    manual_control,
    command: manual_command,
    duration: manual_duration_display
  });
});

// ================= SET MANUAL =================
app.post("/command", (req, res) => {
  try {
    const { command, duration } = req.body;

    const selectedDuration = Number(duration || 0);

    manual_control = true;
    manual_command = Number(command || 0);

    manual_duration_display = manual_command !== 0 ? selectedDuration : 0;

    manual_duration = manual_command !== 0
      ? Math.max(selectedDuration, 2)
      : 0;

    if (irrigationTimer) {
      clearTimeout(irrigationTimer);
      irrigationTimer = null;
    }

    if (manual_command !== 0 && manual_duration > 0) {
      irrigationTimer = setTimeout(() => {
        manual_command = 0;
        manual_duration = 0;
        manual_duration_display = 0;
        irrigationTimer = null;

        console.log("⏰ Timp expirat -> OPRIRE MANUALĂ");
      }, manual_duration * 60000);
    }

    console.log("🎮 MANUAL:", {
      command: manual_command,
      duration_selected: manual_duration_display,
      duration_internal: manual_duration
    });

    res.json({
      status: "manual mode ON",
      command: manual_command,
      duration: manual_duration_display
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

// ================= SET AUTO =================
app.post("/auto", (req, res) => {
  manual_control = false;
  manual_command = 0;
  manual_duration = 0;
  manual_duration_display = 0;

  if (irrigationTimer) {
    clearTimeout(irrigationTimer);
    irrigationTimer = null;
  }

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
    let { temperature, humidity, pressure, illuminance, co2, soil, water_temp, auto_cmd } = req.body;

    console.log("📥 RAW:", req.body);

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

    const t = temperature ?? null;
    const h = humidity ?? null;
    const p = pressure ?? null;
    const l = illuminance ?? null;
    const c = co2 ?? null;
    const s = soil ?? null;
    const w = water_temp ?? null;
    const a = auto_cmd ?? 0;

    if (
      t === null &&
      h === null &&
      p === null &&
      l === null &&
      c === null &&
      s === null &&
      w === null
    ) {
      console.log("⚠️ Pachet gol ignorat");
      return res.json({ status: "ignored empty packet" });
    }

    console.log("✅ FINAL INSERT:", { t, h, p, l, c, s, w });

    await client.query(
      `INSERT INTO sensor_data 
      (temperature, humidity, pressure, illuminance, co2, soil, water_temp, auto_cmd) 
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [t, h, p, l, c, s, w, a]
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
