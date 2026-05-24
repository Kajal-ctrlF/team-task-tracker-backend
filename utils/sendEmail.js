const nodemailer = require("nodemailer");

// ─────────────────────────────────────────────────────────────────────────────
// GMAIL SENDER — IMPORTANT EXPLANATION
// ─────────────────────────────────────────────────────────────────────────────
//
// WHAT WE CAN CONTROL (display name):
//   from: `"Team Task Tracker" <kajalp78388@gmail.com>`
//   → Email clients show: "Team Task Tracker"
//   → Clicking "from" reveals: kajalp78388@gmail.com
//
// WHAT WE CANNOT CONTROL with Gmail:
//   Gmail's SMTP server always sends from the authenticated Gmail address.
//   You CANNOT send from "no-reply@teamtasktracker.com" using Gmail SMTP
//   unless you actually own that domain and configure it in Google Workspace.
//
// WHY GMAIL SHOWS THE REAL ADDRESS:
//   Gmail adds a "sent via gmail.com" or "mailed-by: gmail.com" header.
//   This is Gmail's anti-spoofing policy — it prevents fake sender addresses.
//
// HOW REAL COMPANIES DO IT (for reference):
//   1. Buy a domain (e.g. teamtasktracker.com)
//   2. Use Google Workspace ($6/month) → get no-reply@teamtasktracker.com
//   3. OR use SendGrid / Mailgun / AWS SES (free tiers available)
//      → These allow custom "from" domains with proper DNS setup (SPF, DKIM)
//
// FOR THIS PROJECT (internship/learning):
//   We use Gmail with a professional display name.
//   This is standard practice for student/demo projects.
//   The display name "Team Task Tracker" makes it look professional
//   even though the underlying address is a Gmail account.
// ─────────────────────────────────────────────────────────────────────────────

// ── App config — change these to match your project ──────────────────────────
const APP_CONFIG = {
  name:        "Team Task Tracker",
  senderLabel: "Team Task Tracker",   // shown as sender name in email client
  supportNote: "This is an automated message. Please do not reply to this email.",
  year:        new Date().getFullYear(),
  // primaryColor matches the app's CSS variable --color-primary
  primaryColor:     "#4f46e5",
  primaryColorDark: "#4338ca",
};

// ── Create transporter ────────────────────────────────────────────────────────
const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// OTP EMAIL HTML TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────
// Design principles:
//   - All CSS is INLINE — email clients (Gmail, Outlook) strip <style> tags
//   - Max width 600px — standard email width
//   - Mobile-friendly: single column, large tap targets, readable font sizes
//   - No images — avoids spam filters and broken image issues
//   - Plain text fallback provided separately
// ─────────────────────────────────────────────────────────────────────────────

const getOtpEmailTemplate = (name, otp) => `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="format-detection" content="telephone=no" />
  <title>Reset Your Password — ${APP_CONFIG.name}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">

        <!-- Email card — max 600px -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
          style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;
                 box-shadow:0 4px 6px rgba(0,0,0,0.05),0 10px 30px rgba(0,0,0,0.08);">

          <!-- ── HEADER ─────────────────────────────────────────────── -->
          <tr>
            <td style="background:linear-gradient(135deg,${APP_CONFIG.primaryColor} 0%,${APP_CONFIG.primaryColorDark} 100%);
                       padding:36px 40px 32px;text-align:center;">

              <!-- Logo mark -->
              <div style="display:inline-block;width:56px;height:56px;
                          background:rgba(255,255,255,0.18);border-radius:14px;
                          line-height:56px;text-align:center;margin-bottom:14px;
                          font-size:26px;">
                ✓
              </div>

              <!-- App name -->
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;
                         letter-spacing:-0.3px;line-height:1.3;">
                ${APP_CONFIG.name}
              </h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">
                Password Reset Request
              </p>
            </td>
          </tr>

          <!-- ── BODY ───────────────────────────────────────────────── -->
          <tr>
            <td style="padding:36px 40px 28px;">

              <!-- Greeting -->
              <h2 style="margin:0 0 10px;color:#1e293b;font-size:22px;font-weight:700;
                         line-height:1.3;">
                Reset Your Password
              </h2>
              <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.7;">
                Hi <strong style="color:#1e293b;">${name}</strong>,
              </p>
              <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.7;">
                We received a request to reset the password for your
                <strong style="color:#1e293b;">${APP_CONFIG.name}</strong> account.
                Use the verification code below to proceed.
              </p>

              <!-- OTP Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                style="margin:0 0 28px;">
                <tr>
                  <td style="background:#f8fafc;border:2px solid ${APP_CONFIG.primaryColor};
                             border-radius:12px;padding:28px 24px;text-align:center;">

                    <p style="margin:0 0 10px;color:#64748b;font-size:12px;font-weight:600;
                               text-transform:uppercase;letter-spacing:1.5px;">
                      Your Verification Code
                    </p>

                    <!-- OTP digits — large, monospace, spaced -->
                    <div style="font-size:44px;font-weight:800;letter-spacing:14px;
                                color:${APP_CONFIG.primaryColor};font-family:'Courier New',Courier,monospace;
                                line-height:1.2;padding:4px 0;">
                      ${otp}
                    </div>

                    <!-- Expiry -->
                    <p style="margin:14px 0 0;color:#64748b;font-size:13px;line-height:1.5;">
                      ⏱&nbsp; This code expires in
                      <strong style="color:#1e293b;">10 minutes</strong>
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Steps -->
              <p style="margin:0 0 12px;color:#475569;font-size:14px;line-height:1.6;">
                <strong style="color:#1e293b;">How to use this code:</strong>
              </p>
              <ol style="margin:0 0 28px;padding-left:20px;color:#475569;font-size:14px;line-height:1.8;">
                <li>Go back to the password reset page</li>
                <li>Enter the 6-digit code above</li>
                <li>Create your new password</li>
              </ol>

              <!-- Security warning box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                style="margin:0 0 24px;">
                <tr>
                  <td style="background:#fffbeb;border-left:4px solid #f59e0b;
                             border-radius:0 8px 8px 0;padding:14px 18px;">
                    <p style="margin:0;color:#78350f;font-size:13px;line-height:1.6;">
                      <strong>⚠ Security Notice</strong><br />
                      If you did not request a password reset, please ignore this email.
                      Your password will <strong>not</strong> be changed unless you
                      complete the reset process. Do not share this code with anyone —
                      ${APP_CONFIG.name} will never ask for your OTP.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Fine print -->
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">
                This code is valid for a single use only and will expire automatically
                after 10 minutes. If you need a new code, visit the forgot password page again.
              </p>

            </td>
          </tr>

          <!-- ── DIVIDER ─────────────────────────────────────────────── -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background:#e2e8f0;"></div>
            </td>
          </tr>

          <!-- ── FOOTER ─────────────────────────────────────────────── -->
          <tr>
            <td style="padding:20px 40px 28px;text-align:center;">
              <p style="margin:0 0 6px;color:#94a3b8;font-size:12px;line-height:1.6;">
                ${APP_CONFIG.supportNote}
              </p>
              <p style="margin:0;color:#cbd5e1;font-size:11px;">
                © ${APP_CONFIG.year} ${APP_CONFIG.name} · All rights reserved
              </p>
            </td>
          </tr>

        </table>
        <!-- End email card -->

        <!-- Below-card note -->
        <p style="margin:20px 0 0;color:#94a3b8;font-size:12px;text-align:center;">
          You're receiving this because a password reset was requested for your account.
        </p>

      </td>
    </tr>
  </table>

</body>
</html>
`;

// ─────────────────────────────────────────────────────────────────────────────
// PLAIN TEXT FALLBACK
// ─────────────────────────────────────────────────────────────────────────────
// Some email clients (or spam filters) prefer plain text.
// Always provide a text version alongside HTML.

const getOtpPlainText = (name, otp) =>
  `Hi ${name},

We received a request to reset your ${APP_CONFIG.name} account password.

Your verification code is: ${otp}

This code expires in 10 minutes and can only be used once.

Steps:
1. Go back to the password reset page
2. Enter the 6-digit code above
3. Create your new password

SECURITY NOTICE:
If you did not request a password reset, please ignore this email.
Your password will not be changed. Do not share this code with anyone.

— ${APP_CONFIG.name} Team
This is an automated message. Please do not reply.`;

// ─────────────────────────────────────────────────────────────────────────────
// sendOtpEmail — main exported function
// ─────────────────────────────────────────────────────────────────────────────
//
// SENDER FORMAT EXPLAINED:
//   from: `"Team Task Tracker" <kajalp78388@gmail.com>`
//
//   What the recipient sees in their inbox:
//     Sender name:    "Team Task Tracker"   ← we control this
//     Sender address: kajalp78388@gmail.com ← Gmail forces this
//
//   Gmail will also show "via gmail.com" or "mailed-by: gmail.com"
//   in some clients. This is normal for Gmail SMTP — not a bug.
//
//   For a fully custom domain (no-reply@teamtasktracker.com), you would need:
//     - A domain you own
//     - Google Workspace OR a transactional email service (SendGrid, Mailgun)
//     - DNS records: SPF, DKIM, DMARC configured
//   This is beyond the scope of a student/internship project.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {string} toEmail  - recipient's email address
 * @param {string} name     - recipient's display name
 * @param {string} otp      - the 6-digit OTP string
 */
const sendOtpEmail = async (toEmail, name, otp) => {
  const transporter = createTransporter();

  await transporter.sendMail({
    // Display name is "Team Task Tracker" — looks professional in inbox
    // The actual sending address is the Gmail account (Gmail limitation)
    from:    `"${APP_CONFIG.senderLabel}" <${process.env.EMAIL_USER}>`,
    to:      toEmail,
    subject: `${otp} is your ${APP_CONFIG.name} verification code`,
    // ↑ Subject includes OTP so user can see it in notification without opening
    html:    getOtpEmailTemplate(name, otp),
    text:    getOtpPlainText(name, otp),
  });
};

module.exports = { sendOtpEmail };
