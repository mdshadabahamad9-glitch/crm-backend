const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const authRoutes = require("./auth");
const Brevo = require("@getbrevo/brevo");
const { jsPDF } = require("jspdf");
const { autoTable } = require("jspdf-autotable");
const userRoutes = require("./settings"); // 👈 add this line




require("dotenv").config(); // <-- MUST be at the very top

const app = express();
const PORT = process.env.PORT || 4000;
const generateInvoicePDF = (invoice) => {
  const doc = new jsPDF();

  // --- HEADER ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Desynefy", 14, 20);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Design Anything. Inspire Everyone.", 14, 26);

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", 160, 20);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Invoice No: ${invoice.id}`, 160, 28);
  doc.text(
    `Date: ${new Date(invoice.issueDate).toLocaleDateString()}`,
    160,
    34
  );

  // --- ADDRESSES ---
  doc.setFont("helvetica", "bold");
  doc.text("Billing Address:", 14, 45);
  doc.text("Delivery Address:", 110, 45);

  doc.setFont("helvetica", "normal");
  doc.text(`${invoice.clientName || "Client Name"}`, 14, 52);
  doc.text(`${invoice.clientAddress || "Client Address"}`, 14, 58);
  doc.text(`${invoice.clientPhone || "Client Phone"}`, 14, 64);

  doc.text(`${invoice.deliveryName || "Delivery Name"}`, 110, 52);
  doc.text(`${invoice.deliveryAddress || "Delivery Address"}`, 110, 58);
  doc.text(`${invoice.deliveryPhone || "Delivery Phone"}`, 110, 64);

  // --- INVOICE TABLE ---
  const items = invoice.items || [
    {
      description: "Service or Product",
      quantity: 1,
      unitPrice: invoice.amount,
      total: invoice.amount,
    },
  ];

  autoTable(doc, {
  startY: 75,
  head: [["QTY", "DESCRIPTION", "UNIT PRICE", "AMOUNT"]],
  body: items.map((it) => [
    it.quantity,
    it.description,
    `$${it.unitPrice.toFixed(2)}`,
    `$${it.total.toFixed(2)}`,
  ]),
  theme: "grid",
  styles: { fontSize: 10, cellPadding: 3, lineColor: [220, 220, 220], lineWidth: 0.2 },
  headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
});

  // --- TOTALS ---
  const finalY = doc.lastAutoTable.finalY || 85;
  const subtotal = invoice.amount;
  const tax = (subtotal * 0.05).toFixed(2);
  const total = (subtotal + Number(tax)).toFixed(2);

  doc.setFontSize(11);
  doc.text("Subtotal:", 150, finalY + 10);
  doc.text(`$${subtotal.toFixed(2)}`, 180, finalY + 10, { align: "right" });
  doc.text("Tax (5%):", 150, finalY + 16);
  doc.text(`$${tax}`, 180, finalY + 16, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL DUE:", 150, finalY + 24);
  doc.text(`$${total}`, 180, finalY + 24, { align: "right" });

  // --- FOOTER ---
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Please make all payments to Your Company Name.", 14, finalY + 40);
  doc.text("For inquiries: contact@yourcompany.com | +1 (555) 123-4567", 14, finalY + 46);
  doc.setFont("helvetica", "bold");
  doc.text("THANK YOU FOR YOUR BUSINESS!", 70, finalY + 60);

  // Return buffer as base64
  return doc.output("arraybuffer");
};

// ✅ Use cors correctly
app.use(
  cors({
    origin: "*",
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

const taskRoutes = require("./task")(db);
app.use("/api/tasks", taskRoutes);

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
    const {
      name,
      email,
      phone,
      status = "New",
      lead_stage = "NEW_LEAD",
      price,
    } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and phone are required",
      });
    }
    const dealValue = parseFloat(price) || 0;

    const [result] = await db.query(
      "INSERT INTO leads (name, email, phone, status, lead_stage,price, last_contacted) VALUES (?, ?, ?, ?, ?, NOW())",
      [name, email, phone, status, lead_stage, dealValue]
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

// Route: get all invoices
app.get("/api/invoices", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM invoices ORDER BY id DESC");
    res.json(rows);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ error: "Database error while fetching invoices" });
  }
});
const brevo = new Brevo.TransactionalEmailsApi();
brevo.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

app.post("/api/invoices/add", async (req, res) => {
  try {
    const {
      leadName,
      clientName,
      clientEmail, // ✅ add client email for sending PDF
      clientAddress,
      clientPhone,
      deliveryName,
      deliveryAddress,
      deliveryPhone,
      amount,
      status,
      issueDate,
      dueDate,
      items,
    } = req.body;

    // Required fields
    if (!leadName || !amount || !issueDate || !dueDate || !clientEmail) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const [result] = await db.query(
      `INSERT INTO invoices 
      (leadName, clientName, clientAddress, clientPhone, deliveryName, deliveryAddress, deliveryPhone, amount, status, issueDate, dueDate, items) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        leadName,
        clientName || null,
        clientAddress || null,
        clientPhone || null,
        deliveryName || null,
        deliveryAddress || null,
        deliveryPhone || null,
        amount,
        status || "Pending",
        issueDate,
        dueDate,
        JSON.stringify(items || []),
      ]
    );

    const newInvoice = {
      id: result.insertId,
      leadName,
      clientName,
      clientEmail,
      clientAddress,
      clientPhone,
      deliveryName,
      deliveryAddress,
      deliveryPhone,
      amount,
      status,
      issueDate,
      dueDate,
      items,
    };

    // --- Generate PDF ---
    const pdfBuffer = generateInvoicePDF(newInvoice);
    const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

    // --- Send PDF via Brevo ---
    const sendSmtpEmail = new Brevo.SendSmtpEmail();
    sendSmtpEmail.sender = { name: "Desynefy", email: "mdshadabahamad9@gmail.com" };
    sendSmtpEmail.to = [{ email: clientEmail, name: clientName || "Client" }];
    sendSmtpEmail.subject = `Invoice #${newInvoice.id} from Desynefy`;
    sendSmtpEmail.htmlContent = `<p>Hello ${clientName || "Client"},</p>
    <p>Your invoice #${newInvoice.id} is attached.</p>`;
    sendSmtpEmail.attachment = [
      {
        content: pdfBase64,
        name: `invoice_${newInvoice.id}.pdf`,
        type: "application/pdf",
      },
    ];

    await brevo.sendTransacEmail(sendSmtpEmail);

    res.json(newInvoice);
  } catch (error) {
    console.error("Error adding invoice:", error);
    res.status(500).json({ message: "Server error" });
  }
});
app.use("/api/user", userRoutes); // 👈 mount it



app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);
