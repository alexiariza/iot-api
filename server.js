import express from "express";
import pkg from "pg";
import cors from "cors";

const { Pool } = pkg;

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: "postgresql://iot_db_3whd_user:ql42HXPaY8poPqjoIrWz45yjdKSmITmJ@dpg-d6tvtqchg0os738338j0-a.oregon-postgres.render.com/iot_db_3whd",
  ssl: { rejectUnauthorized: false },
});

// 🔥 AUTO CREATE TABLE
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
  console.log("TABLE READY");
}

initDB();

// 🔥 TEST
app.get("/", (req, res) => {
  res.send("API WORKING");
});

// 🔥 INSERT
app.post("/insert", async (req, res) => {
  try {
    const { temperature, humidity, pressure, light } = req.body;

    await pool.query(
      `INSERT INTO sensor_data (temperature, humidity, pressure, illuminance)
       VALUES ($1, $2, $3, $4)`,
      [temperature, humidity, pressure, light]
    );

    res.send("OK");
  } catch (err) {
    console.error(err);
    res.status(500).send("ERROR");
  }
});

app.listen(process.env.PORT || 10000);
app.get("/data", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM sensor_data ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("ERROR");
  }
});
