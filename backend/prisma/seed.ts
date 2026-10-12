import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  FriendshipStatus,
  LanguagePreference,
  Role,
  TableStatus,
  ThemePreference,
} from '../src/generated/prisma/client';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

// Ce script "reset & reseed" les comptes de démo à chaque démarrage
// (RUN_SEED=true par défaut, cf. docker-entrypoint.sh) : on supprime tous les
// utilisateurs dont l'id commence par "seed_" (les cascades du schéma
// nettoient amitiés, conversations, etc.) puis on les recrée. Aucun match,
// tournoi ni file d'attente n'est créé : les deux tables de baby-foot existent
// mais restent libres, et le classement part de zéro (1000 pts pour tous).

const SEED_PASSWORD = 'Test1234!';
const SEED_ID_PREFIX = 'seed_';

const now = new Date();
/** Date située il y a `days` jours à l'heure donnée (minutes variables pour éviter des horaires identiques). */
function daysAgo(days: number, hour = 12) {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  d.setHours(hour, (days * 7) % 60, 0, 0);
  return d;
}
/** Date située il y a `minutes` minutes. */
function minutesAgo(minutes: number) {
  return new Date(now.getTime() - minutes * 60_000);
}

interface SeedUser {
  slug: string;
  displayname: string;
  role?: 'ADMIN' | 'USER';
  login42?: string;
}

const seedUsers: SeedUser[] = [
  { slug: 'admin', displayname: 'Admin', role: 'ADMIN' },
  { slug: 'lucas', displayname: 'Lucas Moreau', login42: 'lmoreau' },
  { slug: 'emma', displayname: 'Emma Lefebvre' },
  { slug: 'hugo', displayname: 'Hugo Bernard', login42: 'hbernard' },
  { slug: 'lea', displayname: 'Léa Dubois' },
  { slug: 'nathan', displayname: 'Nathan Garcia' },
  { slug: 'chloe', displayname: 'Chloé Roux', login42: 'croux' },
  { slug: 'louis', displayname: 'Louis Fontaine' },
  { slug: 'manon', displayname: 'Manon Girard' },
  { slug: 'thomas', displayname: 'Thomas Lambert', login42: 'tlambert' },
  { slug: 'camille', displayname: 'Camille Faure' },
  { slug: 'yanis', displayname: 'Yanis Benali' },
  { slug: 'ines', displayname: 'Inès Haddad' },
  { slug: 'mehdi', displayname: 'Mehdi Cherif', login42: 'mcherif' },
  { slug: 'sarah', displayname: 'Sarah Amrani' },
  { slug: 'pedro', displayname: 'Pedro Santos' },
  { slug: 'marta', displayname: 'Marta Kowalski' },
  { slug: 'jonas', displayname: 'Jonas Weber', login42: 'jweber' },
  { slug: 'sofia', displayname: 'Sofia Rossi' },
  { slug: 'oliver', displayname: 'Oliver Smith' },
  { slug: 'aicha', displayname: 'Aïcha Diallo' },
  { slug: 'theo', displayname: 'Théo Marchand' },
  { slug: 'julie', displayname: 'Julie Perrin' },
  { slug: 'antoine', displayname: 'Antoine Muller' },
];

/** Identifiant stable d'un compte de démo à partir de son slug. */
const idOf = (slug: string) => `${SEED_ID_PREFIX}${slug}`;
/** Adresse e-mail d'un compte de démo : prenom.nom@ft.local (l'admin garde admin@ft.local). */
const emailOf = (user: SeedUser) =>
  user.slug === 'admin'
    ? 'admin@ft.local'
    : `${user.displayname
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, '.')}@ft.local`;

const THEMES = ['light', 'dark', 'system'];
const LANGUAGES = ['en', 'fr', 'es'];

const tables = [
  { id: 'table_a', name: 'Baby A' },
  { id: 'table_b', name: 'Baby B' },
];

// Amitiés : un petit graphe social, avec quelques demandes en attente.
const friendships = [
  ['lucas', 'emma', 'ACCEPTED'],
  ['lucas', 'hugo', 'ACCEPTED'],
  ['lucas', 'admin', 'ACCEPTED'],
  ['emma', 'lea', 'ACCEPTED'],
  ['hugo', 'nathan', 'ACCEPTED'],
  ['lea', 'chloe', 'ACCEPTED'],
  ['nathan', 'louis', 'ACCEPTED'],
  ['manon', 'thomas', 'ACCEPTED'],
  ['camille', 'yanis', 'ACCEPTED'],
  ['ines', 'mehdi', 'ACCEPTED'],
  ['sarah', 'pedro', 'ACCEPTED'],
  ['marta', 'jonas', 'ACCEPTED'],
  ['sofia', 'oliver', 'ACCEPTED'],
  ['aicha', 'theo', 'ACCEPTED'],
  ['julie', 'antoine', 'ACCEPTED'],
  ['emma', 'hugo', 'ACCEPTED'],
  ['chloe', 'manon', 'ACCEPTED'],
  ['louis', 'thomas', 'ACCEPTED'],
  ['camille', 'lucas', 'PENDING'],
  ['yanis', 'lucas', 'PENDING'],
  ['sofia', 'emma', 'PENDING'],
  ['pedro', 'hugo', 'PENDING'],
  ['antoine', 'lea', 'PENDING'],
] as const;

interface SeedMessage {
  from: string;
  content: string;
  at: Date;
}
interface SeedConversation {
  a: string;
  b: string;
  aLastReadAt: Date;
  bLastReadAt: Date;
  createdAt: Date;
  messages: SeedMessage[];
}

// Conversations : historique réaliste, avec un message non lu pour Lucas.
const conversations: SeedConversation[] = [
  {
    a: 'lucas',
    b: 'emma',
    aLastReadAt: minutesAgo(40),
    bLastReadAt: minutesAgo(2),
    createdAt: daysAgo(6),
    messages: [
      {
        from: 'emma',
        content: 'Salut ! Tu viens au babyfoot ce midi ?',
        at: minutesAgo(90),
      },
      {
        from: 'lucas',
        content: 'Oui je finis ma piscine et j’arrive',
        at: minutesAgo(75),
      },
      {
        from: 'emma',
        content: 'Top, je prends la table dès que je peux',
        at: minutesAgo(60),
      },
      {
        from: 'emma',
        content: 'Dépêche-toi, il reste une place en 2v2 😄',
        at: minutesAgo(2),
      },
    ],
  },
  {
    a: 'lucas',
    b: 'hugo',
    aLastReadAt: daysAgo(1),
    bLastReadAt: daysAgo(1),
    createdAt: daysAgo(5),
    messages: [
      {
        from: 'hugo',
        content: 'T’as vu le sujet de la prochaine piscine ?',
        at: daysAgo(2, 20),
      },
      {
        from: 'lucas',
        content: 'Pas encore, je regarde ça ce soir',
        at: daysAgo(1, 9),
      },
    ],
  },
  {
    a: 'lea',
    b: 'chloe',
    aLastReadAt: minutesAgo(5),
    bLastReadAt: minutesAgo(5),
    createdAt: daysAgo(4),
    messages: [
      {
        from: 'chloe',
        content: 'Tu as des conseils pour la défense au babyfoot ?',
        at: minutesAgo(12),
      },
      {
        from: 'lea',
        content: 'Garde ta gardienne bien serrée et anticipe les passes',
        at: minutesAgo(5),
      },
    ],
  },
  {
    a: 'nathan',
    b: 'louis',
    aLastReadAt: daysAgo(2),
    bLastReadAt: daysAgo(2),
    createdAt: daysAgo(7),
    messages: [
      {
        from: 'nathan',
        content: 'On se fait une partie demain après le projet ?',
        at: daysAgo(3, 17),
      },
      {
        from: 'louis',
        content: 'Ça marche, 18h devant la table',
        at: daysAgo(2, 8),
      },
    ],
  },
  {
    a: 'sofia',
    b: 'oliver',
    aLastReadAt: daysAgo(1),
    bLastReadAt: daysAgo(1),
    createdAt: daysAgo(3),
    messages: [
      {
        from: 'oliver',
        content: 'Hey Sofia, are you free this afternoon?',
        at: daysAgo(1, 14),
      },
      {
        from: 'sofia',
        content: 'Sì, dopo le 15h va bene!',
        at: daysAgo(1, 15),
      },
    ],
  },
];

/** Reconstruit en une transaction les comptes de démo (utilisateurs, amis, conversations) et remet les deux tables de baby-foot à vide. */
async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

    // Tout dans une seule transaction : soit le jeu de démo est reconstruit
    // en entier, soit rien ne change.
    await prisma.$transaction(
      async (tx) => {
        // Repart d'une base propre pour tous les comptes de démo (y compris
        // ceux d'un ancien jeu de données) : les cascades du schéma
        // suppriment tout ce qui en dépend.
        await tx.user.deleteMany({
          where: { id: { startsWith: SEED_ID_PREFIX } },
        });

        // Exactement deux tables : on supprime celles d'un ancien seed
        // (les matchs qui y pointaient passent à tableId NULL).
        await tx.table.deleteMany({
          where: { id: { notIn: tables.map((t) => t.id) } },
        });

        // Deux tables de baby-foot, créées si absentes puis remises à FREE.
        for (const table of tables) {
          await tx.table.upsert({
            where: { id: table.id },
            create: { id: table.id, name: table.name },
            update: {
              status: TableStatus.FREE,
              format: null,
              occupiedAt: null,
              endRequestedAt: null,
              currentTournamentTieId: null,
            },
          });
        }

        // Tables et files vides : on efface tout résidu d'utilisation réelle
        // (parties jouées pendant les tests), sans quoi un groupe ON_TABLE
        // oublié entrerait en conflit avec l'index unique (tableId, slot).
        const tableIds = tables.map((t) => t.id);
        await tx.tableReleaseVote.deleteMany({
          where: { tableId: { in: tableIds } },
        });
        await tx.queueGroup.deleteMany({
          where: { tableId: { in: tableIds } },
        });

        await tx.user.createMany({
          data: seedUsers.map((user) => ({
            id: idOf(user.slug),
            email: emailOf(user),
            displayname: user.displayname,
            role: (user.role ?? 'USER') as Role,
            passwordHash,
            login42: user.login42 ?? null,
            theme: THEMES[
              Math.abs(hashCode(user.slug)) % THEMES.length
            ] as ThemePreference,
            language: LANGUAGES[
              Math.abs(hashCode(user.slug + 'l')) % LANGUAGES.length
            ] as LanguagePreference,
            avatarUrl: `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(user.displayname)}`,
          })),
        });

        await tx.friendship.createMany({
          data: friendships.map(([requester, addressee, status], index) => ({
            id: `seed_fr_${index + 1}`,
            requesterId: idOf(requester),
            addresseeId: idOf(addressee),
            status: status as FriendshipStatus,
          })),
        });

        for (const [index, conv] of conversations.entries()) {
          const convId = `seed_conv_${index + 1}`;
          await tx.conversation.create({
            data: {
              id: convId,
              userAId: idOf(conv.a),
              userBId: idOf(conv.b),
              userALastReadAt: conv.aLastReadAt,
              userBLastReadAt: conv.bLastReadAt,
              createdAt: conv.createdAt,
              messages: {
                create: conv.messages.map((msg, i) => ({
                  id: `${convId}_msg_${i + 1}`,
                  senderId: idOf(msg.from),
                  content: msg.content,
                  createdAt: msg.at,
                })),
              },
            },
          });
        }
      },
      { timeout: 60_000 },
    );
  } finally {
    await prisma.$disconnect();
  }

  console.log('Seed completed.');
  console.log(
    `  ${seedUsers.length} comptes de démo (mot de passe commun : ${SEED_PASSWORD}) :`,
  );
  for (const user of seedUsers) {
    console.log(
      `    ${emailOf(user).padEnd(28)} ${(user.role ?? 'USER').padEnd(6)} ${user.displayname}`,
    );
  }
  console.log('  Tables libres, aucun match ni tournoi.');
}

/** Hash entier déterministe d'une chaîne, pour produire des valeurs pseudo-aléatoires reproductibles. */
function hashCode(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
