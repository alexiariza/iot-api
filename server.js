const express = require("express");
const fetch = require("node-fetch");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post("/insert", async (req, res) => {

    const { temperature, humidity, pressure, light } = req.body;

    const url = `https://irigatii-smart.infinityfreeapp.com/backend/insert_data.php?temperature=${temperature}&humidity=${humidity}&pressure=${pressure}&light=${light}`;

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });

        const text = await response.text();
        console.log("PHP RESPONSE:", text);

        res.send("OK");

    } catch (err) {
        console.log(err);
        res.send("ERROR");
    }
});

app.get("/", (req,res)=>{
    res.send("API WORKING");
});

app.listen(10000, () => {
    console.log("Server running");
});