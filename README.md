# SOP Studio

A local SOP creation app: record a task across tabs in a dedicated Chromium browser, review its instructions and screenshots, then download an illustrated PDF or Word document. The main recording flow does not need an extension.

Also supports **Whole desktop** recording on Windows, across apps and all monitors. The current scope is recording, narration, visual review, SOP editing, and PDF/Word export.

## What is included

- An extension-free Chromium recorder launched from the dashboard, with pause, resume, stop, and multi-tab recording.
- An optional Manifest V3 extension for browsers where extension installation is permitted.
- Clicks, grouped inputs, select changes, page navigation, and tab-switch steps.
- Click coordinates in CSS pixels, including viewport/page position, scroll offsets, viewport dimensions, and device pixel ratio. Available in Captured details and used for eligible screenshot highlights.
- Before and after screenshot slots with capture timestamps and explicit missing-image notices.
- A FastAPI API, SQLite database, and local screenshot files.
- OpenAI instruction cleanup through the Responses API with structured output. Manual editing works without an API key or when OpenAI is unavailable.
- A React dashboard for editing titles and instructions, removing and reordering steps, and verifying each step before export.
- PDF generation with ReportLab and DOCX generation with python-docx.
- A local session token shared by the extension and dashboard. The OpenAI key stays on the backend.

## Run on Windows

The dependencies and production dashboard have already been installed and built in this workspace.

1. Copy `.env.example` to `.env` and optionally set `OPENAI_API_KEY`. The default model is `gpt-4o-mini`; change `OPENAI_MODEL` to another Responses API model that supports structured output if needed.
2. Run `start.cmd`, or run this command from the project root:

   ```powershell
   .venv/Scripts/python.exe -m backend.run
   ```

3. Open **http://127.0.0.1:8000** in your normal browser, or run **`.\open-chromium.cmd`** in another terminal for the project's Chromium browser with automatic Downloads saving. Keep that terminal open while using Chromium. On its first start, the server creates `data/session-token.txt`. Copy that token into the dashboard's connection form. If you set `SOP_TOKEN` yourself, use that instead.
4. Click **New recording** and enter a workflow name. No starting URL is required.
5. Click **Launch Chromium & record**. A new Chromium window opens on a blank tab with recording already active. Use its address bar to visit your website and perform the task; new tabs opened there are recorded too. Your regular browser windows are outside this recording.
6. Return to the dashboard to **Pause recording** or **Resume recording**. Pause before opening anything you do not want captured. The controls remain visible after closing the setup panel.
7. Click **Stop & review** and wait for saving to finish. This closes the dedicated recorder window. Click **Review recording**, optionally choose **Improve all steps**, check both screenshot panels, edit instructions, and click **Save & verify** on each step.
8. Export **PDF** or **Word**. Files use the workflow title with `.pdf` or `.docx`. The project Chromium launcher saves them in your Windows **Downloads** folder; repeated names get `(1)`, `(2)`, etc. Editing a verified step or changing the step order requires review again. Unsaved instruction edits disable exports.

Stop the server with `Ctrl+C`. Recordings persist in `data`. Keep the backend running until saving finishes. Closing the recorder's entire window also attempts to finalize its recording. If the backend or recorder was interrupted, use **Recover saved steps** before starting a new recording. Unsynced steps are kept under `data/recorder/queue` and retried with stable IDs, including after a backend restart.

The recorder uses its own persistent browser profile at `data/recorder/profile`. Sign in to your task's website in this window if needed; this profile does not reuse your regular browser's login. Organization rules and managed-browser sign-in requirements can still apply. The app does not change those policies or load an extension into the dedicated browser.

If **New recording** still shows the old extension-only instructions, restart the backend and refresh the page after building the frontend. Running `playwright open` by itself opens a plain browser, not an SOP recording; use **Launch Chromium & record** in the dashboard.

### Microsoft Edge recording

Set `SOP_BROWSER_CHANNEL=msedge` in `.env` and restart the backend. New recordings then use installed Microsoft Edge; the dashboard shows the selected browser. `chromium` remains the default. Browser recording uses Playwright without a recorder extension. Edge must be installed and allowed by the organization's browser policies; no browser is silently substituted if launch fails.

Run `.\open-edge.cmd` to open the dashboard in Edge with readable filenames saved to Downloads. Recording starts on a blank tab. Edge uses separate project profiles (`data/recorder/profile-msedge` and `data/dashboard-profile-msedge`); your normal Edge profile is not reused.

Changing browsers does not guarantee that CAPTCHA, sign-in checks, or website popups disappear. Complete website sign-in and verification checks yourself during recording. See [Playwright's Edge support and policy limitations](https://playwright.dev/python/docs/browsers#google-chrome--microsoft-edge).

### Download location and UUID filenames

Use `.\open-chromium.cmd` instead of `playwright open` when opening the dashboard in Chromium. Playwright's plain CLI leaves downloads at temporary UUID paths. The project launcher and dedicated recorder preserve completed downloads with their suggested filenames in the Windows Downloads folder (including a folder relocated in Windows). Existing files are never overwritten. The dashboard browser uses `data/dashboard-profile`; you may need to enter the session token again on its first launch. No changes to `node_modules/playwright/cli.js` are needed.

Wait for downloads to finish before closing a browser window. **Stop & review** waits for pending downloads before closing the recorder. The launcher prints each saved file's full path and any save errors in its terminal; the dashboard shows recorder download errors. Normal Chrome/Edge uses its own configured download folder. To override the project browsers' destination, set `SOP_DOWNLOAD_DIR` in the terminal before launching them (or in `.env` for the backend recorder).

### Optional extension mode

Where extensions are permitted, open `chrome://extensions` or `edge://extensions`, enable Developer mode, choose **Load unpacked**, and select `extension`. Open the extension's connection settings, set the backend/dashboard to `http://127.0.0.1:8000`, and enter the session token. Use the extension's own Start, Pause, Resume, and **Stop & sync** controls. This mode saves to the same review dashboard. Extension uploads retry every 30 seconds; browser restart pauses an active extension session.

### Whole desktop mode (Windows)

In **New recording**, choose **Whole desktop**, name your workflow, then click **Start desktop recording**. After a 3-second preparation period, use any Windows apps. A floating panel shows recording status and provides **Pause**, **Resume**, and **Stop & review**. Stopping closes the control panel and leaves your apps open. Return to the dashboard to review, edit, verify, and export the steps as usual.

The recorder captures left/right/middle clicks with physical pixel coordinates, foreground app changes, grouped scrolling, grouped typing activity, and common navigation keys. It records window titles, app names, and the final value of supported editable fields through Windows UI Automation. Repeated typing, backspace/delete, and keyboard paste edits are grouped by field; raw keystrokes and clipboard contents are never read. Password fields are excluded. Unsupported or inaccessible fields receive a placeholder you can fill in during review. Values are limited to 2,000 characters, with longer values explicitly marked as incomplete. Captured text appears in the draft instruction and Captured details; edit the instruction before verification to control what appears in PDF/DOCX exports. Screenshots cover all monitors and can contain whatever is visible, including private information; pause before handling private content. Desktop screenshots are not automatically redacted. Coordinates include the combined desktop origin so monitors positioned to the left or above the primary display work correctly. Large screenshots may be resized for storage.

Before images use a recent cached desktop view; after images are attempted about 700 ms later. Typing and scroll activity group within an 800 ms gap, with an after image once the activity settles. Pausing/stopping immediately disables capture and marks incomplete after images as unavailable. Windows lock screens and protected desktops pause recording. Elevated apps, protected content, remote/disconnected sessions, and organizational controls may limit capture. Run the backend from your own unlocked Windows desktop; no policy or privilege changes are made. Native controls are excluded from screenshots when Windows supports it.

Desktop uploads use the same durable queue and recovery flow as browser recordings, with at most 150 unsynced desktop steps before capture pauses. Only one browser or desktop recording can run at a time. The Windows recorder uses Windows APIs, Python/Tkinter, Pillow, and the Windows-only comtypes dependency from backend/requirements.txt for accessibility text capture.

## Permanently delete a workflow

Use **Delete** on a workflow card or **Delete workflow** in its editor, then confirm **Delete permanently**. This removes the workflow, steps, screenshots, voice narration, vision suggestions, and associated stored files from app storage. There is no recycle bin or undo. Downloaded PDF/DOCX/JSON/HTML copies and shared browser profiles are not removed.

Stop recording and finish syncing/recovery first. Wait for narration and visual review processing to finish before deleting. Older stored run files are also cleaned up when their workflow is deleted; fresh installations do not create run tables. A stale workflow version must be refreshed before deletion. If a file is locked, the workflow record remains so cleanup can be retried; some files may already have been removed. Cleanup validates owned paths and rejects linked directories. It never searches your Downloads folder for files to remove.

## Vision-assisted capture and SOP review

New browser recordings capture up to eight CSS selectors for each target, together with its name, role, bounding box and viewport. The recorder retains a selector only when it uniquely matches that exact element in the live DOM. Test IDs, stable IDs and meaningful attributes are preferred; structural paths are a last resort. This capture works in Edge, Chromium and the optional extension without calling OpenAI. Private fields omit target metadata. Existing recordings need to be recorded again to gain this evidence.

After stopping a recording, expand **Vision assistance** under a step and choose **Analyze screenshots with OpenAI**. If you edited the current instruction, use **Save draft & analyze with OpenAI** to save it as an unverified draft and analyze it in one action. Save edits to other steps or SOP details first; disabled controls explain what is blocking analysis. While analysis runs, other workflow actions are locked to avoid conflicting updates, and they unlock after success or failure. This explicitly sends the available step screenshots, adjacent screenshot context, and recorded metadata to OpenAI. Images are resized for analysis; browser masks are best-effort and visible personal information can remain. Private steps are excluded. Non-private browser and desktop steps are supported. **Improve all steps** remains text-only.

Review the suggested instruction, visual observation, warning and selector. The model can only select a candidate captured from the DOM; unsupported candidate indices are rejected, and only high-confidence selector suggestions are offered. Lower-confidence reviews can still suggest wording. **Apply selected suggestions** changes only the fields you select, marks the step unverified, and increments the workflow version. Analysis itself preserves current instructions and selectors. An analysis becomes unusable if its underlying instruction or selector changes. API failures leave the workflow unchanged.

Use **Save & verify** after reviewing the result. Captured selectors identify the recorded control and help interpret the screenshots. Vision cannot recover stripped URL query parameters, prove task success, bypass CAPTCHA, or repair old selectors without DOM evidence. Older screenshots can still assist SOP wording.

The backend uses the [OpenAI Responses API with image inputs](https://developers.openai.com/api/docs/guides/images-vision) and structured output. The example configuration uses `OPENAI_VISION_MODEL=gpt-5.4` for screenshot review and missing-text recovery. Set `OPENAI_VISION_MODEL` to override it; when blank, the existing `OPENAI_MODEL` is used and must support images and structured output. Restart the backend after changing model settings. No images are sent automatically while recording. Suggestions and their provenance are stored in the step payload in SQLite; all analysis/application endpoints require the existing session token and workflow version.

## Fresh installation

Install Python 3.12+ (or [uv](https://docs.astral.sh/uv/)) and Node.js 22+ first. From the repository root:

```powershell
uv venv --python 3.12 .venv
uv pip install --python .venv/Scripts/python.exe -r backend/requirements.txt
Copy-Item .env.example .env
cd frontend
npm.cmd ci
npx.cmd playwright install chromium
npm.cmd run build
cd ..
.venv/Scripts/python.exe -m backend.run
```

Without uv, use `py -3.12 -m venv .venv` followed by `.venv/Scripts/python.exe -m pip install -r backend/requirements.txt`.

For frontend development, keep the backend running and run `npm.cmd run dev` inside `frontend`. Visit **http://127.0.0.1:5173** and change only the extension's dashboard URL to that address. Vite proxies API requests to port 8000. Restart the backend after the first production build so it mounts the dashboard files.

## Capture behavior and Phase 1 limits

The recorder observes actions; it does not block, delay, or modify the task's clicks to stage exact screenshots.

- **Before:** the latest available screenshot of that tab, captured before the event and within 45 seconds. Hovering over a control, focusing a field, scrolling, and finishing a previous action update the screenshot cache. The first page entry usually has no before image. A field edit keeps the earlier image from when typing began.
- **After:** capture is attempted about 650–700 ms after the event. Rapid actions may overlap. If the tab is hidden, closes, navigates during capture, or the recorder misses its capture window, a notice is saved instead of an unrelated screenshot. Long-loading pages may need manual verification. Extension mode additionally respects Chrome's global screenshot rate limit.
- **Input grouping:** typing is grouped until an 800 ms pause, blur, another action, page exit, or recording stop. A longer pause can create a second input step. Only user-generated events are recorded.
- **Coordinates:** both recorders save pointer-click X/Y relative to the top-left of the page viewport, plus page X/Y, scroll X/Y, viewport width/height, and device pixel ratio at click time. Values use CSS pixels, including when browser zoom or display scaling is active. Keyboard-triggered clicks, non-click actions, and older recordings have no coordinates. Screenshots can come from a different moment; coordinates describe the click itself and are shown as text, without drawing markers on those screenshots.
- **Multiple tabs:** normal HTTP(S) tabs within the dedicated Chromium window are eligible during recording, excluding the backend and dashboard. Extension mode instead observes eligible tabs in the browser where the extension is installed. A shared sequence tracks incoming events; stopping the recording orders steps by their event timestamps so a delayed input batch stays in the right place. Each step retains its tab ID, page URL, title, selector, and event timestamp. Screenshots capture the visible viewport only.
- **Durability:** uploads use stable event IDs, so retries cannot duplicate steps. Screenshot processing continues while uploads are unavailable. Up to 300 unsynced steps are retained before recording pauses. Keep the recorder's local files (or extension storage) until syncing is complete. A tab crash can lose text still within the input debounce window; steps already delivered to the recorder are written locally before upload. Interrupted captures retain a missing-image notice instead of taking a later, unrelated screenshot during recovery.
- **Privacy:** password and common credential/payment fields are excluded from recorded values and covered during screenshots. URL queries, fragments, and embedded credentials are removed from metadata. Pages can mark additional content with `data-private` or `data-sop-private`. Frames are covered and actions inside frames are outside this MVP; shadow-root controls are also outside the capture scope. Other page content, field values, URL paths, and titles may contain private information; review captures before export or OpenAI cleanup. These masks are best effort, not a general-purpose redaction engine.
- **OpenAI:** only instruction metadata is sent when you click **Improve all steps**. Screenshots stay local for text cleanup; the separate **Analyze screenshots with OpenAI** action sends that step's images and DOM target metadata for visual review. Cleanup skips manually edited and verified steps. Provider failure leaves every existing instruction intact, and a concurrent edit prevents the cleanup from overwriting newer work.
- **OpenAI connection errors:** the backend uses system trusted certificates (including Windows certificate stores) with HTTPS verification enabled. If an approved corporate CA is supplied as a PEM bundle, set `SSL_CERT_FILE` to its path before starting the backend. Cleanup errors distinguish certificate, network, key, billing, rate-limit, and timeout problems without exposing credentials or altering steps.
- **Local MVP:** one local user/session token and one active dedicated Chromium recorder per backend; no cloud sync, team permissions, extension-store release, or background-tab screenshots. Run a single backend worker bound to loopback as provided. Node.js, frontend npm dependencies, and Playwright Chromium must be installed for dedicated recording.

## Project layout

```text
backend/
  app/          API, SQLite storage, OpenAI cleaner, and document exporters
  desktop/      Local and remote Windows recording, control names, and typed text
  tests/        Auth, persistence, review, fallback, and export checks
extension/      Optional extension for browsers that permit it
frontend/
  recorder/     Playwright process, event observer, and durable upload queue
  src/          React dashboard and styles
  tests/        Browser tests for review/export and the real recorder
data/           Database, token, screenshots, and private recorder profile (ignored)
```

The API documentation is available at `http://127.0.0.1:8000/docs`. API routes require `Authorization: Bearer <session token>`; screenshot and export downloads also require it. `/health` is public.

## Validation

```powershell
.venv/Scripts/python.exe -m pytest backend/tests -q
node --test extension/tests/*.test.js
node --test frontend/recorder/downloads.test.mjs
cd frontend
npm.cmd run build
# If Chromium isn't installed for Playwright yet:
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Browser tests use an isolated backend on port 8765, fixture sites on ports 8766 and 8767, and separate Chromium profiles. Test recordings go into `test-results/e2e-data`; they do not enter the real local workspace. Tests set `SOP_RECORDER_HEADLESS=1` on their isolated backend to exercise the dashboard launcher without visible windows. OpenAI calls are mocked in backend tests; the browser fallback test runs without an API key.

## Implementation references

- [Playwright browser contexts and page event bindings](https://playwright.dev/docs/api/class-browsercontext)
- [Playwright page screenshots and masking](https://playwright.dev/docs/api/class-page#page-screenshot)
- [Chrome tabs API and screenshot limits](https://developer.chrome.com/docs/extensions/reference/api/tabs)
- [Manifest V3 service-worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [OpenAI structured outputs with the Responses API](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)
- [python-docx documentation](https://python-docx.readthedocs.io/en/latest/)


Contextual vision review also supports non-private desktop steps. It sends the selected step screenshots, one available screenshot from each immediate non-private neighbor (preferring after, with before as fallback), and up to ten surrounding steps on each side to OpenAI. Missing or unreadable images are skipped. If only adjacent screenshots remain, suggestions are marked as low-confidence context-only wording, with no selector or missing-input recovery. If no usable screenshots remain, use text-only improvement or manual editing. Private step metadata/images are omitted. The review shows likely intent (an inference), evidence, and SOP review notes. For missing or truncated input, it can propose exact text supported by the evidence. Edit **Recovered or corrected text** and explicitly confirm it before applying; an unknown value must be supplied manually. Confirmation updates the stored input value and SOP wording, preserves the original capture in an audit field, and clears verification. Review missing input and unclear controls before verifying the SOP. The recorder's capture mechanism stays the same. Context changes invalidate pending suggestions.


### Record inside an RDP session

Open recording setup and expand **Record inside Remote Desktop (RDP)** to download the standalone remote recorder. Run it inside the remote Windows session. See [remote recorder setup and connection guide](remote-recorder/README.md). Captured steps include their source machine and available UI Automation IDs, names and types. The dashboard can review, visually analyze and export these workflows. No backend port or firewall exposure is enabled automatically.


Before-action screenshots in review and PDF/DOCX exports show a green outline around the recorded click/input target when bounds are available. Old coordinate-only clicks use a small green box around the recorded point. Browser bounds scale with viewport size; new desktop/remote-agent recordings include UI Automation bounds and screenshot desktop geometry. After-action screenshots stay unmarked because navigation and layout changes can invalidate old positions. Private steps, missing bounds, different page URLs or conflicting screenshot geometry are not highlighted. Original images remain unchanged for vision analysis and raw screenshot access. Update the remote recorder ZIP on the remote machine to capture desktop input bounds.


SOPs have editable **Purpose** (why the procedure exists and its intended outcome), **Scope** (who/systems it covers, start/end boundaries and exclusions), and **Prerequisites** (required access, software, files, and setup before starting). Edit these above the recorded steps and choose **Save SOP details**. Filled sections appear before Step 1 in both PDF and Word exports. Empty fields are omitted from exports; existing workflows gain empty fields without losing their content.


PDF and Word exports use A4 pages with a new page for each step. The SOP title is centered, bold and blue. Each step contains its instruction and before/after screenshots; simple captions include the step number and stay with their screenshots. Per-step purpose, expected results, validation, notes, application metadata, coordinates and capture timestamps are omitted from exports. Images retain their proportions and fit inside page margins; tall screenshots receive more page space and may continue onto a separate page. Missing images are explicitly labeled. Green target highlights remain visible on eligible before screenshots.


Use **Improve this step** beside an instruction to refine just that step with OpenAI, or **Improve all steps** in the review panel for the workflow. Bulk improvement preserves edited and verified steps unless **Include edited and verified steps** is selected. Save pending edits before improving. Results are unverified drafts; selectors, recorded input values, screenshots and step order stay intact. If OpenAI fails, instructions are preserved. These options use captured text; screenshot-based suggestions remain available under **Vision assistance**.


### Voice-assisted recording

In **New recording**, enable **Record voice narration** and allow microphone access. This works with the dashboard-launched browser and whole-desktop recorders. Open the dashboard in Edge/Chrome on localhost or HTTPS. Narrate the current action, perform it, then say **Next step** as a separate phrase. Click **Stop & review** after the final step; no final spoken boundary is needed. Keep the dashboard tab open throughout recording. The microphone is captured on the dashboard computer, not by the standalone remote recorder ZIP.

The microphone starts muted while the recorder opens, becomes active during recording, and is muted during pauses. Its visible control can also mute it independently. Audio may contain private information: mute before speaking secrets. Audio is backed up in browser IndexedDB in roughly five-second chunks, then saved under `data/narration/<workflow-id>.webm` after the screen recorder stops. If saving fails, **Retry saving narration** retains the local backup; it can also be downloaded or deliberately discarded. Audio upload is limited to 24 MB. Closing the dashboard can interrupt recording; previously backed-up chunks can be recovered when it reopens.

After saving, OpenAI `whisper-1` produces a word-timestamped transcript. Spoken boundaries are detected after recording, not in real time. Timestamp ranges align narration with captured actions; a click plus typing may belong to one narrated step. Exact timing and transcription can be imperfect, so review the transcript and action assignment. Reserved boundary words are omitted from SOP text. Merely saying the phrase as part of a button name is not intended as a boundary.

The configured vision model (`OPENAI_VISION_MODEL`, or `OPENAI_MODEL` as fallback) compares the narration with captured actions and bounded before/after screenshot evidence. The **Voice narration** panel shows **Matched**, **Mismatch**, or **Needs review**, editable transcripts, action assignments, and suggested instructions with purpose, expected result, validation and notes. Private-action groups are excluded from this comparison. Missing or uncertain evidence is flagged. A matched action does not establish that the application successfully completed its task.

Check the evidence and explicitly select **Use reviewed suggestions** to update SOP text. Captured input values, selectors and screenshots stay intact. Accepted details remain available in dashboard review; exports contain the step instruction and screenshots. Accepted narration supplies context to **Improve this step**, **Improve all steps**, and Vision assistance. Updated instructions remain unverified until you verify them. OpenAI failures preserve audio and completed transcript segments for retry. Workflow deletion also removes its saved audio. Raw audio/transcripts are not appended to exported SOPs.

### Improve the entire SOP with Vision

After stopping a recording and saving edits, choose **Improve entire SOP with Vision** above the SOP details. It uses `OPENAI_VISION_MODEL` (falling back to `OPENAI_MODEL`) to review all available non-private before/after screenshots in order, in batches of five recorded steps. Each batch includes captured actions, target metadata, exact recorded input, accepted narration, nearby upcoming actions, and a cumulative summary of the preceding visual review. A final synthesis drafts the overview, purpose, scope and prerequisites. It uses the [OpenAI Responses image-input API](https://developers.openai.com/api/docs/guides/images-vision); screenshots are sent to OpenAI and may contain visible personal information.

The panel displays progress and saves completed batches in SQLite. You can leave the page and return while analysis runs. Failed or interrupted analysis can resume with **Retry remaining analysis** if the workflow and configured model have not changed. Missing screenshots are identified; private steps and their evidence are omitted. Unknown or truncated inputs keep their existing instruction and are flagged for manual review. No original instruction, selector, coordinate, input value, screenshot or ordering is changed during analysis.

Expand the proposed sections and steps to compare current and suggested wording. Choose **Apply all suggestions**, **Apply selected changes**, or **Apply only step N**. Supported step explanations, expected results, validation checks and notes remain available in the dashboard after application. PDF/Word exports show only the instruction and screenshots for each step, with overview, purpose, scope and prerequisites at the beginning. Applied instructions become unverified drafts. Review them before exporting. Whole-SOP review preserves captured targets and values; missing text must be supplied and confirmed separately. Edits from another tab invalidate pending suggestions, and deletion waits until analysis finishes. Starting a fresh analysis replaces the previous pending review.


### Combine repeated desktop typing

When desktop recording stops, consecutive complete input snapshots from the same uninterrupted field session combine into one SOP step. A pause between typing "one" and "one connect" keeps the final captured value "one connect". Corrections, deletion to an empty value, and duplicate snapshots use the latest value; strings are never concatenated. No OpenAI request is needed for merging.

New recordings save an opaque typing-session ID and Windows accessibility field identity. A click, key action (including Enter or Tab), scroll, window switch, pause, or observed focus loss ends that session. Different windows, fields, remote hosts, private inputs, truncated values, and uncertain targets stay separate. The recorder still saves and syncs intermediate snapshots for recovery; merging happens after Stop & review. Remote recording uses the same engine: download a fresh recorder ZIP to capture these identifiers.

For older captures, select consecutive desktop typing steps in the editor. **Combine repeated typing** previews the final captured text; confirm that the selection represents one field and typing action, then choose **Merge selected typing steps**. The backend rejects known field conflicts and intervening actions. Save pending edits before merging. Merged instructions are drafts that require verification, and narration assignments are updated with their old comparisons cleared. Inputs assigned to different narration segments cannot be merged.

Each merged step has **Undo merge**. Confirm **Restore original steps** to recover the original instructions, values, IDs, and screenshots in place. Changes to the combined instruction are discarded; restored steps need verification. Original captures remain in local storage until the merged step or workflow is permanently deleted. Undo a merged step before including its originals in another merge. Existing recordings are not modified merely by restarting the app.


### Describe the workflow before recording

In **New recording**, optionally fill **Describe the workflow you're recording** (up to 2,000 characters). For example: "Raise a ticket for Claude access in One Connect, from opening the portal to receiving a ticket number." The same field works for dashboard-launched browser and whole-desktop recordings. Leaving it blank keeps the existing recording flow.

This description is saved as `recording_context`, separate from the generated SOP overview. After stopping, edit it under **Workflow context** and choose **Save SOP details**. **Improve this step**, **Improve all steps**, per-step Vision and whole-SOP Vision include this context when you request improvement. The description is sent to OpenAI with the relevant evidence; saving or recording alone does not trigger an AI request. Context describes intent, while captured actions and screenshots establish what happened. Prompts instruct the model to write clear procedural instructions, preserve captured facts, and flag gaps instead of inventing actions or claiming completion. Review generated wording before exporting.

Applying suggestions preserves the original context. Changing it invalidates pending Vision suggestions. Raw workflow context is not added as another section in PDF/Word; the reviewed overview, purpose, scope, prerequisites and step instructions remain the exported content. Existing workflows gain an empty context field automatically on backend restart.
