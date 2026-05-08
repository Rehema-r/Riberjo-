import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for sending emails
  app.post("/api/send-email", async (req, res) => {
    const { to, subject, body } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      // Lazy init transporter to avoid crash if env vars missing
      const host = process.env.EMAIL_HOST;
      const user = process.env.EMAIL_USER;
      const pass = process.env.EMAIL_PASS;
      const portStr = process.env.EMAIL_PORT;

      if (!host || !user || !pass) {
        console.warn("Email configuration missing in environment. Email not sent.");
        return res.status(200).json({ success: false, message: "Email config missing" });
      }

      const port = parseInt(portStr || "587");
      if (isNaN(port)) {
        console.error(`Invalid email port: ${portStr}`);
        return res.status(200).json({ success: false, message: "Invalid email port" });
      }

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass,
        },
        // Force TLS for port 587
        requireTLS: port === 587,
        debug: process.env.NODE_ENV !== "production",
      });

      await transporter.sendMail({
        from: process.env.EMAIL_FROM || '"RIBERJO Notification" <notifications@riberjo.com>',
        to,
        subject,
        text: body,
        html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #047857; margin-bottom: 20px; border-bottom: 2px solid #047857; padding-bottom: 10px;">RIBERJO GLOBAL SERVICE</h1>
                <div style="font-size: 16px; line-height: 1.5; color: #334155;">
                  ${body}
                </div>
                <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center;">
                  Ceci est une notification automatique du système RIBERJO.<br />
                  © 2026 RIBERJO GLOBAL SERVICE SARL.
                </div>
               </div>`,
      });

      console.log(`Email sent to ${to}: ${subject}`);
      res.status(200).json({ success: true });
    } catch (error: any) {
      const isAuthError = error.message.includes('Authentication failed') || error.code === 'EAUTH';
      console.error("Email sending exception:", {
          message: error.message,
          code: error.code,
          isAuthError
      });

      if (isAuthError) {
        return res.status(500).json({ 
          error: "SMTP Authentication Failed", 
          details: "Veuillez vérifier vos identifiants SMTP. Si vous utilisez Gmail, assurez-vous d'utiliser un 'Mot de passe d'application'."
        });
      }

      res.status(500).json({ error: "Failed to send email", details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    const expressApp = app as any;
    // Handle SPA fallback for production
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
