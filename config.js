/* =========================================================
   Parla by Hitondra — Configuration Supabase
   =========================================================
   Ce fichier doit être chargé APRÈS la librairie Supabase JS
   (via le <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>)
   et AVANT le code de chaque page (connexion.html / membre.html).

   ⚠️ À FAIRE : remplacez SUPABASE_PUBLISHABLE_KEY ci-dessous par
   votre clé "anon public" (Supabase > Project Settings > API Keys).
   Ne mettez JAMAIS la "service_role" key ici.
========================================================= */

const SUPABASE_URL = "https://ksihdowudyadlkhvybnj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_uI77bn8PKuFBVKRZLo86Sg_2k9-aF53";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
