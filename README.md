# Agentenkantoor

Een levendig pixel-art kantoor waarin elk poppetje één van Kelvins AI-agents is. In één oogopslag zie je wie aan het werk is, wie op je wacht en waar iets misgaat.

- Drie afdelingen naast elkaar (op de telefoon onder elkaar): **Optima Isolatie**, **Duurzaam In Huis** en **Casoleo**.
- Elk poppetje zit aan een eigen bureau, met naambordje en rol-icoon.
- Klik of tik op een poppetje (of bureau) voor details; de knop **Lijst** toont alles als tabel.
- Met **Gelezen** in het paneel gaat een poppetje met een melding weer zitten. Dat geldt op dat apparaat, tot er een nieuwe melding komt (andere status, nieuwe run, ander aantal openstaande punten, of bij de takenlijst een nieuwe dag).
- Het licht volgt de echte tijd in Europe/Madrid. 's Nachts branden alleen de lampjes van agents die werken.
- Om 08:30 brengt de postbode de dagelijkse briefing naar de deur van Kelvin.

De app schrijft zelf niets en heeft geen backend. Hij leest twee bestanden:

| Bestand | Wie past het aan | Wat staat erin |
| --- | --- | --- |
| `public/agents.config.json` | Kelvin, met de hand | Welke afdelingen en agents er zijn |
| `data/status.json` | De status-agent, elk uur (leest je cloud-routines) | De live stand van alle agents |

## Wat de poppetjes doen

| Status | Wat je ziet |
| --- | --- |
| `working` | Typt, scherm flikkert, af en toe vliegt er een papiertje |
| `waiting` (wacht op Kelvin) | Staat naast het bureau, steekt een hand op, geel uitroeptekenwolkje |
| `done` (klaar in de laatste 15 min) | Groen vinkje, rekt zich uit |
| `idle` (wacht op volgende run) | Drinkt koffie, loopt soms naar de automaat, de plant of een collega |
| `error` | Rood wolkje, rook boven de computer, handen in het haar |
| `paused` | Lamp uit, bordje "Pauze", poppetje is weg |
| planned (nog niet gebouwd) | Leeg bureau met bordje "Vacature" |

## Lokaal draaien

Je hebt [Node.js](https://nodejs.org) 20 of nieuwer nodig.

```bash
npm install
npm run dev
```

Open daarna http://localhost:5173. Handige URL-parameters:

| Parameter | Wat het doet |
| --- | --- |
| `?demo=1` | Demo-modus met nepdata die elke paar seconden wisselt (standaard zolang `STATUS_URL` leeg is) |
| `?status=/data/status.json` | Lokaal een statusbestand van dezelfde server gebruiken (alleen eigen server, om misbruik te voorkomen) |
| `?tijd=21:30` | Een ander tijdstip simuleren, bijvoorbeeld om de nacht of de postbode (`?tijd=08:30`) te zien |

Parameters zijn te combineren: `?status=/data/status.json&tijd=22:00`.

Productiebuild maken en bekijken:

```bash
npm run build
npm run preview
```

## Een agent toevoegen

Meestal hoeft dit niet met de hand: maak je een nieuwe terugkerende routine waarvan de naam begint met "DIH", "Casoleo" of "Optima", dan voegt de status-agent bij zijn volgende run zelf een bureau toe. Met de knop **Ververs** in de topbalk haal je daarna meteen de nieuwste agents en status op, in plaats van te wachten. Een bureau met de hand toevoegen kan ook:

Voeg een blok toe aan `agents` in `public/agents.config.json`:

```json
{
  "id": "dih-reviews",
  "name": "Reviews",
  "shortName": "Reviews",
  "department": "dih",
  "role": "reviews",
  "description": "Houdt nieuwe reviews bij en zet antwoorden klaar",
  "schedule": "Dagelijks 09:00",
  "triggerName": "DIH Reviews",
  "triggerMatch": "exact",
  "planned": false
}
```

| Veld | Uitleg |
| --- | --- |
| `id` | Unieke sleutel. Dezelfde sleutel gebruikt de status-agent in `status.json`. |
| `name` / `shortName` | Naam in het paneel; `shortName` (optioneel) is voor het kleine naambordje op het bureau. |
| `department` | `id` van een afdeling uit `departments`. |
| `role` | Bepaalt het icoon: `planning` (kalender), `ads` (grafiek), `weer` (wolk), `content` (pen), `seo` (vergrootglas), `reviews` (ster), `opvolging` (telefoon), `briefing` (envelop), `realtime` (tandwiel), `taken` (checklist). |
| `description` | Eén zin over wat de agent doet. |
| `schedule` | Schema in gewone taal. "Dagelijks 06:45" wordt in het paneel "elke dag om 06:45". |
| `triggerName` | Naam van de routine in Claude. Hiermee koppelt de status-agent routine en bureau. Meerdere namen kan met `\|` ertussen, bijvoorbeeld `Casoleo inspreek-scripts\|Casoleo scripts`. |
| `triggerMatch` | `exact` (naam moet precies kloppen) of `prefix` (taaknaam begint met `triggerName`, handig voor eenmalige taken met een datum in de naam). |
| `planned` | `true` = nog niet gebouwd. Zolang de agent niet in `status.json` staat, zie je een bureau met "Vacature". |

Na een push naar `main` bouwt GitHub Actions de site opnieuw. Een open tabblad haalt de config elke 5 minuten opnieuw op, dus het nieuwe bureau verschijnt vanzelf.

Afdelingskleuren pas je aan in `departments` (`main`, `accent` en optioneel `accent2`, als `#RRGGBB`).

## Statusformaat (`data/status.json`)

```json
{
  "updatedAt": "2026-11-23T20:00:00+01:00",
  "agents": {
    "dih-instagram": {
      "state": "idle",
      "lastRunAt": "2026-11-23T06:46:05+01:00",
      "lastRunStatus": "succeeded",
      "nextRunAt": "2026-11-24T06:45:00+01:00",
      "summary": "Geen weermoment vandaag, niets ingepland.",
      "approvalsPending": 0,
      "runUrl": "https://claude.ai/..."
    },
    "dih-dashboard": {
      "state": "waiting",
      "summary": "Dashboard ververst. 2 urgente taken voor vandaag.",
      "approvalsPending": 2,
      "todo": ["Lead spouwmuurisolatie: terugbellen (vandaag)", "DIH administratie: offerte afronden (morgen)"]
    }
  }
}
```

- `state`: `working`, `waiting`, `done`, `idle`, `error` of `paused`.
- `lastRunStatus`: `succeeded`, `failed` of `running`.
- `summary`: maximaal twee korte regels.
- `runUrl`: alleen `https://`-links worden getoond.
- `todo` (optioneel): korte lijst taken die vandaag opgepakt moeten worden, getoond in het paneel onder "Vandaag oppakken". Zonder namen of adressen.
- `todoEnc` (optioneel): dezelfde lijst mét namen, versleuteld. Alleen zichtbaar na het invullen van het wachtwoord bij **Toon namen** (zie [`docs/status-agent.md`](docs/status-agent.md)).
- `posts` (optioneel, Instagram-bureaus): komende posts uit Publora als `{ at, state: "scheduled"|"draft", kind: "video"|"carrousel"|"foto", title }`. In het paneel achter de knop **Geplande video's**.
- Ontbreekt een agent, dan toont de app "Vacature" (bij `planned: true`) of "Wacht op volgende run" met "geen data".
- `done` wordt na 15 minuten (gerekend vanaf `lastRunAt`) automatisch als `idle` getoond.
- Is `updatedAt` ouder dan 2 uur, dan kleurt "Status bijgewerkt …" oranje.

**Er komen nooit klantgegevens in `status.json`**: geen namen, adressen, telefoonnummers of e-mailadressen. Alleen de status van agents en korte, algemene samenvattingen. Het bestand staat in een openbare repo.

### Waar de app de status leest

De URL staat in `src/config.ts` (`STATUS_URL`). Gekozen is:

```
https://raw.githubusercontent.com/<gebruiker>/agentenkantoor/main/data/status.json
```

Waarom raw.githubusercontent.com en niet het Pages-pad:

- **Direct na de push beschikbaar.** Via Pages moet na elke statuscommit eerst een complete Actions-build en -deploy draaien (meestal 1 à 2 minuten, soms langer in de wachtrij). Raw serveert het bestand meteen uit de repo.
- **Geen 24 deploys per dag.** De workflow negeert `data/**`, dus statusupdates kosten geen Actions-minuten en vervuilen de deploygeschiedenis niet.
- **Cache.** Raw heeft maximaal 5 minuten CDN-cache; de app hangt een cache-buster (`?t=…`) aan elke aanvraag om die te omzeilen. Pages heeft 10 minuten cache bovenop de deploytijd.

Voorwaarde: de repo is openbaar (raw werkt zonder token alleen voor openbare repo's, en Pages op een privérepo vereist een betaald plan).

Lukt het ophalen niet, dan blijft de laatste stand staan met een melding, en probeert de app het elke minuut opnieuw.

## Deployen naar GitHub Pages

1. Maak op GitHub een **openbare** repo `agentenkantoor` en push deze map naar `main`.
2. Ga in de repo naar **Settings → Pages** en kies bij **Source**: **GitHub Actions**.
3. Vul in `src/config.ts` je GitHub-gebruikersnaam in bij `STATUS_URL` en push.
4. De workflow `.github/workflows/deploy.yml` bouwt en publiceert de site op `https://<gebruiker>.github.io/agentenkantoor/`.
5. Richt de status-agent in volgens [`docs/status-agent.md`](docs/status-agent.md).

## Code-opbouw

```
src/
  config.ts            instellingen (STATUS_URL, verversen, tijdzone)
  time.ts              klok (Europe/Madrid), formattering, schema in gewone taal
  data/                config laden, status ophalen, demo-data, store
  render/              layout, pixel-sprites, kamers/meubels, licht, renderer
  sim/                 state-machine per poppetje, regisseur, postbode, effecten
  ui/                  topbalk, paneel, lijstweergave
```

Alle graphics zijn in code getekend (pixel-arrays en rechthoeken); er worden geen externe afbeeldingen gebruikt. Het pixel-lettertype is [Silkscreen](https://fonts.google.com/specimen/Silkscreen) (SIL Open Font License) via Google Fonts. De animatie draait op maximaal 30 fps en pauzeert als het tabblad verborgen is.
