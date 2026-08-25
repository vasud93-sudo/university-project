// Pluggable email layer. Swap the implementation by setting env vars -
// nothing else in the codebase needs to change.
//
//   - no config set          -> ConsoleMailer: logs to stdout. The caller
//                                (reminders/bulk-send) is responsible for
//                                its own ReminderLog/BulkSendRecipient rows,
//                                which is what the admin UI reads to show
//                                "what was sent" in demo mode.
//   - RESEND_API_KEY set     -> sends via Resend's HTTP API.
//   - SMTP_HOST/USER/PASS    -> sends via plain SMTP (e.g. a Gmail app
//                                password) using nodemailer, loaded lazily
//                                so it's not a hard dependency in demo mode.

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export interface Mailer {
  send(email: OutgoingEmail): Promise<{ ok: boolean; error?: string }>;
}

class ConsoleMailer implements Mailer {
  async send(email: OutgoingEmail) {
    console.log(`[mailer:console] -> ${email.to} :: ${email.subject}`);
    return { ok: true };
  }
}

class ResendMailer implements Mailer {
  constructor(private apiKey: string, private from: string) {}

  async send(email: OutgoingEmail) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: email.to,
          subject: email.subject,
          html: email.html,
          text: email.text,
        }),
      });
      if (!res.ok) {
        return { ok: false, error: `Resend responded ${res.status}: ${await res.text()}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }
}

class SmtpMailer implements Mailer {
  constructor(
    private host: string,
    private port: number,
    private user: string,
    private pass: string,
    private from: string
  ) {}

  async send(email: OutgoingEmail) {
    try {
      // Lazy import so `nodemailer` is only required when SMTP is actually used.
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.createTransport({
        host: this.host,
        port: this.port,
        secure: this.port === 465,
        auth: { user: this.user, pass: this.pass },
      });
      await transport.sendMail({
        from: this.from,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }
}

let cached: Mailer | null = null;

export function getMailer(): Mailer {
  if (cached) return cached;

  if (process.env.RESEND_API_KEY) {
    cached = new ResendMailer(
      process.env.RESEND_API_KEY,
      process.env.MAIL_FROM ?? "activities@school.example"
    );
  } else if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    cached = new SmtpMailer(
      process.env.SMTP_HOST,
      Number(process.env.SMTP_PORT ?? 587),
      process.env.SMTP_USER,
      process.env.SMTP_PASS,
      process.env.MAIL_FROM ?? process.env.SMTP_USER
    );
  } else {
    cached = new ConsoleMailer();
  }
  return cached;
}

export function isDemoMailer() {
  return !process.env.RESEND_API_KEY && !process.env.SMTP_HOST;
}
