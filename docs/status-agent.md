# Status-agent

De status-agent is een geplande Claude-taak die **elk uur** de stand van alle andere geplande taken opvraagt en die wegschrijft in `data/status.json` in deze repo. Het Agentenkantoor leest dat bestand; de app zelf schrijft niets.

## Inrichten

Richt dit in als geplande taak in **Claude Code (desktop-app)**, want die heeft de tools om geplande taken en hun runs op te vragen (`list_scheduled_tasks` en `list_task_runs`) en kan git gebruiken.

1. Clone de repo lokaal, bijvoorbeeld naar `~/agentenkantoor`, en zorg dat `git push` naar GitHub werkt (inloggen via `gh auth login` of een SSH-sleutel).
2. Maak in Claude Code een nieuwe geplande taak:
   - **Naam:** `Agentenkantoor – Status`
   - **Map:** de lokale clone (`~/agentenkantoor`)
   - **Schema:** elk uur, op minuut 0 (cron `0 * * * *`)
   - **Prompt:** de tekst onder "Prompt" hieronder, letterlijk.
3. Sta de taak toe om `git` uit te voeren in die map, zodat hij niet blijft hangen op een toestemmingsvraag.
4. Laat de taak één keer handmatig draaien ("Run now") en controleer `data/status.json` op GitHub.

De Mac moet aan staan (en niet slapen) om de taak te laten draaien. Staat hij een tijd uit, dan kleurt "Status bijgewerkt …" in het kantoor na 2 uur oranje.

> Draaien je agents als cloud-routines in plaats van lokale geplande taken, gebruik dan dezelfde prompt in een routine met deze repo gekoppeld, en vervang stap 1 van de prompt door de tool waarmee je routines en hun runs opvraagt. De rest (koppelen, afleiden, schrijven, pushen) blijft gelijk.

## Prompt

```text
Je bent de status-agent van het Agentenkantoor. Je werkt in de lokale clone van de repo
"agentenkantoor". Doel: data/status.json bijwerken met de actuele stand van alle agents.
Werk stil en snel; stel geen vragen.

STAP 0 – Repo bijwerken
- Voer uit: git pull --rebase --autostash
- Lees public/agents.config.json. Elke agent heeft: id, triggerName, triggerMatch
  ("exact" of "prefix") en planned.

STAP 1 – Geplande taken opvragen
- Roep list_scheduled_tasks aan. Noteer per taak: taskId, title (naam), enabled,
  nextRunAt, lastRunAt en het veld waiting (als dat er is).
- Roep voor elke taak die aan een agent gekoppeld wordt (stap 2) list_task_runs aan met
  limit 3. Noteer van de nieuwste run: status (running / succeeded / failed),
  started_at, last_activity_at, summary en session_id.
- Sla jezelf ("Agentenkantoor – Status") over.

STAP 2 – Taken koppelen aan agents via triggerName
- Vergelijk zonder hoofdlettergevoeligheid, met witruimte samengevoegd, en behandel
  "–", "—" en "-" als hetzelfde teken.
- triggerMatch "exact": de taaknaam moet gelijk zijn aan triggerName.
- triggerMatch "prefix": de taaknaam moet beginnen met triggerName. Meerdere taken
  kunnen dan bij één agent horen.
- Een agent zonder gekoppelde taak laat je helemaal weg uit status.json
  (de app toont dan zelf "Vacature" of "geen data").

STAP 3 – State afleiden (per agent; de eerste regel die klopt, wint)
1. paused  – alle gekoppelde taken staan uit (enabled = false).
2. working – een run heeft status "running".
3. error   – de nieuwste afgeronde run heeft status "failed".
4. waiting – de taak wacht op Kelvin: het veld waiting noemt een toestemming,
             goedkeuring of invoer van de gebruiker, OF de samenvatting van de nieuwste
             run zegt dat er iets klaarstaat dat Kelvin moet goedkeuren, beantwoorden of
             doen. Tel zulke openstaande punten als approvalsPending (minimaal 1).
5. done    – de nieuwste run is "succeeded" en eindigde (last_activity_at) minder dan
             15 minuten geleden.
6. idle    – al het andere.
Bij meerdere taken (prefix): gebruik de nieuwste run over alle taken heen, en als
nextRunAt de eerstvolgende toekomstige nextRunAt van de taken die aan staan.

STAP 4 – Velden per agent
- state:            uit stap 3
- lastRunAt:        started_at van de nieuwste run (ISO 8601 met tijdzone), anders
                    lastRunAt van de taak; weglaten als onbekend
- lastRunStatus:    "succeeded", "failed" of "running"
- nextRunAt:        nextRunAt van de taak (ISO 8601); weglaten bij paused of eenmalige
                    taken zonder volgende run
- summary:          maximaal twee korte regels (± 160 tekens) in het Nederlands, op basis
                    van de run-samenvatting. Bij error: kort wat er misging.
- approvalsPending: getal, 0 als er niets openstaat
- runUrl:           alleen als er een https-link naar de run bestaat (bijvoorbeeld
                    https://claude.ai/code/...); anders weglaten. Verzin geen links.

PRIVACY – verplicht
status.json staat in een OPENBARE repo. Zet er NOOIT klantgegevens in: geen namen
van personen, geen adressen, postcodes, telefoonnummers, e-mailadressen, bedrijfsnamen
van klanten of offertebedragen per klant. Schrijf alleen algemene tellingen en
statussen ("3 leads opgevolgd", "2 reviews beantwoord"). Twijfel je, laat het weg.
Controleer de summaries vlak voor het schrijven nog één keer hierop.

STAP 5 – Schrijven
- Schrijf data/status.json in precies dit formaat (2 spaties inspringing, UTF-8):
  {
    "updatedAt": "<nu, ISO 8601 met tijdzone Europe/Madrid>",
    "agents": {
      "<agent-id>": { "state": "...", "lastRunAt": "...", "lastRunStatus": "...",
                      "nextRunAt": "...", "summary": "...", "approvalsPending": 0,
                      "runUrl": "..." }
    }
  }
- Gebruik als sleutels de id's uit public/agents.config.json.
- Controleer dat het bestand geldige JSON is door het opnieuw te lezen.
- Schrijf ALLEEN data/status.json; wijzig geen andere bestanden.

STAP 6 – Commit en push
- git add data/status.json
- git commit -m "status: <HH:MM>"   (tijd in Europe/Madrid)
- git push
- Mislukt de push door een conflict: git pull --rebase, schrijf status.json opnieuw
  volgens stap 5 en push nog één keer. Mislukt het daarna nog, stop dan en meld kort
  waarom.

Sluit af met één regel: hoeveel agents working / waiting / error zijn.
```

## Controleren

- Na een run staat er een commit `status: HH:MM` op `main` met alleen `data/status.json` gewijzigd.
- Die commit start **geen** nieuwe Pages-build (de workflow negeert `data/**`).
- Binnen een minuut (of maximaal ~5 minuten door de CDN-cache van raw.githubusercontent.com) ziet het kantoor de nieuwe stand.
- Kloppen de koppelingen niet, vergelijk dan de taaknamen in Claude met `triggerName` in `public/agents.config.json`.
