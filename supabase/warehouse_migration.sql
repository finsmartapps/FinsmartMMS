-- ============================================================
-- Warehouse Module Migration
-- Run this in the Supabase SQL Editor for project: tkiueikctadfifogyxho
-- ============================================================

-- 1. Add has_warehouse flag to existing profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_warehouse BOOLEAN NOT NULL DEFAULT false;

-- 2. Inventory items table
CREATE TABLE IF NOT EXISTS wms_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Other',
  description TEXT DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'pcs',
  min_stock INTEGER NOT NULL DEFAULT 5,
  location TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  images JSONB DEFAULT '[]',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Events table
CREATE TABLE IF NOT EXISTS wms_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT DEFAULT '',
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'upcoming',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Shipments table
CREATE TABLE IF NOT EXISTS wms_shipments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES wms_events(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('outbound', 'inbound')),
  status TEXT NOT NULL DEFAULT 'pending',
  dispatch_date DATE,
  delivery_date DATE,
  tracking_ref TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  items JSONB NOT NULL DEFAULT '[]',
  images JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Enable RLS
ALTER TABLE wms_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE wms_shipments ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies (authenticated users only)
DROP POLICY IF EXISTS "wms_items_auth" ON wms_items;
DROP POLICY IF EXISTS "wms_events_auth" ON wms_events;
DROP POLICY IF EXISTS "wms_shipments_auth" ON wms_shipments;

CREATE POLICY "wms_items_auth"     ON wms_items     FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "wms_events_auth"    ON wms_events    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "wms_shipments_auth" ON wms_shipments FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 7. Optional: enable has_warehouse for chirag.p@finsmartaccounting.com
-- UPDATE profiles SET has_warehouse = true WHERE id = (
--   SELECT id FROM auth.users WHERE email = 'chirag.p@finsmartaccounting.com'
-- );

-- ============================================================
-- STORAGE BUCKETS (create manually in Supabase Dashboard):
--   1. Go to Storage → New bucket
--   2. Create "wms-item-images"     (Public: ON)
--   3. Create "wms-shipment-images" (Public: ON)
-- ============================================================
