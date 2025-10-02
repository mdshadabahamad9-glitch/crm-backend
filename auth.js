const express = require("express");
const bcrypt = require("bcryptjs"); // for password hashing
const jwt = require("jsonwebtoken");
const mysql = require("mysql2/promise");
const nodemailer = require("nodemailer");

require("dotenv").config(); // <-- MUST be at the very top

const router = express.Router();

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 3306,
};

// Secret key for JWT
const JWT_SECRET = "yourjwtsecret"; // ❗ move to .env in production

// ✅ Login route
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  console.log("hiiii", dbConfig);

  try {
    const connection = await mysql.createConnection(dbConfig);

    // Check if user exists
    const [rows] = await connection.execute(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );
    await connection.end();

    if (rows.length === 0) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const user = rows[0];

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        error: "Invalid email or password",
        password,
        opp: user.password,
        ppp: await bcrypt.hash(password, 10),
      });
    }

    // Create JWT
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({
      message: "Login successful",
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Register route (optional)
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const connection = await mysql.createConnection(dbConfig);

    // Check if email exists
    const [rows] = await connection.execute(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );
    if (rows.length > 0) {
      await connection.end();
      return res.status(400).json({ error: "Email already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    await connection.execute(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, hashedPassword]
    );
    await connection.end();

    // Configure Gmail transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "mdshadabahamad9@gmail.com",
        pass: "nple vrzi wysg nkuv",
      },
    });

    // Send password via email
    await transporter.sendMail({
      from: `"CRM Support" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Your Account Password",
      html: `<p>Hello ${name},</p>
             <p>Thank you for registering. Your password is:</p>
             <b>${password}</b>
             <p>Please keep it safe and change it after logging in.</p>`,
    });

    res.json({
      message: "User registered successfully. Password sent to email.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (rows.length === 0) {
      await connection.end();
      return res.status(400).json({ error: "Email not found" });
    }

    const user = rows[0];

    // Generate random new password
    const newPassword = Math.random().toString(36).slice(-8); // e.g., 8 chars
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update DB with new hashed password
    await connection.execute("UPDATE users SET password=? WHERE email=?", [
      hashedPassword,
      email,
    ]);
    await connection.end();

    // Configure Gmail transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "mdshadabahamad9@gmail.com",
        pass: "nple vrzi wysg nkuv",
      },
    });

    // Send new password via email
    await transporter.sendMail({
      from: `"CRM Support" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Your New Password",
      html: `<p>Hello ${user.name},</p>
             <p>Your password has been reset. Your new password is:</p>
             <b>${newPassword}</b>
             <p>Please log in and change it after logging in.</p>`,
    });

    res.json({ message: "New password sent to your email" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
