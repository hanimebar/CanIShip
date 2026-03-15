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
-- Supabase Storage bucket for screenshots
-- (Run this separately via Supabase dashboard or CLI)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('screenshots', 'screenshots', false);
