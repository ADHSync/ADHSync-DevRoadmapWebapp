import { createClient } from "@supabase/supabase-js";

import type { Database } from "../types/database";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

const missingVariables = [
  !supabaseUrl && "VITE_SUPABASE_URL",
  !supabaseAnonKey && "VITE_SUPABASE_ANON_KEY",
].filter((name): name is string => Boolean(name));

if (missingVariables.length > 0) {
  throw new Error(
    `Supabase-Konfiguration fehlt: ${missingVariables.join(", ")}. ` +
      "Lege die fehlenden Werte in .env.local an.",
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
