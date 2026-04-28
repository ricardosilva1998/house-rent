import { Resend } from 'resend';
import { env } from './env';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: { filename: string; content: Buffer | string }[];
}

let resend: Resend | null = null;
function client() {
  if (!env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(env.RESEND_API_KEY);
  return resend;
}

export async function sendEmail(msg: EmailMessage): Promise<{ ok: boolean; id?: string; error?: string }> {
  const c = client();
  if (!c) {
    console.log('[email:dev]', { to: msg.to, subject: msg.subject });
    console.log(msg.html.substring(0, 400));
    return { ok: true, id: 'dev-' + Date.now() };
  }
  const result = await c.emails.send({
    from: env.EMAIL_FROM,
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    attachments: msg.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content instanceof Buffer ? a.content : Buffer.from(a.content)
    }))
  });
  if (result.error) {
    console.error('[email] send failed', result.error);
    return { ok: false, error: result.error.message };
  }
  return { ok: true, id: result.data?.id };
}

export function renderVerificationEmail(opts: { name: string; verifyUrl: string; locale: string }) {
  const t = {
    pt: {
      subject: 'Confirme o seu email — Retiro dos Baeta',
      hello: 'Olá',
      body: 'Para começar a reservar a casa, confirme o seu email clicando no link abaixo:',
      cta: 'Confirmar email',
      foot: 'Se não criou esta conta, ignore esta mensagem.'
    },
    en: {
      subject: 'Verify your email — Retiro dos Baeta',
      hello: 'Hello',
      body: 'To start booking the house, please confirm your email by clicking the link below:',
      cta: 'Verify email',
      foot: 'If you did not create this account, please ignore this message.'
    },
    es: {
      subject: 'Verifica tu email — Retiro dos Baeta',
      hello: 'Hola',
      body: 'Para empezar a reservar la casa, confirma tu email haciendo clic en el siguiente enlace:',
      cta: 'Verificar email',
      foot: 'Si no creaste esta cuenta, ignora este mensaje.'
    }
  };
  const c = (t as any)[opts.locale] ?? t.pt;
  const html = `
    <div style="font-family: ui-sans-serif, system-ui; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="font-weight: 600;">${c.hello} ${escapeHtml(opts.name)},</h2>
      <p>${c.body}</p>
      <p style="margin: 24px 0;">
        <a href="${opts.verifyUrl}" style="display: inline-block; padding: 12px 18px; background: #1f2937; color: white; border-radius: 6px; text-decoration: none;">
          ${c.cta}
        </a>
      </p>
      <p style="color: #6b7280; font-size: 13px;">${c.foot}</p>
    </div>
  `;
  return { subject: c.subject, html };
}

export function renderBookingConfirmationEmail(opts: {
  name: string;
  confirmationCode: string;
  checkIn: string;
  checkOut: string;
  total: string;
  locale: string;
}) {
  const t = {
    pt: {
      subject: `Reserva confirmada (${opts.confirmationCode}) — Retiro dos Baeta`,
      hello: 'Olá',
      body: 'A sua reserva está confirmada. Detalhes:',
      checkIn: 'Entrada',
      checkOut: 'Saída',
      code: 'Código',
      total: 'Total'
    },
    en: {
      subject: `Booking confirmed (${opts.confirmationCode}) — Retiro dos Baeta`,
      hello: 'Hello',
      body: 'Your booking is confirmed. Details:',
      checkIn: 'Check-in',
      checkOut: 'Check-out',
      code: 'Code',
      total: 'Total'
    },
    es: {
      subject: `Reserva confirmada (${opts.confirmationCode}) — Retiro dos Baeta`,
      hello: 'Hola',
      body: 'Tu reserva está confirmada. Detalles:',
      checkIn: 'Entrada',
      checkOut: 'Salida',
      code: 'Código',
      total: 'Total'
    }
  };
  const c = (t as any)[opts.locale] ?? t.pt;
  const html = `
    <div style="font-family: ui-sans-serif, system-ui; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2>${c.hello} ${escapeHtml(opts.name)},</h2>
      <p>${c.body}</p>
      <table style="border-collapse: collapse; width: 100%;">
        <tr><td style="padding: 8px; color: #6b7280;">${c.code}</td><td style="padding: 8px;"><strong>${escapeHtml(opts.confirmationCode)}</strong></td></tr>
        <tr><td style="padding: 8px; color: #6b7280;">${c.checkIn}</td><td style="padding: 8px;">${escapeHtml(opts.checkIn)}</td></tr>
        <tr><td style="padding: 8px; color: #6b7280;">${c.checkOut}</td><td style="padding: 8px;">${escapeHtml(opts.checkOut)}</td></tr>
        <tr><td style="padding: 8px; color: #6b7280;">${c.total}</td><td style="padding: 8px;">${escapeHtml(opts.total)}</td></tr>
      </table>
    </div>
  `;
  return { subject: c.subject, html };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!
  );
}
