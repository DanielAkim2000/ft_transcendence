type Cell = string | number | boolean | Date | null | undefined;
type Row = Record<string, Cell>;
type Section = { name: string; rows: Row[] };

interface Named {
  displayname: string;
}

/** Forme des données renvoyées par GdprRepository.collectUserData (seuls les champs utilisés ici). */
export interface UserDataForCsv {
  profile: Row | null;
  friendships: {
    status: string;
    createdAt: Date;
    requester: Named;
    addressee: Named;
  }[];
  matches: {
    id: string;
    format: string;
    status: string;
    scoreA: number | null;
    scoreB: number | null;
    ratingDeltas: unknown;
    createdAt: Date;
    legNumber: number | null;
    teamAPlayer1: Named | null;
    teamAPlayer2: Named | null;
    teamBPlayer1: Named | null;
    teamBPlayer2: Named | null;
  }[];
  badges: { code: string; earnedAt: Date }[];
  notifications: {
    type: string;
    data: unknown;
    read: boolean;
    createdAt: Date;
  }[];
  conversations: {
    userA: Named;
    userB: Named;
    messages: { content: string; createdAt: Date }[];
  }[];
  blocks: { createdAt: Date; blocked: Named }[];
  tournamentEntries: {
    seed: number;
    eliminatedRound: number | null;
    tournament: { name: string; status: string };
  }[];
  tournamentsCreated: { name: string; status: string; createdAt: Date }[];
}

const BOM = '﻿';

/** Échappe une cellule CSV ; neutralise l'injection de formules (texte commençant par =, +, -, @) que Excel exécuterait à l'ouverture ; les nombres, même négatifs, restent intacts. */
function cell(value: Cell): string {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Noms des joueurs d'une équipe, séparés par « & » (le coéquipier est optionnel). */
function team(...players: (Named | null)[]): string {
  return players
    .filter((p): p is Named => p !== null)
    .map((p) => p.displayname)
    .join(' & ');
}

/** Un seul fichier CSV : une section par type de donnée (titre, en-têtes, lignes), séparées par une ligne vide. UTF-8 avec BOM pour que Excel affiche bien les accents. */
export function toCsv(
  data: UserDataForCsv,
  userId: string,
  exportedAt: string,
): string {
  const points = (deltas: unknown): number | null => {
    const value = (deltas as Record<string, number> | null)?.[userId];
    return typeof value === 'number' ? value : null;
  };
  const sections: Section[] = [
    { name: 'export', rows: [{ exportedAt }] },
    { name: 'profile', rows: data.profile ? [data.profile] : [] },
    {
      name: 'friendships',
      rows: data.friendships.map((f) => ({
        status: f.status,
        requester: f.requester.displayname,
        addressee: f.addressee.displayname,
        createdAt: f.createdAt,
      })),
    },
    {
      name: 'matches',
      rows: data.matches.map((m) => ({
        id: m.id,
        date: m.createdAt,
        format: m.format,
        status: m.status,
        teamA: team(m.teamAPlayer1, m.teamAPlayer2),
        teamB: team(m.teamBPlayer1, m.teamBPlayer2),
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        rankingPoints: points(m.ratingDeltas),
        tournamentLeg: m.legNumber,
      })),
    },
    { name: 'badges', rows: data.badges },
    {
      name: 'notifications',
      rows: data.notifications.map((n) => ({
        type: n.type,
        read: n.read,
        createdAt: n.createdAt,
        data: JSON.stringify(n.data),
      })),
    },
    {
      name: 'messagesSent',
      rows: data.conversations.flatMap((c) =>
        c.messages.map((m) => ({
          conversationWith: [c.userA, c.userB]
            .map((u) => u.displayname)
            .join(' / '),
          sentAt: m.createdAt,
          content: m.content,
        })),
      ),
    },
    {
      name: 'blockedUsers',
      rows: data.blocks.map((b) => ({
        user: b.blocked.displayname,
        blockedAt: b.createdAt,
      })),
    },
    {
      name: 'tournamentEntries',
      rows: data.tournamentEntries.map((e) => ({
        tournament: e.tournament.name,
        tournamentStatus: e.tournament.status,
        seed: e.seed,
        eliminatedRound: e.eliminatedRound,
      })),
    },
    { name: 'tournamentsCreated', rows: data.tournamentsCreated },
  ];

  const lines: string[] = [];
  for (const { name, rows } of sections) {
    lines.push(cell(`# ${name}`));
    if (rows.length === 0) {
      lines.push(cell('(none)'), '');
      continue;
    }
    const headers = Object.keys(rows[0]);
    lines.push(headers.map(cell).join(','));
    for (const row of rows) {
      lines.push(headers.map((h) => cell(row[h])).join(','));
    }
    lines.push('');
  }
  return BOM + lines.join('\r\n');
}
