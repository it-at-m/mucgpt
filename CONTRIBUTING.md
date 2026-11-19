# Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please open an issue with the tag "enhancement", fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Open an issue with the tag "enhancement"
2. Fork the Project
3. Create your Feature Branch (`git checkout -b feat/AmazingFeature`)
4. Commit your Changes (gitmoji style, e.g. `✨` — see the recent history)
5. Push to the Branch (`git push origin feat/AmazingFeature`)
6. Open a Pull Request against `main`

More about this in the [CODE_OF_CONDUCT](/CODE_OF_CONDUCT.md) file.

## Quality gates (what we expect before opening a PR)

Before requesting review, ensure your changes satisfy the following gates locally and in CI. All Python commands run **inside the relevant service directory** (`mucgpt-core-service/` or `mucgpt-assistant-service/`), never at the repo root.

- Code lints cleanly and is formatted (`ruff check` / `ruff format`, `npm run lint`).
- Tests pass (`pytest` for the services, `npm test` for the frontend).
- Type checking passes where configured (`uv run ty check` for the core service).
- The affected components build (`npm run build`, docker build if touched).
- Commit messages follow the gitmoji convention; the PR follows the [pull request template](.github/pull_request_template.md).

Running these checks locally reduces review iterations and speeds up merges.

### Required local commands

Frontend (`mucgpt-frontend/`):

```bash
npm run lint     # prettier --check + eslint + tsc --noEmit
npm run fix      # auto-fix prettier/eslint issues
npm test         # vitest
npm run build    # tsc && vite build
```

Backend (`mucgpt-core-service/`, `mucgpt-assistant-service/`):

```bash
uv sync --all-extras         # install dependencies
uv run ruff check            # lint (add --fix to autofix)
uv run pytest                # all tests, no infrastructure required
uv run ty check              # type check (core service; configured per service)
```

Install the pre-commit hooks once per clone — they run ruff lint+format, gitleaks, and the frontend auto-fix on changed files:

```bash
uv run pre-commit install
```

See the [development guide](docs/DEVELOPMENT.md) for the uv workflow and release tags, and the [getting started guide](docs/GETTING_STARTED.md) for configuration.

## Documenting big features

When a big new user-facing feature is implemented, update the documentation **as part of the feature work** — not afterwards:

**In this repository:**

- `docs/FEATURES.md` — user-facing description; add an availability note ("available from MUCGPT X.Y") when the feature only ships with a future release.
- `publiccode.yml` — de/en `features` lists.
- `README.md` — roadmap/architecture when affected.
- `docs/GETTING_STARTED.md` (and service docs like `mucgpt-core-service/app/agent/tools/README.md`) when the feature needs configuration.

**External repositories** (separate draft PRs; they merge only when the feature may be communicated publicly — see e.g. the `docs/mucgpt-2.1` branches):

- [it-at-m/ki.muenchen.de](https://github.com/it-at-m/ki.muenchen.de) — `ki-systeme/mucgpt.md` (German public page)
- [it-at-m/opensource.muenchen.de](https://github.com/it-at-m/opensource.muenchen.de) — `software/mucgpt.md` (English portal page)

Screenshots for new sections go into `docs/` here and the external repos' image directories (e.g. `public/img/mucgpt/`). New or refreshed screenshot/video sets follow the [media production guide](docs/media-production.md).
