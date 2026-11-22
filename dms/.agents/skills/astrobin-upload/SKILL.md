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
   ```

`start-chrome.sh` explains why the profile has to be copied: Chrome refuses
`--remote-debugging-port` with the default `--user-data-dir`.

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
| `--auto-description` | Built-in web search: looks the object up on Wikipedia (intro, then summary) and DuckDuckGo, and fills a 5–10 sentence description — object type, constellation, distance, discoverer + date, notable facts. Names are derived from the inventory object dir + title, catalogue designations first (`NGC 7635` before `Bubble`). |
| `--description <text>` / `--description-file <path>` | Explicit description; overrides auto. |
| `--setup <name>` / `--no-setup` | Override / skip the "Your setups" apply. |
| `--no-acquisition` | Skip the acquisition CSV import. |
| `--inventory-root <path>` | Inventory root (default `/data/Astro/CCD` or `$ASTRO_INVENTORY_ROOT`). |
| `--object-dir <dir>` `--telescope <name>` | Inventory context for `--resume`. |
| `--dry-run` | Print the derived setup name + acquisition CSV and exit. |
| `--llm-description` | Rephrase the `--auto-description` source text with a headless `pi -p` call. Implies nothing about facts — see below. |
| `--llm-model <pattern>` | Model for the LLM call (default: the configured `pi` model). |

**`--llm-description` is a phrasing layer, never a fact source.** The retrieved
Wikipedia/DuckDuckGo sentences are handed to `pi -p --no-session --no-tools`, asked to
produce 5–10 plain sentences using **only** the supplied source, and the result is
accepted only if a deterministic fact guard passes: every number (digits and spelled-out
numerals, compounds summed), every proper noun, and every designation in the output must
appear in the source; ≤ 10 sentences; no markdown. On any mismatch the guard prints
`llm description rejected by fact guard: …` and the deterministic text is used; if `pi`
is missing or the call fails you get `llm unavailable`. `--dry-run` prints the winning
path (`llm`, `deterministic`, `llm rejected`, `llm unavailable`).

Measured behaviour: with grounding the model omits facts the source lacks (M31 with no
discoverer in the source → no discoverer invented; sparse 2-fact source → 2 sentences).
Asked for a description with the object name *only*, it invents plausible numbers —
for NGC 4002 it fabricated Draco, 110 Mly, mag 12.5, 2.5 arcmin, a "NGC 4002 Group"
(real values: Leo, 310 Mly, S0-a, mag 14.1, 1.1′ × 0.6′, Herschel 10 Apr 1785). That is
why retrieval stays the source of truth and the guard is mandatory.

Requires `pi` on PATH with a working provider key, which breaks this skill's usual
"no API keys" property, so keep the flag opt-in. Latency ~7 s, cost trivial.

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
   `ISO`; or EXIF via `exiv2` for DSLR frames), aggregated by
   date/filter/binning/gain/cooling/ISO (durations within ~2% merge), then imported
   through the Acquisition step's "Import → From CSV" modal. AstroBin's CSV format
   (`date,number,duration,iso,binning,gain,sensorCooling`) omits `filter` because it
   takes a numeric equipment ID, so each row's filter dropdown is set in the UI.
   Skip with `--no-acquisition`.
8. Clicks the visible Save button, waits for `/i/<id>`, verifies the staging banner.

## Pitfalls (already handled — keep them handled)

| Symptom | Cause |
| --- | --- |
| `Node is not a file input element` | `#image-file-field` exists twice: the `astrobin-drag-drop-area` wrapper has the id too. Always select `input#image-file-field`. |
| `Node is either not clickable or not an Element` | `#save-button` exists once per wizard step (5 copies), all but one have a 0×0 rect. Filter by `getBoundingClientRect()` before clicking, and scroll it into view first. |
| Save does nothing / stays on `#6` | The Content tab still has a red "This field is required." under Data source — the equipment card needs the drawer choice (Backyard etc.), not just the card click. |
| Title field empty after typing | Angular needs real key events: focus, select-all, then `page.keyboard.type`, not `element.value = ...`. |
| AstroBin asks to log in | The copied profile's cookies expired. Run `start-chrome.sh --fresh`, or log in inside the automated window. |
| CDP port dead after restart | Chrome refused the port because `--user-data-dir` was the default one. Check `~/.../chrome-automation.log`. |

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
