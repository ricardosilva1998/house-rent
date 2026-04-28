import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { bookings, properties, users } from '../db/schema';

export interface VoucherInput {
  bookingId: string;
}

export async function generateVoucherPdf({ bookingId }: VoucherInput): Promise<Uint8Array> {
  const rows = await db
    .select({ b: bookings, u: users, p: properties })
    .from(bookings)
    .innerJoin(users, eq(users.id, bookings.userId))
    .innerJoin(properties, eq(properties.id, bookings.propertyId))
    .where(eq(bookings.id, bookingId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error('booking_not_found');
  const { b, u, p } = row;

  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.12, 0.12, 0.13);
  const muted = rgb(0.42, 0.42, 0.42);
  let y = 780;

  page.drawText('Retiro dos Baeta', { x: 56, y, size: 22, font: helvBold, color: ink });
  y -= 26;
  page.drawText('Voucher de reserva', { x: 56, y, size: 12, font: helv, color: muted });
  y -= 36;

  page.drawText(p.name, { x: 56, y, size: 14, font: helvBold, color: ink });
  y -= 18;
  if (p.address) {
    page.drawText(p.address, { x: 56, y, size: 11, font: helv, color: muted });
    y -= 14;
  }
  if (p.city || p.region) {
    page.drawText([p.city, p.region].filter(Boolean).join(', '), { x: 56, y, size: 11, font: helv, color: muted });
    y -= 14;
  }
  y -= 14;

  const rowText = (label: string, value: string) => {
    page.drawText(label, { x: 56, y, size: 11, font: helv, color: muted });
    page.drawText(value, { x: 200, y, size: 12, font: helvBold, color: ink });
    y -= 22;
  };

  rowText('Código', b.confirmationCode);
  rowText('Hóspede', u.name);
  rowText('Email', u.email);
  rowText('Check-in', `${b.checkIn} a partir de ${p.checkInTime}`);
  rowText('Check-out', `${b.checkOut} até ${p.checkOutTime}`);
  rowText('Hóspedes', String(b.numGuests));
  rowText('Total', `${b.quotedPrice.toFixed(2)} ${b.currency}`);

  if (b.specialRequests) {
    y -= 4;
    page.drawText('Pedidos especiais', { x: 56, y, size: 11, font: helv, color: muted });
    y -= 14;
    const lines = wrap(b.specialRequests, 80);
    for (const line of lines) {
      page.drawText(line, { x: 56, y, size: 11, font: helv, color: ink });
      y -= 14;
    }
  }

  if (p.houseRules) {
    y -= 12;
    page.drawText('Regras da casa', { x: 56, y, size: 11, font: helvBold, color: ink });
    y -= 14;
    for (const line of wrap(p.houseRules, 90).slice(0, 8)) {
      page.drawText(line, { x: 56, y, size: 10, font: helv, color: ink });
      y -= 13;
    }
  }

  y = 60;
  page.drawText('Em caso de dúvida, contacte-nos respondendo ao email de confirmação.', {
    x: 56,
    y,
    size: 10,
    font: helv,
    color: muted
  });

  return doc.save();
}

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  for (const para of text.split(/\n+/)) {
    let buf = '';
    for (const word of para.split(/\s+/)) {
      if (buf.length + word.length + 1 > width) {
        lines.push(buf);
        buf = word;
      } else {
        buf = buf ? `${buf} ${word}` : word;
      }
    }
    if (buf) lines.push(buf);
    lines.push('');
  }
  return lines;
}

export function buildBookingIcs(opts: {
  bookingId: string;
  confirmationCode: string;
  checkIn: string;
  checkOut: string;
  propertyName: string;
  propertyAddress?: string | null;
}): string {
  const dtstamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
  const dt = (s: string) => s.replace(/-/g, '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//retiro-dos-baeta//booking//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:booking-${opts.bookingId}@retiro-dos-baeta`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${dt(opts.checkIn)}`,
    `DTEND;VALUE=DATE:${dt(opts.checkOut)}`,
    `SUMMARY:Estadia em ${opts.propertyName}`,
    opts.propertyAddress ? `LOCATION:${opts.propertyAddress.replace(/[\r\n,]/g, ' ')}` : '',
    `DESCRIPTION:Reserva ${opts.confirmationCode}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ]
    .filter(Boolean)
    .join('\r\n');
}
