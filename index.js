const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
require("dotenv").config();
const products = require("./products");
const app = express();
app.use(cors());
app.use(bodyParser.json());

// enrich للعناصر بناءً على اللي في products.js
function enrichItems(items) {
  return items.map(item => {
    const prod = products.find(p => p.id === item.id);
    if (prod) {
      return {
        id: prod.id,
        name: prod.name,
        price: prod.price,
        quantity: Number(item.quantity) || 0,
      };
    }
    return {
      id: item.id || "unknown",
      name: item.name || "غير معروف",
      price: Number(item.price) || 0,
      quantity: Number(item.quantity) || 0,
    };
  });
}

function calculateTotal(items) {
  return items.reduce((sum, it) => sum + (it.price || 0) * (it.quantity || 0), 0);
}

function buildItemsTable(items) {
  const rows = items
    .map(
      it => `
      <tr>
        <td>${it.name}</td>
        <td>${it.quantity}</td>
        <td>${it.price.toLocaleString()}</td>
        <td>${(it.price * it.quantity).toLocaleString()}</td>
      </tr>`
    )
    .join("\n");
  return `
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; width:100%; font-family: Arial, sans-serif;">
      <thead>
        <tr style="background:#f2f2f2;">
          <th>المنتج</th>
          <th>الكمية</th>
          <th>سعر الوحدة</th>
          <th>الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr>
          <td colspan="3" style="text-align:right; font-weight:bold;">المجموع الكلي</td>
          <td style="font-weight:bold;">${calculateTotal(items).toLocaleString()}</td>
        </tr>
      </tbody>
    </table>
  `;
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// حماية خفيفة ضد الإرسال السريع
const recentRequests = new Map();
const MIN_INTERVAL_MS = 2000;

app.post("/api/order", async (req, res) => {
  try {
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    const now = Date.now();
    const last = recentRequests.get(ip) || 0;
    if (now - last < MIN_INTERVAL_MS) {
      return res.status(429).json({ success: false, message: "بتبعت بسرعة شوية، استنى." });
    }
    recentRequests.set(ip, now);

    let { name, phone, address, items } = req.body;

    if (!name || !phone || !address || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "محتاج الاسم، التليفون، العنوان، و منتجات." });
    }

    items = enrichItems(items);

    for (const it of items) {
      if (!it.name || typeof it.price === "undefined" || typeof it.quantity === "undefined") {
        return res.status(400).json({ success: false, message: "كل عنصر لازم يكون فيه name, price, quantity." });
      }
    }

    const total = calculateTotal(items);
    const itemsHtml = buildItemsTable(items);

    const mailHtml = `
      <div style="font-family: Arial, sans-serif; direction: rtl;">
        <h2>طلب جديد من العميل</h2>
        <p><strong>اسم العميل:</strong> ${name}</p>
        <p><strong>رقم التليفون:</strong> ${phone}</p>
        <p><strong>العنوان:</strong> ${address}</p>
        <h3>تفاصيل العربة:</h3>
        ${itemsHtml}
        <p style="margin-top:20px;"><strong>تاريخ الطلب:</strong> ${new Date().toLocaleString("ar-EG")}</p>
      </div>
    `;

    await transporter.sendMail({
      from: `"طلب جديد" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: `طلب جديد من ${name} - إجمالي: ${total.toLocaleString()}`,
      html: mailHtml,
    });

    return res.json({ success: true, message: "تم إرسال الطلب على الإيميل.", total });
  } catch (error) {
    console.error("Order error:", error);
    return res.status(500).json({ success: false, message: "حصل خطأ داخلي." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
