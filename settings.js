// user.js
const express = require("express");
const mysql = require("mysql2/promise");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const router = express.Router();

// MySQL Config
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 3306,
};

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader)
    return res.status(401).json({ error: "No authorization header" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, "yourjwtsecret"); // ⚠️ move secret to .env
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Token error:", error);
    res.status(403).json({ error: "Invalid token" });
  }
};

// ✅ PUT /api/user/update-profile
router.put("/update-profile", verifyToken, async (req, res) => {
    console.log("oo")
  const { fullName, email, company, phone } = req.body;
  const userId = req.user.id;

  if (!fullName || !email) {
    return res.status(400).json({ error: "Full name and email are required" });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);

    const [result] = await connection.execute(
      `UPDATE users 
       SET name = ?, email = ?
       WHERE id = ?`,
      [fullName, email, userId]
    );

    await connection.end();

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // ✅ Return updated data for frontend + Redux
    res.json({
      id: userId,
      fullName,
      email,
      company,
      phone,
    });
  } catch (err) {
    console.error("Error updating profile:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
