const express = require("express");
const mysql = require("mysql2");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 🔥 DB (folosești DB ta de pe InfinityFree)
const db = mysql.createConnection({
    host: "sql300.infinityfree.com",
    user: "if0_XXXXXXX",
    password: "PAROLA_TA",
    database: "if0_XXXXXXX_lora_db"
});

db.connect(err => {
    if (err) console.log(err);
    else console.log("DB CONNECTED");
});

// 🔥 INSERT DATA (de la Python)
app.post("/insert", (req, res) => {

    const { temperature, humidity, pressure, light } = req.body;

    const sql = `
    INSERT INTO sensor_data (temperature, humidity, pressure, illuminance)
    VALUES (?, ?, ?, ?)
    `;

    db.query(sql, [temperature, humidity, pressure, light], (err) => {
        if (err) {
            console.log(err);
            return res.send("ERROR");
        }

        res.send("OK");
    });
});

// 🔥 TEST
app.get("/", (req, res) => {
    res.send("API WORKING");
});

app.listen(10000, () => {
    console.log("Server running on 10000");
});