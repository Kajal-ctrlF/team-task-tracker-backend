const SibApiV3Sdk = require("sib-api-v3-sdk");

// ─────────────────────────────────────────────────────────────────────────────
// BREVO API — HTTP based email (works on Render free tier)
// ─────────────────────────────────────────────────────────────────────────────

const APP_CONFIG = {
  name:             "Team Task Tracker",
  senderLabel:      "Team Task Tracker",
  year:             new Date().getFullYear(),
  primaryColor:     "#4f46e5",
  primaryColorDark: "#4338ca",
};

const getOtpEmailTemplate = (name, otp) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset Your Password</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
          style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05),0 10px 30px rgba(0,0,0,0.08);">

          <tr>
            <td style="background:linear-gradient(135deg,${APP_CONFIG.primaryColor} 0%,${APP_CONFIG.primaryColorDark} 100%);padding:36px 40px 32px;text-align:center;">
              <div style="display:inline-block;width:56px;height:56px;background:rgba(255,255,255,0.18);border-radius:14px;line-height:56px;text-align:center;margin-bottom:14px;font-size:26px;">✓</div>
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${APP_CONFIG.name}</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">Password Reset Request</p>
            </td>
          </tr>

          <tr>
            <td style="padding:36px 40px 28px;">
              <h2 style="margin:0 0 10px;color:#1e293b;font-size:22px;font-weight:700;">Reset Your Password</h2>
              <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.7;">
                Hi <strong style="color:#1e293b;">${name}</strong>,
              </p>
              <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.7;">
                We received a request to reset the password for your <strong style="color:#1e293b;">${APP_CONFIG.name}</strong> account. Use the verification code below to proceed.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
                <tr>
                  <td style="background:#f8fafc;border:2px solid ${APP_CONFIG.primaryColor};border-radius:12px;padding:28px 24px;text-align:center;">
                    <p style="margin:0 0 10px;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;">Your Verification Code</p>
                    <div style="font-size:44px;font-weight:800;letter-spacing:14px;color:${APP_CONFIG.primaryColor};font-family:'Courier New',Courier,monospace;line-height:1.2;padding:4px 0;">${otp}</div>
                    <p style="margin:14px 0 0;color:#64748b;font-size:13px;">⏱&nbsp; This code expires in <strong style="color:#1e293b;">10 minutes</strong></p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 12px;color:#475569;font-size:14px;line-height:1.6;"><strong style="color:#1e293b;">How to use this code:</strong></p>
              <ol style="margin:0 0 28px;padding-left:20px;color:#475569;font-size:14px;line-height:1.8;">
                <li>Go back to the password reset page</li>
                <li>Enter the 6-digit code above</li>
                <li>Create your new password</li>
              </ol>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:14px 18px;">
                    <p style="margin:0;color:#78350f;font-size:13px;line-height:1.6;">
                      <strong>⚠ Security Notice</strong><br />
                      If you did not request a password reset, please ignore this email. Your password will <strong>not</strong> be changed unless you complete the reset process. Do not share this code with anyone — ${APP_CONFIG.name} will never ask for your OTP.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">
                This code is valid for a single use only and will expire automatically after 10 minutes. If you need a new code, visit the forgot password page again.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 40px;"><div style="height:1px;background:#e2e8f0;"></div></td>
          </tr>

          <tr>
            <td style="background:#f8fafc;padding:20px 40px 28px;text-align:center;">
              <p style="margin:0 0 6px;color:#94a3b8;font-size:12px;">
                This is an automated message. Please do not reply to this email.
              </p>
              <p style="margin:0;color:#cbd5e1;font-size:11px;">
                © ${APP_CONFIG.year} ${APP_CONFIG.name} · All rights reserved
              </p>
            </td>
          </tr>

        </table>

        <p style="margin:20px 0 0;color:#94a3b8;font-size:12px;text-align:center;">
          You're receiving this because a password reset was requested for your account.
        </p>

      </td>
    </tr>
  </table>
</body>
</html>
`;

const sendOtpEmail = async (toEmail, name, otp) => {
  const defaultClient = SibApiV3Sdk.ApiClient.instance;
  const apiKey        = defaultClient.authentications["api-key"];
  apiKey.apiKey       = process.env.BREVO_API_KEY;

  const apiInstance   = new SibApiV3Sdk.TransactionalEmailsApi();
  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

  sendSmtpEmail.subject     = `${otp} is your ${APP_CONFIG.name} verification code`;
  sendSmtpEmail.htmlContent = getOtpEmailTemplate(name, otp);
  sendSmtpEmail.sender      = {
    name:  APP_CONFIG.senderLabel,
    email: process.env.EMAIL_FROM,
  };
  sendSmtpEmail.to          = [{ email: toEmail, name }];
  sendSmtpEmail.textContent = `Hi ${name},\n\nYour OTP is: ${otp}\n\nExpires in 10 minutes.\n\n— ${APP_CONFIG.name} Team`;

  await apiInstance.sendTransacEmail(sendSmtpEmail);
};

module.exports = { sendOtpEmail };
