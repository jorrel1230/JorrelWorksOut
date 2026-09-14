import { createClient } from '@supabase/supabase-js'

// Public client configuration; private service-role credentials must never be used here.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL ?? 'https://gvazsjdtrebpzcuhcrek.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_3AYOgJTQg2HT6pO5IPY2IA_rokUp9WM',
)
