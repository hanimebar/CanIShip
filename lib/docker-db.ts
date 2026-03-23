/**
 * Docker-mode local database adapter
 *
 * When DOCKER_MODE=true this replaces Supabase.
 * Uses SQLite by default; switches to Postgres if DATABASE_URL is set.
 *
 * Tables are auto-created on first use — zero configuration needed.
 */

import type { AuditJob, AuditReport, ClaudeReport } from './supabase'

// ── Types ──────────────────────────────────────────────────────────────────

export type DockerJob = Omit<AuditJob, 'user_id'> & { user_id: string; is_public: boolean }
export type DockerReport = Omit<AuditReport, 'user_id'> & { user_id: string }

// ── Lazy-loaded DB instance ────────────────────────────────────────────────

let _db: SQLiteDB | null = null

interface SQLiteDB {
  getJob(id: string): DockerJob | null
  createJob(job: Omit<DockerJob, 'id' | 'created_at' | 'status'>): DockerJob
  updateJob(id: string, patch: Partial<DockerJob>): void
  listJobs(): DockerJob[]
  createReport(report: Omit<DockerReport, 'id' | 'created_at'>): DockerReport
  getReport(jobId: string): DockerReport | null
}

function getDb(): SQLiteDB {
  if (_db) return _db

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require(/* webpackIgnore: true */ 'better-sqlite3')
  if (typeof Database !== 'function') {
    throw new Error(
      'better-sqlite3 failed to load. This usually means DOCKER_MODE=true is set outside of a Docker container. ' +
      'Remove DOCKER_MODE from your environment variables if you are not running the Docker self-hosted image.'
    )
  }

  const dbPath = process.env.SQLITE_PATH || '/data/caniship.db'

  // Ensure parent directory exists
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs')
  const dir = dbPath.substring(0, dbPath.lastIndexOf('/'))
  if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_jobs (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL DEFAULT 'docker-local',
      url             TEXT NOT NULL,
      description     TEXT NOT NULL DEFAULT '',
      flows           TEXT NOT NULL DEFAULT '[]',
      depth           TEXT NOT NULL DEFAULT 'quick',
      target_platform TEXT NOT NULL DEFAULT 'all',
      is_public       INTEGER NOT NULL DEFAULT 1,
      app_icon_url    TEXT,
      status          TEXT NOT NULL DEFAULT 'queued',
      error_message   TEXT,
      worker_id       TEXT,
      callback_url    TEXT,
      started_at      TEXT,
      completed_at    TEXT,
      created_at      TEXT NOT NULL
    );
    -- Add columns to existing DBs (safe to run multiple times)
    ALTER TABLE audit_jobs ADD COLUMN IF NOT EXISTS target_platform TEXT NOT NULL DEFAULT 'all';
    ALTER TABLE audit_jobs ADD COLUMN IF NOT EXISTS is_public INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE audit_jobs ADD COLUMN IF NOT EXISTS app_icon_url TEXT;

    CREATE TABLE IF NOT EXISTS audit_reports (
      id           TEXT PRIMARY KEY,
      job_id       TEXT NOT NULL UNIQUE REFERENCES audit_jobs(id) ON DELETE CASCADE,
      user_id      TEXT NOT NULL DEFAULT 'docker-local',
      report_json  TEXT NOT NULL,
      ship_score   REAL NOT NULL,
      ship_verdict TEXT NOT NULL,
      created_at   TEXT NOT NULL
    );
  `)

  _db = {
    getJob(id: string): DockerJob | null {
      const row = db.prepare('SELECT * FROM audit_jobs WHERE id = ?').get(id) as Record<string, unknown> | undefined
      return row ? deserializeJob(row) : null
    },

    createJob(job: Omit<DockerJob, 'id' | 'created_at' | 'status'>): DockerJob {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { randomUUID } = require('crypto')
      const id = randomUUID()
      const now = new Date().toISOString()
      db.prepare(`
        INSERT INTO audit_jobs (id, user_id, url, description, flows, depth, target_platform, is_public, app_icon_url, status, callback_url, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)
      `).run(id, job.user_id, job.url, job.description, JSON.stringify(job.flows || []), job.depth, job.target_platform ?? 'all', job.is_public !== false ? 1 : 0, job.app_icon_url ?? null, job.callback_url ?? null, now)
      return this.getJob(id)!
    },

    updateJob(id: string, patch: Partial<DockerJob>): void {
      const fields: string[] = []
      const values: unknown[] = []
      for (const [k, v] of Object.entries(patch)) {
        if (k === 'id') continue
        fields.push(`${k} = ?`)
        values.push(k === 'flows' && Array.isArray(v) ? JSON.stringify(v) : v)
      }
      if (!fields.length) return
      values.push(id)
      db.prepare(`UPDATE audit_jobs SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    },

    listJobs(): DockerJob[] {
      const rows = db.prepare('SELECT * FROM audit_jobs ORDER BY created_at DESC LIMIT 200').all() as Record<string, unknown>[]
      return rows.map(deserializeJob)
    },

    createReport(report: Omit<DockerReport, 'id' | 'created_at'>): DockerReport {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { randomUUID } = require('crypto')
      const id = randomUUID()
      const now = new Date().toISOString()
      db.prepare(`
        INSERT INTO audit_reports (id, job_id, user_id, report_json, ship_score, ship_verdict, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, report.job_id, report.user_id, JSON.stringify(report.report_json), report.ship_score, report.ship_verdict, now)
      return this.getReport(report.job_id)!
    },

    getReport(jobId: string): DockerReport | null {
      const row = db.prepare('SELECT * FROM audit_reports WHERE job_id = ?').get(jobId) as Record<string, unknown> | undefined
      if (!row) return null
      return {
        id: row.id as string,
        job_id: row.job_id as string,
        user_id: row.user_id as string,
        report_json: JSON.parse(row.report_json as string) as ClaudeReport,
        ship_score: row.ship_score as number,
        ship_verdict: row.ship_verdict as 'yes' | 'no' | 'conditional',
        created_at: row.created_at as string,
      }
    },
  }

  return _db
}

function deserializeJob(row: Record<string, unknown>): DockerJob {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    url: row.url as string,
    description: row.description as string,
    flows: JSON.parse(row.flows as string || '[]') as string[],
    depth: row.depth as 'quick' | 'standard' | 'deep',
    target_platform: (row.target_platform as 'mobile' | 'desktop' | 'all') ?? 'all',
    is_public: row.is_public !== 0,
    app_icon_url: row.app_icon_url as string | undefined,
    status: row.status as 'queued' | 'running' | 'complete' | 'failed',
    error_message: row.error_message as string | undefined,
    worker_id: row.worker_id as string | undefined,
    callback_url: row.callback_url as string | undefined,
    started_at: row.started_at as string | undefined,
    completed_at: row.completed_at as string | undefined,
    created_at: row.created_at as string,
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export const dockerDb = {
  getJob: (id: string) => getDb().getJob(id),
  createJob: (job: Omit<DockerJob, 'id' | 'created_at' | 'status'>) => getDb().createJob(job),
  updateJob: (id: string, patch: Partial<DockerJob>) => getDb().updateJob(id, patch),
  listJobs: () => getDb().listJobs(),
  createReport: (report: Omit<DockerReport, 'id' | 'created_at'>) => getDb().createReport(report),
  getReport: (jobId: string) => getDb().getReport(jobId),
}
