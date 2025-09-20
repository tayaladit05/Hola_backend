const SibApiV3Sdk = require('sib-api-v3-sdk');

// Configure Brevo API
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

// Email templates
const generateOTPEmailTemplate = (userName, otp) => {
  return {
    subject: 'Verify Your Instagram Clone Account',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .email-container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%); color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background-color: #f9f9f9; }
          .otp-box { background: white; border: 2px solid #e1306c; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
          .otp-code { font-size: 32px; font-weight: bold; color: #e1306c; letter-spacing: 8px; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>📸 Welcome to Instagram Clone!</h1>
          </div>
          <div class="content">
            <h2>Hi ${userName}!</h2>
            <p>Thank you for joining our Instagram Clone app. To complete your registration, please verify your email address using the OTP below:</p>
            
            <div class="otp-box">
              <p>Your verification code is:</p>
              <div class="otp-code">${otp}</div>
              <p><small>This code will expire in 10 minutes</small></p>
            </div>
            
            <p>If you didn't create this account, please ignore this email.</p>
            <p>Happy posting! 🎉</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 Instagram Clone. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    textContent: `
      Hi ${userName}!
      
      Welcome to Instagram Clone! Your verification code is: ${otp}
      
      This code will expire in 10 minutes.
      
      If you didn't create this account, please ignore this email.
    `
  };
};

const generatePasswordResetTemplate = (userName, resetLink) => {
  return {
    subject: 'Reset Your Instagram Clone Password',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .email-container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%); color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background-color: #f9f9f9; }
          .reset-button { display: inline-block; background: #e1306c; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>🔐 Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hi ${userName}!</h2>
            <p>We received a request to reset your password for your Instagram Clone account.</p>
            <p>Click the button below to reset your password:</p>
            
            <div style="text-align: center;">
              <a href="${resetLink}" class="reset-button">Reset Password</a>
            </div>
            
            <p>If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
            <p><small>This link will expire in 1 hour for security reasons.</small></p>
          </div>
          <div class="footer">
            <p>&copy; 2025 Instagram Clone. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    textContent: `
      Hi ${userName}!
      
      We received a request to reset your password for your Instagram Clone account.
      
      Please visit this link to reset your password: ${resetLink}
      
      If you didn't request this password reset, please ignore this email.
      This link will expire in 1 hour for security reasons.
    `
  };
};

// Main send email function
const sendEmail = async (to, templateType, templateData) => {
  try {
    let emailTemplate;
    
    switch (templateType) {
      case 'OTP_VERIFICATION':
        emailTemplate = generateOTPEmailTemplate(templateData.userName, templateData.otp);
        break;
      case 'PASSWORD_RESET':
        emailTemplate = generatePasswordResetTemplate(templateData.userName, templateData.resetLink);
        break;
      default:
        throw new Error('Invalid email template type');
    }

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.to = [{ email: to }];
    sendSmtpEmail.sender = { 
      email: process.env.BREVO_SENDER_EMAIL || 'noreply@instagramclone.com',
      name: process.env.BREVO_SENDER_NAME || 'Instagram Clone'
    };
    sendSmtpEmail.subject = emailTemplate.subject;
    sendSmtpEmail.htmlContent = emailTemplate.htmlContent;
    sendSmtpEmail.textContent = emailTemplate.textContent;

    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('✅ Email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
    
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    throw new Error(`Email sending failed: ${error.message}`);
  }
};

// Utility functions for specific email types
const sendOTPEmail = async (email, userName, otp) => {
  return await sendEmail(email, 'OTP_VERIFICATION', { userName, otp });
};

const sendPasswordResetEmail = async (email, userName, resetLink) => {
  return await sendEmail(email, 'PASSWORD_RESET', { userName, resetLink });
};

module.exports = {
  sendEmail,
  sendOTPEmail,
  sendPasswordResetEmail
};