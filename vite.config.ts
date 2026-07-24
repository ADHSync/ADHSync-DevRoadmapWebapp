import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

function decodeJwtRole(token: string): string | undefined {
  const payload = token.split(".")[1];

  if (!payload) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { role?: unknown };

    return typeof parsed.role === "string" ? parsed.role : undefined;
  } catch {
    return undefined;
  }
}

function validateFrontendEnvironment(
  environment: Record<string, string>,
  requireConfigured: boolean,
): void {
  const supabaseUrl = environment.VITE_SUPABASE_URL?.trim();
  const supabaseKey = environment.VITE_SUPABASE_ANON_KEY?.trim();
  const missingVariables = [
    !supabaseUrl && "VITE_SUPABASE_URL",
    !supabaseKey && "VITE_SUPABASE_ANON_KEY",
  ].filter((name): name is string => Boolean(name));

  if (requireConfigured && missingVariables.length > 0) {
    throw new Error(
      `Supabase-Konfiguration fehlt: ${missingVariables.join(", ")}. ` +
        "Lege die fehlenden Werte in .env.local an.",
    );
  }

  if (
    supabaseKey &&
    (supabaseKey.startsWith("sb_secret_") ||
      decodeJwtRole(supabaseKey) === "service_role")
  ) {
    throw new Error(
      "VITE_SUPABASE_ANON_KEY enthält einen Supabase-Secret-/service_role-Key. " +
        "Frontend-Build abgebrochen: Verwende ausschließlich den öffentlichen " +
        "Publishable- beziehungsweise anon-Key.",
    );
  }
}

export default defineConfig(({ command, mode }) => {
  validateFrontendEnvironment(
    loadEnv(mode, process.cwd(), ""),
    command === "serve" && mode !== "test",
  );

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-react": ["react", "react-dom", "react-router-dom"],
            "vendor-supabase": ["@supabase/supabase-js"],
            "vendor-ui": ["lucide-react", "sonner"],
          },
        },
      },
    },
  };
});
