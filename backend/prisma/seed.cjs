require('dotenv/config');
const bcrypt = require('bcrypt');
const { Client } = require('pg');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

const SEED_PASSWORD = 'Test1234!';

const users = [
  {
    id: 'seed_admin',
    email: 'admin@ft.local',
    displayname: 'Admin',
    role: 'ADMIN',
  },
  {
    id: 'seed_alice',
    email: 'alice@ft.local',
    displayname: 'Alice',
    role: 'USER',
  },
  {
    id: 'seed_bob',
    email: 'bob@ft.local',
    displayname: 'Bob',
    role: 'USER',
  },
];

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

    for (const user of users) {
      await client.query(
        `INSERT INTO "User" (
           id, email, displayname, role, "passwordHash",
           "twoFactorEnabled", "isOnline", status, "createdAt", "updatedAt"
         )
         VALUES ($1, $2, $3, $4::"Role", $5, false, false, 'OFFLINE'::"Status", NOW(), NOW())
         ON CONFLICT (email) DO UPDATE SET
           displayname = EXCLUDED.displayname,
           role = EXCLUDED.role,
           "passwordHash" = EXCLUDED."passwordHash",
           "updatedAt" = NOW()`,
        [user.id, user.email, user.displayname, user.role, passwordHash],
      );
    }
  } finally {
    await client.end();
  }

  console.log('Seed completed.');
  console.log('  admin@ft.local / Test1234! (ADMIN)');
  console.log('  alice@ft.local / Test1234! (USER)');
  console.log('  bob@ft.local   / Test1234! (USER)');
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
