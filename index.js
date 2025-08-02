const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// إعداد الإيميل
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Endpoint لاستقبال الطلبات
app.post("/api/order", async (req, res) => {
  try {
    const { name, phone, address, quantity, product } = req.body;

    await transporter.sendMail({
      from: `"طلب جديد" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: `طلب جديد: ${product}`,
      text: `
        اسم العميل: ${name}
        رقم الهاتف: ${phone}
        العنوان: ${address}
        الكمية: ${quantity}
        المنتج: ${product}
      `,
    });

    res.json({ success: true, message: "تم إرسال الطلب إلى الإيميل" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "حصل خطأ في إرسال الطلب" });
  }
});

app.listen(5000, () => console.log("✅ Server running on port 5000"));
