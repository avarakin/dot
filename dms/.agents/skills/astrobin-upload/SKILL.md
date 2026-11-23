---
name: astrobin-upload
description: >-
  Upload a finished astrophoto to AstroBin as an unlisted staging draft, driving
  the already-logged-in Chrome session over the DevTools protocol. Use when the
  user asks to submit, upload, post, or publish an image (jpg/png/tiff) to
  AstroBin, or to finish/fix an existing AstroBin draft.
---

# astrobin-upload — upload an image to AstroBin as a draft

Drives a real, visible Chrome over CDP (no headless browser, no API keys). The
image is saved **unpublished**: AstroBin keeps new uploads in the user's
staging area, unlisted, until someone clicks **Publish** on the image page.

## Hard rules

- **Never click Publish.** Saving the wizard only leaves a staging draft. If the
  user wants it public, they publish it themselves.
- **Fill required fields only** (plus what the user asks for): description
  (`--auto-description`/`--description-file`), setup, acquisition. Leave
  collaborators, locations, groups/collections, links and thumbnail empty
  unless the user explicitly supplies them.
- **Stop and report** on: login page / 2FA / CAPTCHA, "you have no upload
  entitlement" or quota errors, or any error banner after Save.
- **One driver at a time.** Tell the user not to type or click in the automated
  window while the script runs.

## Prerequisites

1. `puppeteer-core` installed once:
   ```sh
   npm install --prefix ~/.cache/astrobin-upload puppeteer-core
   ```
2. Chrome listening on the CDP port with the user logged in to AstroBin:
   ```sh
   scripts/start-chrome.sh          # reuses a running debug Chrome
   scripts/start-chrome.sh --kill   # stop the user's Chrome first
   scripts/start-chrome.sh --fresh  # re-copy the profile (new login state)
   scripts/chrome-policy.sh         # one-time: enable RemoteDebuggingAllowed via managed policy (sudo)
   ```

`start-chrome.sh` explains why the profile has to be copied: Chrome refuses
`--remote-debugging-port` with the default `--user-data-dir`.

Since Chrome 136 the switch is also gated by the enterprise policy
`RemoteDebuggingAllowed`: with no policy dir, Chrome accepts the flag and
starts no CDP server at all. `chrome-policy.sh` writes
`/etc/opt/chrome/policies/managed/remote_debugging.json` once (needs sudo);
after that the flag works on any profile. Verify with `chrome://policy`.

## Run it

```sh
scripts/upload.js /data/Astro/CCD/135mm/Orion/master/Orion.jpg "Orion"
# auto-fetch a description from the web, setup, and acquisition from the inventory:
scripts/upload.js /data/Astro/CCD/10RC/M33/master/M33.jpg "M33" --auto-description
# same, but let the LLM rephrase the scraped facts into readable prose:
scripts/upload.js /data/Astro/CCD/10RC/M33/master/M33.jpg "M33" --auto-description --llm-description
# explicit description / overrides:
scripts/upload.js IMG.JPG "Title" --description-file desc.txt
scripts/upload.js IMG.JPG "Title" --subject "Solar system" --source backyard
```

Defaults: `--subject "Deep sky"`, `--source traveller` (`backyard` | `traveller`
| `remote` | `hosting` | `public` | `mix`), `--port 9222`, `--timeout 900000` (ms,
upload wait). Setup and acquisition are auto-derived from the inventory and applied
unless disabled.

**Key options**

| Option | Effect |
| --- | --- |
| `--auto-description` | Built-in web search: looks the object up on Wikipedia (intro, then summary), then the **Brave Search API** (when `BRAVE_API_KEY` is set), then DuckDuckGo, and fills a 5–10 sentence description — object type, constellation, distance, discoverer + date, notable facts. Names are derived from the inventory object dir + title, catalogue designations first (`NGC 7635` before `Bubble`). |
| `--no-brave` | Skip Brave even if `BRAVE_API_KEY` is set (Wikipedia + DuckDuckGo only). |
| `--description <text>` / `--description-file <path>` | Explicit description; overrides auto. |
| `--setup <name>` / `--no-setup` | Override / skip the "Your setups" apply. |
| `--no-acquisition` | Skip the acquisition CSV import. |
| `--night-cutoff HH:MM` | Local hour that starts a new imaging night (default `12:00`). Frames before it belong to the previous calendar day. |
| `--csv-filter-column <name>` | Column carrying the filter id in the CSV (default `filter`). |
| `--no-csv-filters` | Omit the filter column; filters are then set row by row in the UI. |
| `--inventory-root <path>` | Inventory root (default `/data/Astro/CCD` or `$ASTRO_INVENTORY_ROOT`). |
| `--object-dir <dir>` `--telescope <name>` | Inventory context for `--resume`. |
| `--dry-run` | Print the derived setup name + acquisition CSV and exit. |
| `--llm-description` | Rephrase the `--auto-description` source text with a headless `pi -p` call. Implies nothing about facts — see below. |
| `--llm-model <pattern>` | Model for the LLM call. Default `llama.cpp/swift-1.5-iq2_xs` (the machine's configured `pi` default); falls back to `$PI_MODEL` when set. |

**`--llm-description` is a phrasing layer, never a fact source.** The retrieved
Wikipedia/Brave/DuckDuckGo sentences are handed to `pi -p --no-session --no-tools`, asked to
produce 5–10 plain sentences using **only** the supplied source, and the result is
accepted only if a deterministic fact guard passes: every number (digits, spelled-out
numerals, and English compounds parsed with multiplier logic — "nine hundred sixty-seven"
= 967), every mid-sentence proper noun, and every designation in the output must appear in
the source; ≤ 10 sentences; no markdown. On any mismatch the guard prints
`llm description rejected by fact guard: …` and the deterministic text is used; if `pi`
is missing or the call fails you get `llm unavailable`. `--dry-run` prints the winning
path (`llm`, `deterministic`, `llm rejected`, `llm unavailable`) and the source URLs used.

The model must be pinned: `pi`'s own default resolves to an OpenRouter free model that
returns `429 free-models-per-day` (limit 50/day), which silently degrades every call to
`llm unavailable`. The default here is `llama.cpp/swift-1.5-iq2_xs` (local `llama.cpp`
server on `:8080`); `~/.pi/agent/settings.json` sets the same pair as pi's global
`defaultProvider`/`defaultModel`. `execFileSync` must pass `stdio: ['ignore','pipe','pipe']`
— pi waits on piped stdin and stalls until the timeout fires.

Measured behaviour: with grounding the model omits facts the source lacks (M31 with no
discoverer in the source → no discoverer invented; sparse 2-fact source → 2 sentences).
Asked for a description with the object name *only*, it invents plausible numbers —
for NGC 4002 it fabricated Draco, 110 Mly, mag 12.5, 2.5 arcmin, a "NGC 4002 Group"
(real values: Leo, 310 Mly, S0-a, mag 14.1, 1.1′ × 0.6′, Herschel 10 Apr 1785). That is
why retrieval stays the source of truth and the guard is mandatory. The guard has true
positives too: on the Bubble Nebula it rejected a sentence naming the "Hubble **Space**
Telescope" that was not in the retrieved source.

Requires `pi` on PATH with a working provider key, which breaks this skill's usual
"no API keys" property, so keep the flag opt-in. Latency 1.5–2.5 s with the local model.

**Brave as a retrieval source.** When `BRAVE_API_KEY` is present, `--auto-description`
queries `https://api.search.brave.com/res/v1/llm/context`, which returns grounding
snippets per source with hostname, age, and URL — structured JSON, so no `result__snippet`
HTML scraping, no User-Agent spoofing, no "…" truncation, and no Wikipedia 429s. Snippet
quality measured on 6 objects was equal or better than the DuckDuckGo scrape (Brave 5–7
results vs DDG 4; more informative snippets on 4 of 6), and end-to-end the fact guard
accepted 6/6 objects with Brave versus 4/6 with DuckDuckGo. Two caveats:

- **Identity filter.** "Bubble Nebula" is NGC 7635 *and* NGC 6822, and Brave returns
  both. Groups whose text mentions a catalogue number outside the candidate set are
  dropped, so grounding never comes from the wrong article.
- **Metered and rate-limited.** The free tier was removed in Feb 2026; the plan is $5 per
  1k requests, and the API enforces 1 request/second (429 beyond that). ~1 request per
  upload.

**Preferred path for descriptions**: `--auto-description` is best-effort and mixes
sources, so for anything important *you* run `web_search`/`source_check` on the object
(e.g. `NGC 6946 type constellation distance discovery`), write 5–10 curated,
source-checked sentences to a file, and pass `--description-file`. Add `--dry-run`
first to see the derived setup, acquisition CSV, and the description that would be
written, then run the upload. Wikipedia is rate-limited, so expect `--auto-description`
to fall back to DuckDuckGo snippets.

The script prints the resulting URL, e.g.
`https://app.astrobin.com/i/pvc55t`, and asserts the page still says "staging
area". It leaves Chrome open on the image page and disconnects without closing
the browser.

## What the flow does

1. `https://app.astrobin.com/uploader` → redirects to `/i/new`.
2. Sets `input#image-file-field` to the file and waits for `UPLOAD COMPLETE`
   (chunked upload; large files take minutes).
3. Fills `#image-title-field`, clicks `#upload-next-button`. The image now exists
   as a draft and the URL becomes `/i/<id>/edit#2`.
4. **Basic information** — fills the description editor (Tiptap/CKEditor/textarea)
   from `--description-file`, `--description`, or `--auto-description`.
5. **Content** tab (the only tab with required fields): Capture media *Photograph*,
   Subject type = **Deep sky**, Data source = **My own equipment** → **Traveller**
   (defaults; overridable with `--subject`/`--source`).
6. **Equipment** — derives the telescope from the inventory path and applies the
   matching saved setup from "Your setups":

   | Inventory telescope directory | AstroBin "Your setups" name |
   | --- | --- |
   | `135mm` | `135mm` |
   | `Esprit100` | `Esprit` |
   | `8RC` | `RC8` |
   | `10RC` | `RC10` |

   Override with `--setup <name>`, skip with `--no-setup`.
7. **Acquisition** — light frames are scanned from the inventory object directory
   (FITS headers: `EXPTIME`, `DATE-OBS`, `FILTER`, `XBINNING`, `GAIN`, `CCD-TEMP`,
   `ISO`; or EXIF via `exiv2` for DSLR frames). Frames are bucketed by **imaging
   night**, not calendar date: with the default `--night-cutoff 12:00`, anything
   captured before noon local counts as the previous night, so a session that
   runs through midnight becomes one row. Within a night, rows group by
   filter/binning/gain/cooling/ISO (durations within ~2% merge). Imported through
   the Acquisition step's "Import → From CSV" modal. Skip with `--no-acquisition`.
8. Clicks the visible Save button, answers the equipment prompt (see below),
   waits for `/i/<id>`, verifies the staging banner.

## Filters travel inside the CSV

The importer accepts a `filter` column holding the **numeric id of a filter page
in AstroBin's equipment database** — the number in `…/equipment/filter/<id>/`, the
same value the wizard writes into a session's `filter2` field. `FILTER_DB_IDS` in
`upload.js` maps the inventory's one-letter filter names to those ids:

| Letter | Filter (id) |
| --- | --- |
| `L` | Baader UV/IR Cut / Luminance 36 mm (`8483`) |
| `B` `G` `R` | Baader B/G/R-CCD **36 mm variants** (`4982` `5000` `5104`) |
| `H` `O` `S` | Scorpio H-alpha / OIII / SII 3 nm 36 mm (`27590` `27591` `27589`) |

Two rules learned the hard way:

- **The header is validated.** An unknown column aborts the import with "The CSV
  header contains unexpected values: …" — `filter2` is *not* accepted, only
  `filter`, even though the saved session field is called `filter2`.
- **Use the variant id for filters that come in sizes.** `709` (Baader Blue) also
  resolves and shows as "Baader Blue (B-CCD)", but the 36 mm variant (`4982`) is
  the one matching the equipment actually used, and it renders as
  "Baader Blue (B-CCD) 36 mm".

After the import the script reads the rows back and only falls back to the
per-row dropdown for rows that still show no filter, printing which rows came
from the CSV.

## Filter equipment: what has to exist for the fallback to work

The per-row filter dropdown only offers filters attached to the image's
equipment, i.e. the filters of the **setup** applied on the Equipment step. If a
row shows "No items found", the setup is missing that filter object (or the
Equipment step holds the wrong setup).

The account's setups (`GET /api/v2/equipment/equipment-preset/`) already cover
every filter the inventory produces, so nothing needs defining:

| Setup (preset id) | Filter ids | Covers |
| --- | --- | --- |
| `RC10` (110155) | 709, 9014, 701, 693, 27590, 27591, 27589 | Baader Blue, Clearglass, Green, Red, H-alpha 3nm, OIII 3nm, SII 3nm |
| `RC8` (106261) | 709, 701, 693, 5127, 8483, 27590, 27591, 27589 | Baader Blue, Green, Red, S-II 8nm, UV/IR Cut-Luminance, H-alpha 3nm, OIII 3nm, SII 3nm |
| `Esprit` (133860) | 709, 9014, 5000, 693, 27590, 27591, 27589 | Baader Blue, Clearglass, Green 36 mm, Red, H-alpha 3nm, OIII 3nm, SII 3nm |

Note: `Esprit` has **no Luminance object**, while the inventory's Esprit objects
(`LBN762`, `vdB158`) log Luminance frames. Its L rows fall back to Clearglass
unless id `8483` (Baader UV/IR Cut / Luminance 36 mm, already used by `RC8`) is
added to that setup first. With the CSV carrying the filter id this matters less:
the id is accepted whatever the setup contains.

The row widget is an `ng-select` with a **virtual-scrolled** option list: only a
few options exist in the DOM at once, so scanning rendered `.ng-option` nodes can
miss a filter that does exist. `selectFilterInRow` therefore types AstroBin's own
catalogue name (`H-alpha`, `OIII`, `SII`, `Luminance`, `Red`, `Green`, `Blue`) into
the select and matches the narrowed list, falling back to a scan when the list is
short. After assignment the script prints every row as AstroBin renders it
(`Acquisition rows as AstroBin shows them`) so a positional slip — rows sharing a
date get re-sorted — is visible rather than silent.

## Pitfalls (already handled — keep them handled)

| Symptom | Cause |
| --- | --- |
| `Node is not a file input element` | `#image-file-field` exists twice: the `astrobin-drag-drop-area` wrapper has the id too. Always select `input#image-file-field`. |
| `Node is either not clickable or not an Element` | `#save-button` exists once per wizard step (5 copies), all but one have a 0×0 rect. Filter by `getBoundingClientRect()` before clicking, and scroll it into view first. |
| Save does nothing / stays on `#6` | The Content tab still has a red "This field is required." under Data source — the equipment card needs the drawer choice (Backyard etc.), not just the card click. |
| Title field empty after typing | Angular needs real key events: focus, select-all, then `page.keyboard.type`, not `element.value = ...`. |
| AstroBin asks to log in | The copied profile's cookies expired. Run `start-chrome.sh --fresh`, or log in inside the automated window. |
| Wizard hangs after the acquisition import | AstroBin asks "Would you like to save this equipment configuration as a setup". Answer **"No, just save the image"** — `saveDraft()` clicks it inside its wait, and `clearOverlays()` handles it anywhere else. Never click *Yes*: it creates a preset and pollutes the last-used list the wizard prefills from. |
| Every click after a failed import does nothing | Leftover modals (CSV form, confirmations) absorb the clicks. `clearOverlays()` runs before each step interaction. |
| "Invalid CSV" though the text looks right | A previous attempt left text in the textarea and the new CSV got appended. Select-all + delete before typing. |
| Filter column shows Bortle values | The row has two `ng-select`s (Filter, Bortle) and their option texts overlap ("Color zone: Blue"). Match against the labelled select and reject options matching `bortle|color zone`. |
| CDP port dead after restart | Chrome refused the port because `--user-data-dir` was the default one. Check `~/.../chrome-automation.log`. |
| Chrome runs, port 9222 never opens | `RemoteDebuggingAllowed` is off (Chrome 136+). Run `scripts/chrome-policy.sh` once, then restart `start-chrome.sh`. |

## Verifying afterwards

Open the printed `/i/<id>` URL: it must show the title, the staging banner and a
**Publish** button. Plate-solving runs in the background for a few minutes and
is harmless.

## Cleanup

The automated Chrome uses a throwaway profile at `/tmp/opencode/chrome-profile`,
so nothing typed there reaches the user's real profile. When done, offer to stop
it and relaunch their normal Chrome:

```sh
pkill -x chrome   # then start Chrome normally, e.g. via the desktop launcher
```
