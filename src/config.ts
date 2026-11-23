/**
 * Instellingen van het Agentenkantoor.
 *
 * STATUS_URL: waar de app data/status.json ophaalt.
 * Leeg = demo-modus (nepdata). Vul na het aanmaken van de GitHub-repo in, bijvoorbeeld:
 *   'https://raw.githubusercontent.com/<gebruiker>/agentenkantoor/main/data/status.json'
 */
export const STATUS_URL = 'https://raw.githubusercontent.com/DuurzaamInHuis/agentenkantoor/main/data/status.json';

/** Hoe vaak status.json opnieuw wordt opgehaald. */
export const REFRESH_MS = 60_000;
/** Hoe vaak agents.config.json opnieuw wordt opgehaald (nieuwe bureaus). */
export const CONFIG_REFRESH_MS = 5 * 60_000;
/** Na hoeveel tijd de status als verouderd (oranje) geldt. */
export const STALE_AFTER_MS = 2 * 60 * 60_000;
/** Hoe lang een agent na een geslaagde run als "klaar" wordt getoond. */
export const DONE_WINDOW_MS = 15 * 60_000;
/** Hoe vaak de demo-data van stand wisselt. */
export const DEMO_TICK_MS = 4_000;

export const TIMEZONE = 'Europe/Madrid';
/** Voor de stand van de zon (licht door de ramen). */
export const LOCATION = { lat: 40.4168, lon: -3.7038 };
/** Dagelijkse briefing: dan loopt de postbode naar de deur van Kelvin. */
export const BRIEFING_TIME = { hour: 8, minute: 30 };

export const MAX_FPS = 30;
