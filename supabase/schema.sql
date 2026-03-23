-- CanIShip Database Schema
-- Run this in Supabase SQL editor or via Supabase CLI

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase Auth users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'builder', 'studio')),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  audits_used_this_month INTEGER NOT NULL DEFAULT 0,
  audits_reset_at TIMESTAMP WITH TIME ZONE DEFAULT (date_trunc('month', NOW()) + INTERVAL '1 month'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- AUDIT JOBS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_jobs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  description TEXT NOT NULL,
  flows TEXT[] DEFAULT '{}',
  depth TEXT NOT NULL DEFAULT 'quick' CHECK (depth IN ('quick', 'standard', 'deep')),
  target_platform TEXT NOT NULL DEFAULT 'all' CHECK (target_platform IN ('mobile', 'desktop', 'all')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'complete', 'failed')),
  error_message TEXT,
  worker_id TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for audit_jobs
ALTER TABLE public.audit_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own audit jobs" ON public.audit_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own audit jobs" ON public.audit_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role can update any job" ON public.audit_jobs FOR UPDATE USING (true);

-- Index for worker polling
CREATE INDEX IF NOT EXISTS idx_audit_jobs_status ON public.audit_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_jobs_user_id ON public.audit_jobs(user_id, created_at DESC);

-- ============================================================
-- AUDIT REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  job_id UUID REFERENCES public.audit_jobs(id) ON DELETE CASCADE UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  report_json JSONB NOT NULL,
  ship_score INTEGER NOT NULL CHECK (ship_score >= 0 AND ship_score <= 100),
  ship_verdict TEXT NOT NULL CHECK (ship_verdict IN ('yes', 'no', 'conditional')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for audit_reports
ALTER TABLE public.audit_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own reports" ON public.audit_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can insert reports" ON public.audit_reports FOR INSERT WITH CHECK (true);

-- Index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_audit_reports_user_id ON public.audit_reports(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_reports_job_id ON public.audit_reports(job_id);

-- ============================================================
-- SCREENSHOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.screenshots (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  job_id UUID REFERENCES public.audit_jobs(id) ON DELETE CASCADE NOT NULL,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  step_label TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for screenshots
ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own screenshots" ON public.screenshots
  FOR SELECT USING (
    auth.uid() = (SELECT user_id FROM public.audit_jobs WHERE id = screenshots.job_id)
  );
CREATE POLICY "Service role can insert screenshots" ON public.screenshots FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_screenshots_job_id ON public.screenshots(job_id);

-- ============================================================
-- STRIPE EVENTS (idempotency)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- DOCKER LICENSES (Studio plan self-hosted keys)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.docker_licenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  license_key TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.docker_licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own license" ON public.docker_licenses FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_docker_licenses_key ON public.docker_licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_docker_licenses_user_id ON public.docker_licenses(user_id);

-- ============================================================
-- Supabase Storage bucket for screenshots
-- (Run this separately via Supabase dashboard or CLI)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('screenshots', 'screenshots', false);

-- ============================================================
-- API KEYS (programmatic access)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  key_hash     TEXT NOT NULL UNIQUE,   -- SHA-256 hex of the raw key (never stored in plaintext)
  key_prefix   TEXT NOT NULL,          -- e.g. "cis_a1b2c3d4" — shown in key list
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own api keys" ON public.api_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own api keys" ON public.api_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own api keys" ON public.api_keys FOR DELETE USING (auth.uid() = user_id);
-- Service role needs UPDATE to write last_used_at
CREATE POLICY "Service role can update api keys" ON public.api_keys FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx ON public.api_keys(key_hash);

-- ============================================================
-- AUDIT JOBS — incremental column additions
-- ============================================================
ALTER TABLE public.audit_jobs ADD COLUMN IF NOT EXISTS callback_url TEXT;
ALTER TABLE public.audit_jobs ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true;

-- ============================================================
-- AUDIT REPORTS — change ship_score to numeric for 2 decimal places
-- Run once: ALTER TABLE public.audit_reports ALTER COLUMN ship_score TYPE NUMERIC(5,2);
-- ============================================================

-- ============================================================
-- FUNCTION: claim_next_audit_job
-- Atomically claims the oldest queued job for a worker.
-- Uses FOR UPDATE SKIP LOCKED — safe for concurrent workers, no deadlocks.
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_next_audit_job(p_worker_id TEXT)
RETURNS SETOF public.audit_jobs
LANGUAGE sql AS $$
  UPDATE public.audit_jobs
  SET
    status    = 'running',
    worker_id = p_worker_id,
    started_at = NOW()
  WHERE id = (
    SELECT id
    FROM   public.audit_jobs
    WHERE  status = 'queued'
    ORDER  BY created_at ASC
    LIMIT  1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;

-- ============================================================
-- FUNCTION: increment_audit_count
-- Atomically increments the monthly audit counter only if under limit.
-- Handles monthly reset. Returns success, current count, and plan.
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_audit_count(p_user_id UUID, p_limit INT)
RETURNS TABLE(success BOOLEAN, used INT, plan TEXT)
LANGUAGE plpgsql AS $$
DECLARE
  v_used     INT;
  v_plan     TEXT;
  v_reset_at TIMESTAMPTZ;
  v_limit    INT;
BEGIN
  -- Lock the row for this user for the duration of the transaction
  SELECT
    audits_used_this_month,
    profiles.plan,
    audits_reset_at
  INTO v_used, v_plan, v_reset_at
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  -- Derive the actual limit from the user's plan (p_limit is a fallback)
  v_limit := CASE v_plan
    WHEN 'studio'  THEN 99999
    WHEN 'builder' THEN 15
    ELSE 3
  END;

  -- Monthly reset
  IF v_reset_at IS NULL OR NOW() >= v_reset_at THEN
    v_used := 0;
    UPDATE public.profiles
    SET
      audits_used_this_month = 0,
      audits_reset_at = DATE_TRUNC('month', NOW() + INTERVAL '1 month')
    WHERE id = p_user_id;
  END IF;

  -- Check limit
  IF v_used >= v_limit THEN
    RETURN QUERY SELECT FALSE, v_used, v_plan;
    RETURN;
  END IF;

  -- Increment
  UPDATE public.profiles
  SET audits_used_this_month = v_used + 1
  WHERE id = p_user_id;

  RETURN QUERY SELECT TRUE, v_used + 1, v_plan;
END;
$$;
