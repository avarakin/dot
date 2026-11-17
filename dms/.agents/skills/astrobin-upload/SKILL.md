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
- **Fill required fields only.** Leave description, collaborators, locations,
  groups/collections, links, equipment, acquisition sessions and thumbnail
  empty unless the user explicitly supplies them.
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
# required Content choices can be overridden:
scripts/upload.js IMG.JPG "Title" --subject "Solar system" --source traveller
```

Defaults: `--subject "Deep sky"`, `--source backyard` (`backyard` | `traveller`
| `remote` | `external`), `--port 9222`, `--timeout 900000` (ms, upload wait).

The script prints the resulting URL, e.g.
`https://app.astrobin.com/i/pvc55t`, and asserts the page still says "staging
area". It leaves Chrome open on the image page and disconnects without closing
the browser.

## What the flow does

1. `https://app.astrobin.com/uploader` → redirects to `/i/new`.
2. Sets `input#image-file-field` to the file and waits for `UPLOAD COMPLETE`
   (chunked upload; large files take minutes).
3. Fills `#image-title-field`, clicks `#upload-next-button`. The image now
   exists as a draft and the URL becomes `/i/<id>/edit#2`.
4. Content tab (the only tab with required fields): Capture media
   *Photograph*, Subject type, Data source. "My own equipment" opens a side
   drawer that requires a location type: Backyard / Traveller / Remote
   observatory.
5. Equipment, Acquisition, Thumbnail, Settings are all optional; AstroBin
   pre-fills licence ("All rights reserved"), watermark ("<user name>", bottom
   right, small) and hover image from the user's defaults.
6. Clicks the visible Save button, waits for `/i/<id>`, verifies the staging
   banner.

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
