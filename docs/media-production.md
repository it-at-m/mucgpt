# Media production guide: screenshots & videos

How to reproduce the documentation screenshot and video sets for MUCGPT —
the setup used for the 2.1 documentation refresh (2560×1440 stills, short
silent MP4 clips). The tooling is plain Playwright driving a local stack;
nothing is tied to that session.

## 0. Tooling

- [Playwright](https://playwright.dev) (`playwright-core` is enough for
  screenshots; the full package for videos, which bundles an ffmpeg binary),
  driving the **system Chrome** (`executablePath: /usr/bin/google-chrome`).
- ffmpeg for webm→mp4 conversion: not on the host — run it in a container
  (`podman run --rm -v "$PWD:/vid:Z" alpine sh -c "apk add -q ffmpeg && …"`).
- A scratch workspace outside the repo (e.g. `/tmp/opencode/media-tools`)
  with `npm i playwright playwright-core` and subfolders `profile/`
  (persistent browser login), `shots/{de,en}/`, `videos/{de,en}/`, `files/`
  (sample uploads), `prompt_pool/` (see below).

## 1. Stack setup

Bring up the local stack (`stack/`, `podman compose up -d --build`) with:

- **A working LLM provider.** If the configured provider is overloaded
  (Privatemode responded `529` during the 2.1 session), reorder `models[]`
  so a healthy provider is first — the **first model is the default model**
  for chat, internal tasks and compliance checks.
- **Provider capability flags** for strict OpenAI-compatible APIs
  (Mistral rejects unknown request fields; see `model_info` in
  `docs/GETTING_STARTED.md`): `supports_temperature: false`,
  `supports_user_param: false`, `supports_store_param: false`.
- **Tool approval demo**: one MCP source with
  `require_approval: true` + `data_classification` (e.g. the local
  `ki-muenchen` doc-search source) — that's what produces the approval card.
- `transcription_enabled: true` (mic button in the composer),
  `parser_backend: "xberg"` (document uploads).
- **LDAP off** (`ldap.enabled: false`) unless the corporate directory is
  reachable — otherwise the department picker shows a load error; take the
  share screenshot with "Öffentlich sichtbar" selected instead.
- Compliance screening: needs all `compliance_prompts/*` files (and every
  other prompt-pool entry) — if the pool is empty, the check fails with
  "Prompt configuration missing". Either host the prompts in Langfuse,
  mount a local pool into the core container (compose override, see below),
  or set `ai_act_compliance_check_enabled: false` for shots without the
  screening UI.

### Local prompt pool

The prompt pool lives in Langfuse in production; the repo carries no
fallback files. For a local stack, recover the last committed versions from
git history and mount them:

```bash
PP=mucgpt-core-service/app/agent/prompt_pool
git show '<ref>':"$PP/default_instructions.md" > pool/defaults/default_instructions.md
# generation_prompts/{chat_title,assistant_name,assistant_description,assistant_systemprompt}.md
# compliance_prompts/{education,hr_employment,migration_asylum_border,public_services_access}.md
```

Mount via an **untracked** `stack/docker-compose.override.yml` (compose
auto-loads it):

```yaml
services:
  core-service:
    volumes:
      - /path/to/pool:/app/agent/prompt_pool:ro,Z
```

### Demo identity

The Keycloak demo users greet by first name. Set German placeholder names
(via Keycloak admin API on `:8100`, admin/admin — `firstName`/`lastName` of
`demo-user` → "Max", `demo-admin` → "Erika"), then revoke their sessions so
the next login picks the names up. Revisit `stack/keycloak/migration/04_add-users.yml`
if the rename should survive realm recreation.

## 2. The studio

One persistent browser context gives login, theme and language state:

```js
// studio.js
const { chromium } = require('playwright-core');
async function open() {
  const browser = await chromium.launchPersistentContext('/path/to/profile', {
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox'],
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1.6,          // → 2560×1440 PNGs, matches the docs set
  });
  const page = browser.pages()[0] || await browser.newPage();
  await page.goto('http://localhost:8083/', { waitUntil: 'networkidle' });
  if (page.url().includes('keycloak')) {           // scripted Keycloak login
    await page.fill('#username', 'demo-user');
    await page.fill('#password', 'mucgpt');
    await page.click('button[type=submit]');
    await page.waitForTimeout(4000);
  }
  const accept = page.locator('button:has-text("Zustimmen")');
  if (await accept.count()) { await accept.click(); await page.waitForTimeout(1200); }
  return { browser, page };
}
```

Headless captures have no browser chrome — the app fills the full frame.
**Every screenshot uses the same context** so language/theme persist;
switch language/theme through the in-app settings menu (⚙️ → Sprache/
Design), not by touching localStorage.

Cleanup helpers (run in the page, they carry the authenticated session):

- Delete conversations: `fetch('/api/backend/v1/conversations')` then
  `DELETE` each with header **`X-XSRF-TOKEN`** from the `XSRF-TOKEN` cookie
  (mutations without it get a 403).
- Garbage conversation titles ("type thinking thinking type") come from
  title generation with a **thinking model** — delete those conversations
  before shooting anything with the sidebar visible.

## 3. Shot list (per docs/FEATURES.md)

All shots in the logged-in context; wait for streams to finish before
capturing (poll `document.body.innerText` length / composer state).

| File | Flow |
| --- | --- |
| `startpage.png` | Start page (recommendations come from subscribed/community assistants — own assistants only appear after being opened once) |
| `chatscreen.png` | New chat → rich prompt ("Erkläre das Ummeldeverfahren …") → wait for the full answer |
| `canvas.png` | "Neuer Chat mit Canvas" → "Schreibe einen kurzen Merktext … direkt ins Canvas" → wait for canvas content **and** the run to finish |
| `chat_documents.png` | "Dokument hochladen" → dialog → `input[type=file]` → set sample file → check its checkbox |
| `tool_approval.png` | Enable the `require_approval` tool → prompt that triggers it → wait for "MUCGPT möchte <tool> verwenden" → capture the card; click "Nicht senden" afterwards |
| `assistant_creator.png` | Create-assistant → "Manuell erstellen" → fill title/description/prompt → creativity radio → (compliance check + checkbox if enabled) → scroll to top |
| `share_assistants.png` | Edit an assistant → hash `#visibility-settings` (scrolls & expands) → select visibility |
| `models.png` / `tools.png` | Open the model / tool selector on a chat page |
| `tutorials.png` | `/#/tutorials` |
| `discovery.png` | `/#/discovery` |
| `darkmode_i18n.png` | Switch theme to dark (settings menu open in frame = shows the i18n toggle) |

## 4. Video pass

Record per flow in a context created **with** `recordVideo: { dir, size: {1600×900} }`
(the same profile keeps the session); close the context to finalize the
webm. Four clips: chat streaming, canvas writing, tool approval
(card → "Senden" → tool runs → answer), document upload. Convert and trim
the page-load lead-in:

```bash
podman run --rm -v "$PWD:/vid:Z" alpine sh -c "
  apk add -q ffmpeg
  ffmpeg -y -i /vid/in.webm -ss 10 -c:v libx264 -preset veryfast -crf 26 \
    -pix_fmt yuv420p -movflags +faststart -an /vid/out.mp4"
```

Strip audio (`-an`) — the clips are silent screen recordings. Spot-verify
by extracting frames (`ffmpeg -i out.mp4 -vf "select=eq(n\,200)" -vsync vfr f.jpg`).

## 5. Distribution

| Target | Language | Files |
| --- | --- | --- |
| this repo, `docs/` | English | the FEATURES.md names; new sections get new files (`canvas.png`, `chat_documents.png`, `tool_approval.png`) |
| `it-at-m/ki.muenchen.de`, `public/img/mucgpt/` | German | same names; videos into `public/img/mucgpt/videos/`, embedded with `<video src=… controls muted loop>` in `ki-systeme/mucgpt.md` |
| `it-at-m/opensource.muenchen.de`, `public/inhouse/` | English | prefixed names (`mucgpt_*.png`) |

External updates ride the `docs/mucgpt-<version>` draft PRs (see the
feature documentation checklist in `CONTRIBUTING.md`) and merge only when
the feature may be communicated publicly.

## 6. Session gotchas

- Provider quirks surface as UI errors: check `podman logs core-service`
  for `Provider error details` — the body names the rejected field.
- Failed compliance checks are **cached** under
  `mucgpt:assistant-compliance:v1:<hash>` (Redis/Valkey) — flush the key
  (or tweak the prompt) after fixing the underlying model problem, else the
  error result keeps being served.
- Mistral/thinking models: reasoning models return thinking content blocks
  that break strict string-JSON parsing and title generation; prefer a
  non-thinking model for internal tasks (`internal_task_model_strength`)
  while those provider gaps exist.
- The start page's "Empfohlen" section stays empty without subscribed or
  community assistants — an honest empty state is acceptable for docs.
