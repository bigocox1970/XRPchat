// Email configuration from environment variables
const EMAIL_HOST = import.meta.env.VITE_EMAIL_HOST || 'uk22.siteground.eu';
const EMAIL_PORT = parseInt(import.meta.env.VITE_EMAIL_PORT || '465');
const EMAIL_USER = import.meta.env.VITE_EMAIL_USER || 'no-reply@xrpchat.app';
const EMAIL_FROM = import.meta.env.VITE_EMAIL_FROM || 'XRPChat <no-reply@xrpchat.app>';

// Email templates
const EMAIL_TEMPLATES = {
  CONFIRMATION: {
    subject: 'Confirm your XRPChat account',
    body: (confirmationLink: string) => `
      <h1>Welcome to XRPChat!</h1>
      <p>Thank you for signing up. Please confirm your email address by clicking the link below:</p>
      <p><a href="${confirmationLink}" style="padding: 10px 20px; background-color: #10b981; color: white; text-decoration: none; border-radius: 4px;">Confirm Email</a></p>
      <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
      <p>${confirmationLink}</p>
      <p>This link will expire in 24 hours.</p>
      <p>If you didn't create an account, you can safely ignore this email.</p>
      <p>Regards,<br>The XRPChat Team</p>
    `
  },
  PASSWORD_RESET: {
    subject: 'Reset your XRPChat password',
    body: (resetLink: string) => `
      <h1>Password Reset Request</h1>
      <p>You've requested to reset your password. Please click the link below to set a new password:</p>
      <p><a href="${resetLink}" style="padding: 10px 20px; background-color: #10b981; color: white; text-decoration: none; border-radius: 4px;">Reset Password</a></p>
      <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
      <p>${resetLink}</p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request a password reset, you can safely ignore this email.</p>
      <p>Regards,<br>The XRPChat Team</p>
    `
  }
};

/**
 * Simplified email sending function for browser environment
 * This is a mock implementation that logs the email details to the console
 * In a real application, you would need a backend API to handle email sending
 */
export const sendEmail = async (
  to: string, 
  subject: string, 
  html: string
): Promise<boolean> => {
  try {
    // In browser environment, we can't send emails directly
    // We'd normally call a backend API here
    
    // For development, we'll just log the email details
    console.log('Email would be sent with the following details:');
    console.log(`From: ${EMAIL_FROM}`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${html}`);
    
    // We use Supabase Auth to handle email verification and password reset
    // The emails will be sent by Supabase
    
    return true;
  } catch (error) {
    console.error('Error with email process:', error);
    return false;
  }
};

/**
 * Send confirmation email
 */
export const sendConfirmationEmail = async (
  email: string, 
  confirmationLink: string
): Promise<boolean> => {
  const template = EMAIL_TEMPLATES.CONFIRMATION;
  return sendEmail(
    email,
    template.subject,
    template.body(confirmationLink)
  );
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (
  email: string, 
  resetLink: string
): Promise<boolean> => {
  const template = EMAIL_TEMPLATES.PASSWORD_RESET;
  return sendEmail(
    email,
    template.subject,
    template.body(resetLink)
  );
}; 