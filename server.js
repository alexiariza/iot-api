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

// 🔥 FIX PUBLIC FOLDER
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "public")));

// 🔥 DB CONNECTION
const pool = new Pool({
  connectionString: "postgresql://iot_db_3whd_user:ql42HXPaY8poPqjoIrWz45yjdKSmITmJ@dpg-d6tvtqchg0os738338j0-a/iot_db_3whd",
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


// 🔥 TEST API
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/login.html"));
});

// 🔥 FIX DB (opțional)
app.get("/fix-db", async (req, res) => {
  try {
    // Adăugăm rând pe rând toate coloanele posibile, fără să ne oprim dacă una există deja
    await pool.query("ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS temperature FLOAT");
    await pool.query("ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS humidity FLOAT");
    await pool.query("ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS pressure FLOAT");
    await pool.query("ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS illuminance FLOAT");
    await pool.query("ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS co2 FLOAT");
    await pool.query("ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS soil FLOAT");
    await pool.query("ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS water_temp FLOAT");
    await pool.query("ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS command INTEGER");
    
    res.send("✅ Baza de date a fost actualizată cu succes!");
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ Eroare: " + err.message);
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
  let client;

  try {
    let { temperature, humidity, pressure, illuminance, co2, soil, water_temp } = req.body;

    console.log("📥 RAW:", req.body);

    // 🔥 retry connect
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

    // 🔥 LUĂM ULTIMA VALOARE DIN DB
    const last = await client.query(
      "SELECT * FROM sensor_data ORDER BY id DESC LIMIT 1"
    );

    const prev = last.rows[0] || {};

    // 🔥 păstrăm ultima valoare dacă vine null
    const t = temperature ?? prev.temperature ?? null;
    const h = humidity ?? prev.humidity ?? null;
    const p = pressure ?? prev.pressure ?? null;
    const l = illuminance ?? prev.illuminance ?? null;
    const c = co2 ?? prev.co2 ?? null;
    const s = soil ?? prev.soil ?? null;
    const w = water_temp ?? prev.water_temp ?? null;

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

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (username === "admin" && password === "admin123") {
    return res.json({ success: true });
  }

  res.json({ success: false });
});


// 🔥 START SERVER
app.listen(process.env.PORT || 10000, () => {
  console.log("🚀 Server running");
});
