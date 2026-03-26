import express from "express";
import pkg from "pg";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const { Pool } = pkg;

const app = express();

app.use(cors());
app.use(express.json());

// 🔥 FIX PUBLIC FOLDER (FOARTE IMPORTANT)
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
app.get("/fix-db", async (req, res) => {
  try {
    await pool.query("ALTER TABLE sensor_data ADD COLUMN command INTEGER");
    res.send("✅ command column added");
  } catch (err) {
    res.send("❌ " + err.message);
  }
});

// 🔥 INSERT DATA
app.post("/command", async (req, res) => {
  try {
    const { command } = req.body;

    console.log("🔥 COMMAND RECEIVED:", command);

    // 🔥 salvăm comanda în DB
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
app.post("/insert", async (req, res) => {
  try {
    const { temperature, humidity, pressure, illuminance } = req.body;

    await pool.query(
      "INSERT INTO sensor_data (temperature, humidity, pressure, illuminance) VALUES ($1,$2,$3,$4)",
      [temperature, humidity, pressure, illuminance]
    );

    res.send("DATA SAVED");

  } catch (err) {
    console.error(err);
    res.status(500).send("ERROR");
  }
});
