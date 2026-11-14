# Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please open an issue with the tag "enhancement", fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".

1. Open an issue with the tag "enhancement"
2. Fork the Project
3. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
4. Commit your Changes (gitmoji style, e.g. `✨`; branches `feat/...`)
5. Push to the Branch (`git push origin feature/AmazingFeature`)
6. Open a Pull Request against `main`

See the [development guide](docs/DEVELOPMENT.md) for the uv workflow, tests, linting and release tags, and the [getting started guide](docs/GETTING_STARTED.md) for configuration.

## Documenting big features

When a big new user-facing feature is implemented, update the documentation **as part of the feature work** — not afterwards:

**In this repository:**

- `docs/FEATURES.md` — user-facing description; add an availability note ("available from MUCGPT X.Y") when the feature only ships with a future release.
- `publiccode.yml` — de/en `features` lists.
- `README.md` — roadmap/architecture when affected.
- `docs/GETTING_STARTED.md` (and service docs like `app/agent/tools/README.md`) when the feature needs configuration.

**External repositories** (separate draft PRs; they merge only when the feature may be communicated publicly — see e.g. the `docs/mucgpt-2.1` branches):

- [it-at-m/ki.muenchen.de](https://github.com/it-at-m/ki.muenchen.de) — `ki-systeme/mucgpt.md` (German public page)
- [it-at-m/opensource.muenchen.de](https://github.com/it-at-m/opensource.muenchen.de) — `software/mucgpt.md` (English portal page)

Screenshots for new sections go into `docs/` here and the external repos' image directories (e.g. `public/img/mucgpt/`).

More about this in the [CODE_OF_CONDUCT](CODE_OF_CONDUCT.md) file.
