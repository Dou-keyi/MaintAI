-- ==========================================
-- 1. USERS (PROFILES)
-- ==========================================
-- Supabase handles auth in the `auth.users` table. 
-- We create a public `profiles` table to store extra user metadata.
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  company_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 2. EQUIPMENT CATALOG
-- ==========================================
-- Predefined globally available equipment models 
-- (e.g. Siemens Motor, ABB HVAC, GE Pump)
CREATE TABLE public.equipment_catalog (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand TEXT NOT NULL,         -- e.g., 'Siemens', 'ABB', 'GE', 'Schneider', 'Generic'
  equipment_type TEXT NOT NULL,-- e.g., 'Motor', 'Pump', 'HVAC', 'Conveyor'
  model_name TEXT NOT NULL,    -- e.g., 'Siemens Alpha Motor 2000'
  specifications JSONB DEFAULT '{}'::jsonb, -- Store voltage, capacity, constraints etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert some default catalog items
INSERT INTO public.equipment_catalog (brand, equipment_type, model_name) VALUES 
('Siemens', 'Motor', 'Siemens Simotics S-1FK2'),
('ABB', 'Pump', 'ABB Ability Smart Sensor Pump'),
('GE', 'HVAC', 'GE Zenith Industrial HVAC'),
('Schneider', 'Conveyor', 'Schneider Lexium Conveyor');

-- ==========================================
-- 3. USER EQUIPMENTS (MACHINES)
-- ==========================================
-- The specific instances of equipment owned by a user
CREATE TABLE public.user_equipments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  catalog_id UUID REFERENCES public.equipment_catalog(id) ON DELETE SET NULL, -- Null if custom equipment
  
  -- Custom metadata
  custom_name TEXT NOT NULL,      -- User's nickname for the machine (e.g., 'Pump Alpha')
  custom_type TEXT,               -- Fallback if not using catalog (e.g., 'Custom Fan')
  custom_brand TEXT,              -- Fallback if not using catalog
  location TEXT,                  -- e.g., 'Facility A, Sector 4'
  
  -- Current Health State (Updated by ML Predictions)
  status TEXT DEFAULT 'Healthy',  -- 'Healthy', 'Warning', 'Critical'
  health_pct NUMERIC DEFAULT 100 CHECK (health_pct >= 0 AND health_pct <= 100),
  rul_cycles NUMERIC DEFAULT 100,
  
  -- Timestamps
  last_maintenance_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 4. TELEMETRY LOGS (CSV UPLOADS)
-- ==========================================
-- The time-series sensor history uploaded by the user
CREATE TABLE public.equipment_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID REFERENCES public.user_equipments(id) ON DELETE CASCADE NOT NULL,
  
  log_timestamp TIMESTAMPTZ NOT NULL,
  event_type TEXT DEFAULT 'sensor', -- 'sensor', 'error', 'warn', 'maint', 'failure'
  
  -- Sensor metrics
  temperature NUMERIC DEFAULT 0,
  vibration NUMERIC DEFAULT 0,
  rpm NUMERIC DEFAULT 0,
  
  -- Context
  notes TEXT,
  
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster time-series queries
CREATE INDEX idx_logs_equipment_time ON public.equipment_logs(equipment_id, log_timestamp DESC);


-- ==========================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================
-- Enable RLS so users can only see their own data
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_equipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can view and update their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Catalog: Everyone can view the catalog (read-only)
CREATE POLICY "Anyone can view equipment catalog" 
ON public.equipment_catalog FOR SELECT USING (true);

-- User Equipments: Users fully control their own machines
CREATE POLICY "Users govern own equipments" 
ON public.user_equipments FOR ALL USING (auth.uid() = user_id);

-- Equipment Logs: Users govern their own machine logs
CREATE POLICY "Users govern own logs" 
ON public.equipment_logs FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_equipments 
    WHERE user_equipments.id = equipment_logs.equipment_id 
    AND user_equipments.user_id = auth.uid()
  )
);

-- ==========================================
-- 6. TRIGGERS
-- ==========================================
-- Trigger to automatically create a profile when a new user signs up in Auth
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
