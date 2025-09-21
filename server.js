const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const authRoutes = require("./auth");

const app = express();
const PORT = process.env.PORT || 4000;

// ✅ Use cors correctly
app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());
app.use("/api/auth", authRoutes);

// ✅ Create a pool instead of creating connections everywhere
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 3306,
});

// Route: get all leads
app.get("/api/leads", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM leads");
    res.json(rows);
  } catch (error) {
    console.error("DB error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// Route: update lead status
app.post("/api/leads/update-status", async (req, res) => {
  try {
    const { id, lead_stage } = req.body;

    if (!id || !lead_stage) {
      return res
        .status(400)
        .json({ success: false, message: "Missing id or lead_stage" });
    }

    const [result] = await db.query(
      "UPDATE leads SET lead_stage = ? WHERE id = ?",
      [lead_stage, id]
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Lead not found" });
    }

    res.json({ success: true, message: "Lead status updated successfully" });
  } catch (error) {
    console.error("Error updating lead status:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
// Route: add new lead
app.post("/api/leads/add", async (req, res) => {
  try {
    const { name, email, phone, status = "New", lead_stage = "NEW_LEAD" } = req.body;

    if (!name || !email || !phone) {
      return res
        .status(400)
        .json({ success: false, message: "Name, email, and phone are required" });
    }

    const [result] = await db.query(
      "INSERT INTO leads (name, email, phone, status, lead_stage, last_contacted) VALUES (?, ?, ?, ?, ?, NOW())",
      [name, email, phone, status, lead_stage]
    );

    const newLead = {
      id: result.insertId,
      name,
      email,
      phone,
      status,
      lead_stage,
      last_contacted: new Date(), // send current timestamp
    };

    res.json(newLead);
  } catch (error) {
    console.error("Error adding lead:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);
