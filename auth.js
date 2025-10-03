const express = require("express");
const bcrypt = require("bcryptjs"); // for password hashing
const jwt = require("jsonwebtoken");
const mysql = require("mysql2/promise");
const nodemailer = require("nodemailer");
const Brevo = require("@getbrevo/brevo");

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
const brevo = new Brevo.TransactionalEmailsApi();
brevo.setApiKey(
  Brevo.TransactionalEmailsApiApiKeys.apiKey,
process.env.BREVO_API_KEY);


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

    // Send email with Brevo
    const sendSmtpEmail = new Brevo.SendSmtpEmail();
    sendSmtpEmail.sender = {
      name: "CRM Support",
      email: "mdshadabahamad9@gmail.com", // you can use your support email
    };
    sendSmtpEmail.to = [{ email, name }];
    sendSmtpEmail.subject = "Welcome! Your Account Password";
      sendSmtpEmail.htmlContent = `
<div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;padding:20px;background:#f7f7f9;border-radius:8px;border:1px solid #e0e0e0;">

  <div style="text-align:center;margin-bottom:20px;">
    <h1 style="color:#4f46e5;margin:0;font-size:28px;">Welcome to Desynefy!</h1>
    <p style="color:#555;font-size:14px;margin:5px 0 0;">We’re thrilled to have you on board 🎉</p>
  </div>

  <div style="padding:20px;background:#ffffff;border-radius:8px;border:1px solid #ddd;">
    <p style="color:#333;font-size:16px;">Hello <strong>${name}</strong>,</p>
    <p style="color:#333;font-size:16px;">
      Thank you for registering with Desynefy! We’re excited to have you join our community.
    </p>

    <p style="color:#333;font-size:16px;">
      Here’s your temporary password to get started:
    </p>

    <p style="text-align:center;margin:20px 0;">
      <span style="display:inline-block;background-color:#4f46e5;color:#ffffff;font-size:18px;padding:10px 20px;border-radius:5px;font-weight:bold;">
        ${password}
      </span>
    </p>

    <p style="color:#333;font-size:16px;">
      Please log in and change it to something memorable. Enjoy exploring Desynefy!
    </p>

    <p style="color:#888;font-size:14px;margin-top:20px;">
      If you have any questions, our support team is always ready to help.
    </p>
  </div>

  <div style="text-align:center;margin-top:20px;color:#555;font-size:12px;">
    &copy; ${new Date().getFullYear()} Desynefy. All rights reserved.
  </div>

</div>
`;

    await brevo.sendTransacEmail(sendSmtpEmail);

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
      "SELECT * FROM users WHERE email=?",
      [email]
    );

    if (rows.length === 0) {
      await connection.end();
      return res.status(400).json({ error: "Email not found" });
    }

    const user = rows[0];

    // Generate and hash new password
    const newPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await connection.execute("UPDATE users SET password=? WHERE email=?", [
      hashedPassword,
      email,
    ]);
    await connection.end();

    // Send email with Brevo
    const sendSmtpEmail = new Brevo.SendSmtpEmail();
    sendSmtpEmail.sender = {
      name: "CRM Support",
      email: "mdshadabahamad9@gmail.com",
    }; // can use your Gmail here
    sendSmtpEmail.to = [{ email: email, name: user.name }];
    sendSmtpEmail.subject = "Your New Password";
   sendSmtpEmail.htmlContent = `<div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;padding:20px;background:#f7f7f9;border-radius:8px;border:1px solid #e0e0e0;">
  
  <div style="text-align:center;margin-bottom:20px;">
    <h1 style="color:#4f46e5;margin:0;font-size:24px;">Desynefy</h1>
    <p style="color:#555;font-size:14px;margin:5px 0 0;">Password Reset Request</p>
  </div>

  <div style="padding:20px;background:#ffffff;border-radius:8px;border:1px solid #ddd;">
    <p style="color:#333;font-size:16px;">Hello <strong>${
      user.name
    }</strong>,</p>
    <p style="color:#333;font-size:16px;">We received a request to reset your password. Your new password is:</p>

    <p style="text-align:center;margin:20px 0;">
      <span style="display:inline-block;background-color:#4f46e5;color:#ffffff;font-size:18px;padding:10px 20px;border-radius:5px;font-weight:bold;">
        ${newPassword}
      </span>
    </p>

    <p style="color:#333;font-size:16px;">Please log in using this password .</p>

    <p style="color:#888;font-size:14px;margin-top:20px;">If you did not request a password reset, please ignore this email or contact our support team.</p>
  </div>

  <div style="text-align:center;margin-top:20px;color:#555;font-size:12px;">
    &copy; ${new Date().getFullYear()} Desynefy. All rights reserved.
  </div>
</div>`;

    await brevo.sendTransacEmail(sendSmtpEmail);

    res.json({ message: "New password sent to your email" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
