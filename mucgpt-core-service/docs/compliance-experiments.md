# Compliance Prompt Experiments

Use `scripts.run_compliance_experiment` to compare configured models against a
curated Langfuse dataset. Every dataset item is evaluated independently against
all four EU AI Act high-risk categories. Each selected model creates a separate
Langfuse dataset run, so the results can be compared in the Langfuse UI.

## Prerequisites

Run commands from `mucgpt-core-service/app` with `uv`. By default, the runner
loads the repository's `stack/core.config.yaml`. It must configure:

- `MODELS` with every model named through `--model`.
- `LANGFUSE.HOST`, `LANGFUSE.PUBLIC_KEY`, and `LANGFUSE.SECRET_KEY`.

Create and maintain the dataset in Langfuse. The experiment script only reads
the dataset; it does not create or modify datasets or items. Do not pass or
commit credentials as command-line arguments.

## Dataset Item Shape

Each Langfuse dataset item has an `input` with the system prompt and an
`expected_output` with a complete compliance response. Omit `prompt_hash`.
Every expected response must provide each category exactly once. `reasoning` is
optional and may be `null`; it is kept for expert review but is not compared by
the automatic evaluators.

```json
{
  "input": {
    "system_prompt": "Du unterstützt Sachbearbeiter:innen im Ausländeramt bei der Vorprüfung.\nErstelle für jeden Fall eine \"Priorisierungsempfehlung\" (niedrig/mittel/hoch)\nauf Basis von Herkunftsland, Reiseroute und Plausibilität der Angaben. Die\nEmpfehlung wird direkt in die Akte übernommen und von der Sachbearbeitung in\nder Regel unverändert bestätigt."
  },
  "expected_output": {
    "overall_status": "high_risk_detected",
    "results": [
      {
        "category": "migration_asylum_border",
        "status": "high_risk_detected",
        "reasoning": null
      },
      {
        "category": "public_services_access",
        "status": "passed",
        "reasoning": null
      },
      {
        "category": "hr_employment",
        "status": "passed",
        "reasoning": null
      },
      {
        "category": "education",
        "status": "passed",
        "reasoning": null
      }
    ]
  }
}
```

The allowed status values are `passed`, `high_risk_detected`, and `error`.

## Run an Experiment

Run one model:

```powershell
Set-Location app
uv run python -m scripts.run_compliance_experiment `
  --dataset "assistant-compliance" `
  --model "gpt-4.1"
```

To use a different configuration, pass its path explicitly:

```powershell
Set-Location app
uv run python -m scripts.run_compliance_experiment `
  --config "C:\path\to\core.config.yaml" `
  --dataset "assistant-compliance" `
  --model "configured-model-name"
```

Compare models on the same dataset:

```powershell
Set-Location app
uv run python -m scripts.run_compliance_experiment `
  --dataset "assistant-compliance" `
  --model "configured-model-a" `
  --model "configured-model-b" `
  --run-name "compliance-baseline" `
  --max-concurrency 4 `
  --show-item-results
```

For a reproducible run against a prior dataset version, pass a timezone-aware
ISO-8601 timestamp:

```powershell
Set-Location app
uv run python -m scripts.run_compliance_experiment `
  --dataset "assistant-compliance" `
  --model "configured-model-name" `
  --dataset-version "2026-08-10T10:30:00Z"
```

## Scores

Each item receives these deterministic scores:

- `overall_status_accuracy`
- `<category>_status_accuracy` for each of the four categories
- `all_category_statuses_match`

The dataset run receives the corresponding mean scores and `failure_count`.
Inspect generated reasoning and any failed items in Langfuse before changing
prompts or accepting a model for production use.
