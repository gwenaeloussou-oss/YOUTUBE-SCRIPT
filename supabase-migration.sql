-- ============================================================
-- YouScript Booster — Migration Supabase
-- Colle ce SQL dans : Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- 1. Table profiles (données utilisateur + plan)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  phone text,
  dial_code text,
  country text,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'standard')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture propre profil" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Mise à jour propre profil" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 2. Table usage (compteur scripts par mois)
CREATE TABLE public.usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL,
  count integer NOT NULL DEFAULT 0,
  UNIQUE(user_id, year, month)
);

ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestion usage propre" ON public.usage
  FOR ALL USING (auth.uid() = user_id);

-- 3. Table history (scripts générés)
CREATE TABLE public.history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type text NOT NULL DEFAULT 'video',
  source_url text,
  language text NOT NULL DEFAULT 'Français',
  word_count integer,
  titre text NOT NULL DEFAULT '',
  result jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestion historique propre" ON public.history
  FOR ALL USING (auth.uid() = user_id);

-- 4. Trigger auto-création profil à l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, phone, dial_code, country)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'dial_code',
    NEW.raw_user_meta_data->>'country'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Table promo_uses (log des codes promo utilisés par compte)
CREATE TABLE IF NOT EXISTS public.promo_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  used_at timestamptz DEFAULT now()
);

ALTER TABLE public.promo_uses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture promo_uses propre" ON public.promo_uses
  FOR SELECT USING (auth.uid() = user_id);

-- 6. Table payments (log des paiements Chariow)
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chariow_sale_id text,
  amount integer,
  currency text DEFAULT 'XOF',
  email text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture paiements propres" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- Mise à jour plan pro → standard (si tables déjà créées)
-- ============================================================
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('free', 'standard'));
UPDATE public.profiles SET plan = 'standard' WHERE plan = 'pro';

-- ============================================================
-- Ajout expiration abonnement (30 jours + 5 jours de grâce)
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz;

-- ============================================================
-- Ajout cycle de facturation (mensuel 60 scripts / annuel 100 scripts)
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'monthly';
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_billing_cycle_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_billing_cycle_check CHECK (billing_cycle IN ('monthly', 'annual'));

-- ============================================================
-- Multi-plateforme : offres + bibliothèque de contenus
-- ============================================================

-- 7. Table offers (fiche d'offre réutilisable pour la génération)
CREATE TABLE IF NOT EXISTS public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  sector text,
  description text,
  target text,
  promise text,
  differentiators text,
  proof text,
  commercial_terms text,
  cta text,
  brand_tone text DEFAULT 'expert',
  language text NOT NULL DEFAULT 'Français',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gestion offres propres" ON public.offers;
CREATE POLICY "Gestion offres propres" ON public.offers
  FOR ALL USING (auth.uid() = user_id);

-- 8. Extension de la table history en bibliothèque de contenus multi-plateforme
ALTER TABLE public.history ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'youtube_long';
ALTER TABLE public.history DROP CONSTRAINT IF EXISTS history_platform_check;
ALTER TABLE public.history ADD CONSTRAINT history_platform_check
  CHECK (platform IN ('youtube_long', 'youtube_short', 'facebook', 'linkedin', 'facebook_comment'));

ALTER TABLE public.history ADD COLUMN IF NOT EXISTS offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL;
ALTER TABLE public.history ADD COLUMN IF NOT EXISTS objective text;

ALTER TABLE public.history ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';
ALTER TABLE public.history DROP CONSTRAINT IF EXISTS history_status_check;
ALTER TABLE public.history ADD CONSTRAINT history_status_check
  CHECK (status IN ('draft', 'validated', 'scheduled', 'published'));

-- ============================================================
-- Phase 2 : pipeline RAG (base de connaissances vectorisée)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.ebooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  platform_tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ebook_id uuid NOT NULL REFERENCES public.ebooks(id) ON DELETE CASCADE,
  section text,
  platform_tags text[] NOT NULL DEFAULT '{}',
  content text NOT NULL,
  embedding vector(768),
  created_at timestamptz DEFAULT now()
);

-- HNSW plutôt qu'ivfflat : pas de perte de recall tant que le corpus est petit
-- (ivfflat nécessite beaucoup de données pour bien clusteriser dès la création).
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx ON public.knowledge_chunks
  USING hnsw (embedding vector_cosine_ops);

ALTER TABLE public.ebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;
-- Pas de policy publique : uniquement accessible via la clé service_role (côté serveur).

CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding vector(768),
  match_platform text,
  match_count int DEFAULT 4
)
RETURNS TABLE (content text, section text, similarity float)
LANGUAGE sql STABLE
AS $$
  SELECT knowledge_chunks.content, knowledge_chunks.section,
         1 - (knowledge_chunks.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_chunks
  WHERE match_platform = ANY(knowledge_chunks.platform_tags) OR knowledge_chunks.platform_tags = '{}'
  ORDER BY knowledge_chunks.embedding <=> query_embedding
  LIMIT match_count;
$$;
