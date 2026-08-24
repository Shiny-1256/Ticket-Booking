import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import crypto from 'crypto';
import db from '../db/db.js';

let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  // Use configured SMTP or create an Ethereal test account automatically
  if (process.env.SMTP_USER && process.env.SMTP_USER !== 'test_user') {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: Number(process.env.SMTP_PORT) || 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  } else {
    // Generate Ethereal test credentials on the fly
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      console.log(`[Email] Ethereal SMTP test account initialized: ${testAccount.user}`);
    } catch (err) {
      console.warn('[Email] Could not create Ethereal account, falling back to mock transport:', err.message);
      transporter = {
        sendMail: async (opts) => {
          console.log(`[Mock Email Sent] To: ${opts.to}, Subject: ${opts.subject}`);
          return { messageId: 'mock-msg-id' };
        }
      };
    }
  }

  return transporter;
}

export async function generateTicketQRCode(bookingRef) {
  try {
    const qrData = JSON.stringify({
      bookingRef,
      issuedAt: new Date().toISOString(),
      verifier: 'CinePass-QR-Verify-v1'
    });
    const qrDataUrl = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H',
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });
    return qrDataUrl;
  } catch (err) {
    console.error('Error generating QR Code:', err);
    throw err;
  }
}

export async function sendTicketEmail(userEmail, userName, booking) {
  const mailer = await getTransporter();
  const qrImageSrc = booking.qr_code_data;

  const html = `
    <div style="font-family: Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #334155;">
      <div style="text-align: center; padding-bottom: 16px; border-bottom: 1px solid #334155;">
        <h1 style="color: #38bdf8; margin: 0; font-size: 24px;">🎟️ CinePass Confirmed Ticket</h1>
        <p style="color: #94a3b8; font-size: 14px; margin-top: 4px;">Booking Reference: <strong style="color: #f1f5f9; background: #1e293b; padding: 2px 8px; border-radius: 4px;">${booking.booking_reference}</strong></p>
      </div>

      <div style="margin: 20px 0;">
        <p style="font-size: 16px;">Hello <strong>${userName}</strong>,</p>
        <p style="color: #cbd5e1;">Your booking for <strong style="color: #38bdf8;">${booking.show_title}</strong> is confirmed!</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px; background: #1e293b; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #334155; color: #94a3b8;">Event Date & Time</td>
            <td style="padding: 12px; border-bottom: 1px solid #334155; font-weight: bold;">${new Date(booking.start_time).toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #334155; color: #94a3b8;">Venue</td>
            <td style="padding: 12px; border-bottom: 1px solid #334155; font-weight: bold;">${booking.venue_name} (${booking.city})</td>
          </tr>
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #334155; color: #94a3b8;">Seats</td>
            <td style="padding: 12px; border-bottom: 1px solid #334155; font-weight: bold; color: #38bdf8;">${booking.seat_labels.join(', ')}</td>
          </tr>
          <tr>
            <td style="padding: 12px; color: #94a3b8;">Total Paid</td>
            <td style="padding: 12px; font-weight: bold; color: #4ade80;">$${booking.total_amount.toFixed(2)}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; background: #ffffff; padding: 20px; border-radius: 12px; margin-top: 24px;">
        <p style="color: #0f172a; font-weight: bold; margin-bottom: 12px; font-size: 15px;">Scan Entry QR Code</p>
        <img src="${qrImageSrc}" alt="QR Ticket Code" style="width: 180px; height: 180px; display: inline-block; border: 4px solid #0f172a; border-radius: 8px;" />
        <p style="color: #64748b; font-size: 12px; margin-top: 8px;">Present this QR code at the event entrance for instant verification.</p>
      </div>

      <div style="text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #334155; color: #64748b; font-size: 12px;">
        <p>Thank you for choosing CinePass! Enjoy the event.</p>
      </div>
    </div>
  `;

  try {
    const info = await mailer.sendMail({
      from: `"CinePass Tickets" <${process.env.FROM_EMAIL || 'tickets@cinepass.com'}>`,
      to: userEmail,
      subject: `Your Ticket Confirmation - ${booking.booking_reference}`,
      html
    });

    // Log email to SQLite outbox
    const logStmt = db.prepare(`
      INSERT INTO email_logs (id, recipient, subject, body_html, sent_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    logStmt.run(crypto.randomUUID(), userEmail, `Your Ticket Confirmation - ${booking.booking_reference}`, html);

    console.log(`[Email] Ticket email dispatched to ${userEmail}`);
    return info;
  } catch (err) {
    console.error(`[Email Error] Failed to send ticket email to ${userEmail}:`, err);
    // Even if mailer fails, we record the email log so it shows in the app UI outbox
    db.prepare(`
      INSERT INTO email_logs (id, recipient, subject, body_html, sent_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(crypto.randomUUID(), userEmail, `Your Ticket Confirmation - ${booking.booking_reference}`, html);
  }
}

export async function sendWaitlistOfferEmail(userEmail, userName, offerDetails) {
  const mailer = await getTransporter();
  const claimUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/waitlist-offers?token=${offerDetails.offer_token}`;

  const html = `
    <div style="font-family: Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #334155;">
      <div style="text-align: center; padding-bottom: 16px; border-bottom: 1px solid #334155;">
        <h1 style="color: #f59e0b; margin: 0; font-size: 24px;">⚡ Limited Time Seat Offer!</h1>
        <p style="color: #94a3b8; font-size: 14px; margin-top: 4px;">Waitlist Reservation for ${offerDetails.show_title}</p>
      </div>

      <div style="margin: 20px 0;">
        <p style="font-size: 16px;">Hello <strong>${userName}</strong>,</p>
        <p style="color: #cbd5e1;">A seat has just opened up in the <strong style="color: #38bdf8;">${offerDetails.category}</strong> section for <strong>${offerDetails.show_title}</strong>!</p>

        <div style="background: #1e293b; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #f59e0b;">
          <p style="margin: 4px 0;"><strong>Seat Number:</strong> ${offerDetails.seat_label}</p>
          <p style="margin: 4px 0;"><strong>Category:</strong> ${offerDetails.category}</p>
          <p style="margin: 4px 0;"><strong>Price:</strong> $${offerDetails.price.toFixed(2)}</p>
          <p style="margin: 4px 0; color: #ef4444; font-weight: bold;"><strong>Offer Expires At:</strong> ${new Date(offerDetails.expires_at).toLocaleString()}</p>
        </div>

        <p style="color: #94a3b8; font-size: 14px;">You have a strict time limit to claim this seat. If you do not complete your reservation before expiry, the seat will automatically be offered to the next customer in the queue.</p>
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${claimUrl}" style="background-color: #0284c7; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
          Claim Your Seat Now 🎟️
        </a>
      </div>

      <div style="text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #334155; color: #64748b; font-size: 12px;">
        <p>CinePass Automated Waitlist Allocation System</p>
      </div>
    </div>
  `;

  try {
    const info = await mailer.sendMail({
      from: `"CinePass Waitlist" <${process.env.FROM_EMAIL || 'waitlist@cinepass.com'}>`,
      to: userEmail,
      subject: `⚡ Action Required: Seat Offer for ${offerDetails.show_title}`,
      html
    });

    db.prepare(`
      INSERT INTO email_logs (id, recipient, subject, body_html, sent_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(crypto.randomUUID(), userEmail, `⚡ Action Required: Seat Offer for ${offerDetails.show_title}`, html);

    console.log(`[Email] Waitlist offer email dispatched to ${userEmail}`);
    return info;
  } catch (err) {
    console.error(`[Email Error] Failed to send waitlist email to ${userEmail}:`, err);
    db.prepare(`
      INSERT INTO email_logs (id, recipient, subject, body_html, sent_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(crypto.randomUUID(), userEmail, `⚡ Action Required: Seat Offer for ${offerDetails.show_title}`, html);
  }
}
