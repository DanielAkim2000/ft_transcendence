import { Injectable } from '@nestjs/common';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';

export type ServiceState = 'ok' | 'down';
export type BackupState = 'ok' | 'stale' | 'none';

/** [Minor · Health check et sauvegardes] Rapport de santé : statut global, base, sauvegardes, uptime. */
export interface HealthReport {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  uptimeSeconds: number;
  checks: {
    api: { status: ServiceState };
    database: { status: ServiceState; latencyMs: number | null };
    backups: {
      status: BackupState;
      count: number;
      lastBackupAt: string | null;
      lastBackupSizeBytes: number | null;
      maxAgeHours: number;
    };
  };
}

const DEFAULT_BACKUP_DIR = '/backups';
const DEFAULT_MAX_AGE_HOURS = 36;
const DB_CHECK_TIMEOUT_MS = 3000;
const BACKUP_FILE = /\.sql\.gz$/;

/** [Minor · Health check et sauvegardes] Service métier du health check. */
@Injectable()
export class HealthService {
  /** Injecte les dépendances : PrismaService. */
  constructor(private readonly prisma: PrismaService) {}

  /** [Minor · Health check et sauvegardes] Rapport d'état : API, base de données (requête réelle + latence) et sauvegardes (dernier dump trop ancien ou absent = dégradé). */
  async check(): Promise<HealthReport> {
    const [database, backups] = await Promise.all([
      this.checkDatabase(),
      this.checkBackups(),
    ]);
    const status =
      database.status === 'down'
        ? 'down'
        : backups.status === 'ok'
          ? 'ok'
          : 'degraded';
    return {
      status,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      checks: { api: { status: 'ok' }, database, backups },
    };
  }

  /** [Minor · Health check et sauvegardes] Exécute `SELECT 1` avec un délai maximal et mesure la latence. */
  private async checkDatabase(): Promise<{
    status: ServiceState;
    latencyMs: number | null;
  }> {
    const start = Date.now();
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('timeout')),
            DB_CHECK_TIMEOUT_MS,
          ).unref(),
        ),
      ]);
      return { status: 'ok', latencyMs: Date.now() - start };
    } catch {
      return { status: 'down', latencyMs: null };
    }
  }

  /** [Minor · Health check et sauvegardes] Lit le dossier des sauvegardes (monté en lecture seule) : nombre de dumps, date et taille du plus récent. */
  private async checkBackups(): Promise<HealthReport['checks']['backups']> {
    const dir = process.env.BACKUP_DIR ?? DEFAULT_BACKUP_DIR;
    const maxAgeHours = Number(
      process.env.BACKUP_MAX_AGE_HOURS ?? DEFAULT_MAX_AGE_HOURS,
    );
    try {
      const names = (await readdir(dir)).filter((name) =>
        BACKUP_FILE.test(name),
      );
      const files = await Promise.all(
        names.map(async (name) => ({ stats: await stat(join(dir, name)) })),
      );
      files.sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);
      const last = files[0]?.stats;
      if (!last) {
        return {
          status: 'none',
          count: 0,
          lastBackupAt: null,
          lastBackupSizeBytes: null,
          maxAgeHours,
        };
      }
      const ageHours = (Date.now() - last.mtimeMs) / 3_600_000;
      return {
        status: ageHours <= maxAgeHours ? 'ok' : 'stale',
        count: files.length,
        lastBackupAt: last.mtime.toISOString(),
        lastBackupSizeBytes: last.size,
        maxAgeHours,
      };
    } catch {
      return {
        status: 'none',
        count: 0,
        lastBackupAt: null,
        lastBackupSizeBytes: null,
        maxAgeHours,
      };
    }
  }
}
