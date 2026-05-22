import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

// ─── Create reusable transporter ─────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: false },
});

transporter.verify((error) => {
  if (error) {
    console.error('❌ SMTP connection failed:', error.message);
  } else {
    console.log('✅ SMTP server ready to send emails');
  }
});

// ─── Shared email wrapper ─────────────────────────────────────────────────────
const baseTemplate = (content: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vikram Presence</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0A0A0B;
      font-family: 'Inter', Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      padding: 24px 16px;
    }
    .wrapper {
      max-width: 560px;
      margin: 0 auto;
    }
    .card {
      background: linear-gradient(145deg, #111113, #0d0d0f);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 24px 80px rgba(0,0,0,0.6);
    }
    .header {
      background: #E2F034;
      padding: 28px 32px;
      text-align: center;
    }
    .logo-mark {
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }
    .logo-icon {
      width: 36px;
      height: 36px;
      background: #000;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .logo-text {
      font-size: 15px;
      font-weight: 900;
      color: #000;
      letter-spacing: 0.15em;
      text-transform: uppercase;
    }
    .body {
      padding: 40px 32px;
    }
    .greeting {
      font-size: 22px;
      font-weight: 900;
      color: #ffffff;
      margin-bottom: 12px;
      line-height: 1.3;
    }
    .subtext {
      font-size: 14px;
      color: rgba(255,255,255,0.5);
      line-height: 1.7;
      margin-bottom: 28px;
    }
    .divider {
      height: 1px;
      background: rgba(255,255,255,0.06);
      margin: 28px 0;
    }
    .footer {
      padding: 20px 32px 28px;
      text-align: center;
      border-top: 1px solid rgba(255,255,255,0.04);
    }
    .footer p {
      font-size: 11px;
      color: rgba(255,255,255,0.2);
      line-height: 1.8;
    }
    .footer a {
      color: #E2F034;
      text-decoration: none;
    }
    @media (max-width: 600px) {
      .body { padding: 28px 20px; }
      .header { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="logo-mark">
          <div class="logo-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 4.5L7 10.5L13 4.5M1 1L7 7L13 1" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <span class="logo-text">VIKRAM PRESENCE</span>
        </div>
      </div>
      <div class="body">
        ${content}
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} Vikram Presence. All rights reserved.</p>
        <p style="margin-top:4px;">If you didn't expect this email, please ignore it or <a href="mailto:vikrampresence@gmail.com">contact support</a>.</p>
      </div>
    </div>
    <p style="text-align:center;margin-top:16px;font-size:11px;color:rgba(255,255,255,0.15);">
      This is an automated message. Please do not reply directly to this email.
    </p>
  </div>
</body>
</html>
`;

// ─── PREMIUM OTP Email ────────────────────────────────────────────────────────
export const sendOTPEmail = async (to: string, name: string, otp: string): Promise<void> => {
  const firstName = name.split(' ')[0];

  const content = `
    <p class="greeting">Hey ${firstName} 👋</p>
    <p class="subtext">
      You requested a verification code to complete your purchase or account setup.
      Enter the code below to continue — it is only valid for <strong style="color:#E2F034">10 minutes</strong>.
    </p>

    <!-- OTP Display Block -->
    <div style="
      background: #000;
      border: 1px solid rgba(226,240,52,0.25);
      border-radius: 18px;
      padding: 32px 20px;
      text-align: center;
      margin: 8px 0 24px;
      position: relative;
      overflow: hidden;
    ">
      <div style="
        position: absolute; top: 0; left: 0; right: 0; height: 3px;
        background: linear-gradient(90deg, #E2F034, #fef08a, #E2F034);
      "></div>
      <p style="font-size:11px;color:rgba(255,255,255,0.3);letter-spacing:0.2em;text-transform:uppercase;margin-bottom:16px;">
        Your One-Time Code
      </p>
      <div style="
        font-size: 52px;
        font-weight: 900;
        letter-spacing: 14px;
        color: #E2F034;
        font-family: 'Courier New', monospace;
        text-shadow: 0 0 30px rgba(226,240,52,0.4);
        padding-left: 14px;
      ">${otp}</div>
      <p style="font-size:11px;color:rgba(255,255,255,0.2);margin-top:16px;letter-spacing:0.1em;">
        Expires in 10:00 minutes
      </p>
    </div>

    <div class="divider"></div>

    <!-- Security Notes -->
    <div style="display:flex;flex-direction:column;gap:10px;">
      <div style="display:flex;align-items:flex-start;gap:12px;padding:14px;background:rgba(255,255,255,0.02);border-radius:12px;border:1px solid rgba(255,255,255,0.04);">
        <span style="font-size:16px;flex-shrink:0;">🔒</span>
        <p style="font-size:12px;color:rgba(255,255,255,0.4);line-height:1.6;margin:0;">
          <strong style="color:rgba(255,255,255,0.7);">Keep this code private.</strong>
          Vikram Presence will never ask you for your OTP via phone, chat, or email.
        </p>
      </div>
      <div style="display:flex;align-items:flex-start;gap:12px;padding:14px;background:rgba(255,255,255,0.02);border-radius:12px;border:1px solid rgba(255,255,255,0.04);">
        <span style="font-size:16px;flex-shrink:0;">⏱️</span>
        <p style="font-size:12px;color:rgba(255,255,255,0.4);line-height:1.6;margin:0;">
          This code expires automatically. If it expires, you can request a new one from the checkout page.
        </p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Vikram Presence" <${process.env.SMTP_USER}>`,
    to,
    subject: `${otp} — Your Vikram Presence Verification Code`,
    html: baseTemplate(content),
  });
};

// ─── PREMIUM Purchase Confirmation + Ebook Delivery Email ─────────────────────
export const sendEbookEmail = async (
  to: string,
  name: string,
  bookTitle: string,
  downloadUrl: string,
  amount?: number,
  orderId?: string
): Promise<void> => {
  const firstName = name.split(' ')[0];
  const orderDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const content = `
    <!-- Success Badge -->
    <div style="text-align:center;margin-bottom:28px;">
      <div style="
        width: 64px; height: 64px; border-radius: 50%;
        background: rgba(16,185,129,0.1);
        border: 1px solid rgba(16,185,129,0.3);
        display: inline-flex; align-items: center; justify-content: center;
        margin-bottom: 16px;
        font-size: 28px;
      ">✅</div>
      <p style="font-size:11px;color:#10b981;letter-spacing:0.2em;text-transform:uppercase;font-weight:700;">
        Purchase Confirmed
      </p>
    </div>

    <p class="greeting">Hey ${firstName}, your purchase is ready! 🎉</p>
    <p class="subtext">
      Thank you for investing in yourself. Your digital product is confirmed and your download link is ready below.
    </p>

    <!-- Product Card -->
    <div style="
      background: #000;
      border: 1px solid rgba(226,240,52,0.2);
      border-radius: 16px;
      padding: 24px;
      margin: 8px 0 24px;
    ">
      <div style="
        background: rgba(226,240,52,0.05);
        border-radius: 10px;
        padding: 14px 18px;
        margin-bottom: 16px;
      ">
        <p style="font-size:11px;color:rgba(255,255,255,0.3);letter-spacing:0.15em;text-transform:uppercase;margin-bottom:6px;">Product Purchased</p>
        <p style="font-size:18px;font-weight:900;color:#E2F034;line-height:1.3;">${bookTitle}</p>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        ${amount ? `
        <div style="padding:12px;background:rgba(255,255,255,0.02);border-radius:8px;border:1px solid rgba(255,255,255,0.04);">
          <p style="font-size:10px;color:rgba(255,255,255,0.3);letter-spacing:0.15em;text-transform:uppercase;margin-bottom:4px;">Amount Paid</p>
          <p style="font-size:16px;font-weight:900;color:#fff;">₹${amount.toLocaleString('en-IN')}</p>
        </div>` : ''}
        <div style="padding:12px;background:rgba(255,255,255,0.02);border-radius:8px;border:1px solid rgba(255,255,255,0.04);">
          <p style="font-size:10px;color:rgba(255,255,255,0.3);letter-spacing:0.15em;text-transform:uppercase;margin-bottom:4px;">Order Date</p>
          <p style="font-size:12px;font-weight:700;color:#fff;">${orderDate}</p>
        </div>
        ${orderId ? `
        <div style="padding:12px;background:rgba(255,255,255,0.02);border-radius:8px;border:1px solid rgba(255,255,255,0.04);">
          <p style="font-size:10px;color:rgba(255,255,255,0.3);letter-spacing:0.15em;text-transform:uppercase;margin-bottom:4px;">Order ID</p>
          <p style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.6);word-break:break-all;">${orderId}</p>
        </div>` : ''}
      </div>
    </div>

    <!-- Download Button -->
    <div style="text-align:center;margin:24px 0;">
      <a href="${downloadUrl}"
        style="
          display: inline-block;
          background: #E2F034;
          color: #000;
          font-weight: 900;
          font-size: 13px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          padding: 18px 40px;
          border-radius: 100px;
          text-decoration: none;
          box-shadow: 0 0 30px rgba(226,240,52,0.3);
        "
      >
        ⬇ Download Your Product
      </a>
      <p style="font-size:11px;color:rgba(255,255,255,0.25);margin-top:12px;">
        This link is for your personal use only. Please do not share it.
      </p>
    </div>

    <div class="divider"></div>

    <!-- Thank You Note -->
    <div style="
      padding: 20px;
      background: rgba(226,240,52,0.03);
      border-radius: 14px;
      border: 1px solid rgba(226,240,52,0.08);
      text-align: center;
    ">
      <p style="font-size:13px;color:rgba(255,255,255,0.6);line-height:1.7;margin:0;">
        <strong style="color:#fff;">Thank you for being part of the journey.</strong><br />
        You've made a decision most people only think about. Now execute it relentlessly.
      </p>
      <p style="font-size:12px;color:rgba(255,255,255,0.3);margin-top:10px;">
        Need help? Email us at 
        <a href="mailto:vikrampresence@gmail.com" style="color:#E2F034;text-decoration:none;">
          vikrampresence@gmail.com
        </a>
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Vikram Presence" <${process.env.SMTP_USER}>`,
    to,
    subject: `🎉 Your Purchase is Confirmed — "${bookTitle}" | Vikram Presence`,
    html: baseTemplate(content),
  });
};

// ─── Contact Form Notification ─────────────────────────────────────────────────
export const sendContactNotification = async (
  senderName: string,
  senderEmail: string,
  subject: string,
  message: string
): Promise<void> => {
  await transporter.sendMail({
    from: `"Vikram Presence Contact" <${process.env.SMTP_USER}>`,
    to: process.env.SMTP_USER,
    replyTo: senderEmail,
    subject: `[Contact] ${subject} — from ${senderName}`,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#111;color:#fff;border-radius:16px;border:1px solid #222;">
        <div style="background:#E2F034;padding:16px 20px;border-radius:10px;margin-bottom:24px;">
          <h2 style="color:#000;margin:0;font-size:16px;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;">
            📬 New Contact Form Submission
          </h2>
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:10px 0;border-bottom:1px solid #222;color:rgba(255,255,255,0.4);font-size:12px;width:100px;">From</td>
              <td style="padding:10px 0;border-bottom:1px solid #222;color:#fff;font-weight:700;">${senderName}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #222;color:rgba(255,255,255,0.4);font-size:12px;">Email</td>
              <td style="padding:10px 0;border-bottom:1px solid #222;"><a href="mailto:${senderEmail}" style="color:#E2F034;">${senderEmail}</a></td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #222;color:rgba(255,255,255,0.4);font-size:12px;">Subject</td>
              <td style="padding:10px 0;border-bottom:1px solid #222;color:#fff;font-weight:700;">${subject}</td></tr>
        </table>
        <div style="margin-top:20px;padding:16px;background:#0d0d0f;border-radius:10px;border:1px solid #1a1a1a;">
          <p style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:10px;">Message</p>
          <p style="color:rgba(255,255,255,0.8);line-height:1.7;font-size:14px;">${message.replace(/\n/g, '<br>')}</p>
        </div>
      </div>
    `,
  });
};

export default transporter;
