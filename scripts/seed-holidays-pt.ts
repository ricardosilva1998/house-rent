import { db, client } from '../src/db/client';
import { holidays } from '../src/db/schema';

const FIXED: Array<{ date: string; name: string }> = [
  { date: '01-01', name: 'Ano Novo' },
  { date: '04-25', name: 'Dia da Liberdade' },
  { date: '05-01', name: 'Dia do Trabalhador' },
  { date: '06-10', name: 'Dia de Portugal' },
  { date: '08-15', name: 'Assunção de Nossa Senhora' },
  { date: '10-05', name: 'Implantação da República' },
  { date: '11-01', name: 'Todos os Santos' },
  { date: '12-01', name: 'Restauração da Independência' },
  { date: '12-08', name: 'Imaculada Conceição' },
  { date: '12-25', name: 'Natal' }
];

async function main() {
  const today = new Date();
  const startYear = today.getUTCFullYear();
  const endYear = startYear + 3;
  let count = 0;
  for (let year = startYear; year <= endYear; year++) {
    for (const h of FIXED) {
      const date = `${year}-${h.date}`;
      await db
        .insert(holidays)
        .values({ country: 'PT', region: null, date, name: h.name })
        .onConflictDoNothing();
      count++;
    }
  }
  console.log(`Seeded Portuguese national holidays (${startYear}-${endYear}): ${count} entries.`);
  client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
