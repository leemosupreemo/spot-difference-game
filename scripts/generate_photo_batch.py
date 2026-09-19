#!/usr/bin/env python3
"""Operator CLI for managed base-image generation.

Interactive wizard and non-interactive flags always build the same
`RunConfig` through `build_run_config_from_answers`, so the two paths can
never silently diverge. Business logic (config building, plan formatting,
provider/credential wiring) lives in plain functions here so it can be
tested without driving a terminal.
"""

import dataclasses
import json
import os
import shutil
import sys
import webbrowser
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table

from base_auth import CredentialResolver, remove_provider_key, run_google_adc_login, store_provider_key
from base_generation_policy import DEFAULT_BASE_GENERATION_POLICY, validate_run_config
from base_generation_pipeline import _DEFAULT_PROVIDER_MODELS, BaseGenerationPipeline
from base_generation_report import write_html_report, write_json_report
from base_generation_types import RunConfig
from base_run_store import HISTORY_PATH_DEFAULT, RUN_ROOT_DEFAULT, AcceptedHistoryStore, RunStore
from base_scene_catalog import build_batch_plan, load_scene_catalog, validate_scene_catalog
from base_visual_critic import resolve_critic_mode

CATALOG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "base_scene_catalog.json")

_PORTFOLIO_LABELS = {"collection": "collections", "activity": "activities", "playful": "playful"}

console = Console()

app = typer.Typer(help="Managed base-image generation for spot-the-difference levels.")
auth_app = typer.Typer(help="Provider credential management.")
catalog_app = typer.Typer(help="Scene catalog utilities.")
history_app = typer.Typer(help="Accepted-scene history utilities.")
app.add_typer(auth_app, name="auth")
app.add_typer(catalog_app, name="catalog")
app.add_typer(history_app, name="history")


# --------------------------------------------------------------------------
# Pure, testable logic
# --------------------------------------------------------------------------


def format_portfolio_summary(counts: dict) -> str:
    return " / ".join(
        f"{counts[family]} {_PORTFOLIO_LABELS[family]}" for family in ("collection", "activity", "playful")
    )


def _is_interactive() -> bool:
    """Whether stdin is a real terminal. Indirected through this function
    (rather than calling sys.stdin.isatty() inline) so tests can force the
    interactive path without needing a real tty, since test runners replace
    sys.stdin with a non-tty stream regardless of the input they feed it."""
    return sys.stdin.isatty()


def build_run_config_from_answers(answers: dict) -> RunConfig:
    """Build a RunConfig from a plain dict of choices. The interactive wizard
    and every flag-driven command build this same dict shape, so wizard and
    flags can never produce a different RunConfig for equivalent input."""
    count = int(answers.get("count", 10))
    default_max_images = DEFAULT_BASE_GENERATION_POLICY.max_images_for_count(count)
    max_images = answers.get("max_images")
    return RunConfig(
        count=count,
        provider_mode=answers.get("provider_mode", "mixed"),
        critic_mode=answers.get("critic_mode", "auto"),
        portfolio_preset=answers.get("portfolio_preset", "balanced_40_40_20"),
        quality_preset=answers.get("quality_preset", "production"),
        seed=int(answers.get("seed", 0)),
        max_images=int(max_images) if max_images is not None else default_max_images,
        max_spend_usd=answers.get("max_spend_usd"),
        keep_rejected=bool(answers.get("keep_rejected", False)),
        allow_provider_fallback=bool(answers.get("allow_provider_fallback", False)),
        staging_root=answers.get("staging_root", RUN_ROOT_DEFAULT),
        execution_mode=answers.get("execution_mode", "dry_run"),
    )


def write_run_config(config: RunConfig, path) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(config.to_public_dict(), indent=2), encoding="utf-8")


def load_run_config(path) -> RunConfig:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return RunConfig(**data)


def resolve_providers_for_execution(config: RunConfig, resolver: CredentialResolver, provider_classes: dict):
    """Resolve credentials for every provider `config.provider_mode` needs.

    Returns (providers, effective_config). If a provider is missing and
    `allow_provider_fallback` is set, that provider is dropped instead of
    failing, and a mixed-mode config is narrowed to whichever single
    provider remains (BaseGenerationPipeline requires every provider named
    by `provider_mode` to actually be present in `providers`). Raises
    ValueError if a required provider is missing and fallback isn't allowed,
    or if fallback leaves no provider at all.
    """
    wanted = ("google", "openai") if config.provider_mode == "mixed" else (config.provider_mode,)

    providers = {}
    missing = []
    for name in wanted:
        resolve_fn = resolver.resolve_google if name == "google" else resolver.resolve_openai
        credential = resolve_fn()
        if credential is None:
            missing.append(name)
            continue
        providers[name] = provider_classes[name](credential=credential)

    if missing and not config.allow_provider_fallback:
        raise ValueError(f"missing credentials for: {', '.join(missing)}")
    if not providers:
        raise ValueError("no provider credentials are available")

    effective_config = config
    if missing and len(providers) == 1 and config.provider_mode == "mixed":
        effective_config = dataclasses.replace(config, provider_mode=next(iter(providers)))

    return providers, effective_config, missing


def _provider_models_line(config: RunConfig) -> str:
    names = ("google", "openai") if config.provider_mode == "mixed" else (config.provider_mode,)
    models = ", ".join(f"{name}={_DEFAULT_PROVIDER_MODELS.get(name, 'unknown')}" for name in names)
    return f"Provider models: {models}"


def _run_config_summary_lines(config: RunConfig) -> list:
    policy = DEFAULT_BASE_GENERATION_POLICY
    counts = policy.portfolio_counts(config.count)
    spend_line = (
        f"Spend ceiling: ${config.max_spend_usd:.2f}" if config.max_spend_usd is not None else "Spend ceiling: none"
    )
    return [
        f"Target: {config.count} pairs ({format_portfolio_summary(counts)})",
        f"Provider mode: {config.provider_mode}  Critic mode: {resolve_critic_mode(config)}",
        _provider_models_line(config),
        f"Image ceiling: {config.max_images}",
        spend_line,
        f"Master size: {policy.master_size[0]}x{policy.master_size[1]}  "
        f"Production size: {policy.production_size[0]}x{policy.production_size[1]}",
        f"Staging: {config.staging_root}",
        f"Mode: {config.execution_mode}",
    ]


def _print_config_summary(config: RunConfig) -> None:
    for line in _run_config_summary_lines(config):
        console.print(line)


def _print_run_result(result) -> None:
    table = Table(title=f"Run {result.run_id}")
    table.add_column("Metric")
    table.add_column("Value")
    table.add_row("Requested pairs", str(result.requested_count))
    table.add_row("Accepted pairs", str(len(result.accepted)))
    table.add_row("Images generated", str(result.generated_image_count))
    table.add_row("Stop reason", result.stop_code)
    console.print(table)


def _build_pipeline(briefs, providers, evaluator, staging_root, progress_callback=None) -> BaseGenerationPipeline:
    history_store = AcceptedHistoryStore(path=HISTORY_PATH_DEFAULT)
    return BaseGenerationPipeline(
        policy=DEFAULT_BASE_GENERATION_POLICY,
        briefs=briefs,
        providers=providers,
        evaluator=evaluator,
        history_store=history_store,
        staging_root=staging_root,
        progress_callback=progress_callback,
    )


def _build_pipeline_for_execution(config: RunConfig, progress_callback=None) -> tuple:
    """Real wiring for an execute-mode run: resolves credentials, constructs
    live provider/critic adapters, and returns (pipeline, effective_config).
    Only ever called after a run has been explicitly confirmed."""
    from base_candidate_evaluator import BaseCandidateEvaluator
    from base_image_provider import GoogleImageProvider, OpenAIImageProvider
    from base_visual_critic import GoogleVisualCritic, OpenAIVisualCritic

    resolver = CredentialResolver()
    try:
        providers, effective_config, missing = resolve_providers_for_execution(
            config, resolver, {"google": GoogleImageProvider, "openai": OpenAIImageProvider}
        )
    except ValueError as exc:
        console.print(f"[red]{exc}[/red]")
        raise typer.Exit(code=1)

    if missing:
        console.print(f"[yellow]Falling back without: {', '.join(missing)}[/yellow]")

    critic_provider = resolve_critic_mode(effective_config)
    critic_credential = resolver.resolve_google() if critic_provider == "google" else resolver.resolve_openai()
    if critic_credential is None:
        console.print(f"[red]Missing credentials for the {critic_provider} critic.[/red]")
        raise typer.Exit(code=1)
    critic_cls = GoogleVisualCritic if critic_provider == "google" else OpenAIVisualCritic
    critic = critic_cls(credential=critic_credential)

    evaluator = BaseCandidateEvaluator(critic=critic, policy=DEFAULT_BASE_GENERATION_POLICY)
    briefs = load_scene_catalog(CATALOG_PATH)
    pipeline = _build_pipeline(briefs, providers, evaluator, effective_config.staging_root, progress_callback)
    return pipeline, effective_config


_STAGE_LABELS = {
    "generating": "Generating",
    "normalizing": "Normalizing",
    "evaluating": "Evaluating",
}


def _execute_run(run_config: RunConfig, run_id: Optional[str] = None, resume: bool = False):
    """Shared execution path for `generate` and `resume`. Prints one plain,
    persistent log line per stage of every candidate as it happens -- not a
    live-updating dashboard -- so progress is visible as real scrollback even
    on terminals that don't render Rich's box-drawing UI cleanly, and so a
    long provider or critic call never looks like the run has hung."""
    state = {"generated": 0, "accepted": 0}

    def on_progress(event: dict) -> None:
        stage = event.get("stage")
        brief = event.get("current_brief") or "-"
        provider = event.get("current_provider") or "-"

        if stage in _STAGE_LABELS:
            console.print(f"  [cyan]{_STAGE_LABELS[stage]}[/cyan] -- {brief} via {provider}...")
            return

        # stage == "done": a candidate reached a final verdict.
        state["generated"] = event.get("generated_image_count", state["generated"])
        state["accepted"] = event.get("accepted_count", state["accepted"])
        progress_note = f"[dim]({state['generated']} images generated, {state['accepted']} pairs accepted)[/dim]"
        if event.get("accepted"):
            console.print(f"  [green]Accepted[/green] -- {brief} via {provider} {progress_note}")
        else:
            code = event.get("rejection_code") or "unknown"
            console.print(f"  [red]Rejected[/red] ({code}) -- {brief} via {provider} {progress_note}")

    pipeline, effective_config = _build_pipeline_for_execution(run_config, progress_callback=on_progress)
    console.print(
        f"\n[bold]Starting generation[/bold] -- target {effective_config.count} pairs, "
        f"image ceiling {effective_config.max_images}\n"
    )

    result = pipeline.run(effective_config, run_id=run_id, resume=resume)

    console.print()
    _print_run_result(result)
    return result


# --------------------------------------------------------------------------
# Interactive wizard
# --------------------------------------------------------------------------


def _prompt_choice(text: str, choices: list, default: str) -> str:
    """Prompt for one of `choices`, listing them explicitly and re-asking
    (with a friendly message, never a crash) until the answer is valid."""
    choices_display = "/".join(choices)
    while True:
        value = typer.prompt(f"{text} [{choices_display}]", default=default)
        if value in choices:
            return value
        console.print(f"[red]'{value}' isn't one of: {choices_display}. Try again.[/red]")


def _run_interactive_wizard() -> dict:
    console.print(
        "\n[bold]Provider mode[/bold] -- mixed generates from both Google and OpenAI and "
        "picks the stronger one per scene; google/openai use only that provider "
        "(and need only that provider's credentials)."
    )
    provider_mode = _prompt_choice("Provider mode", ["mixed", "google", "openai"], default="mixed")

    count = typer.prompt(
        "Target pair count -- split 40% collections / 40% activities / 20% playful",
        default=10,
        type=int,
    )

    portfolio_preset = _prompt_choice(
        "Portfolio preset (only one available today)", ["balanced_40_40_20"], default="balanced_40_40_20"
    )
    quality_preset = _prompt_choice(
        "Quality preset (only one available today)", ["production"], default="production"
    )

    default_ceiling = DEFAULT_BASE_GENERATION_POLICY.max_images_for_count(count)
    max_images = typer.prompt(
        f"Image ceiling -- hard cap on total images generated this run, checked before "
        f"every provider call (this is the real safety limit; suggested default scales "
        f"with your pair count)",
        default=default_ceiling,
        type=int,
    )

    spend_input = typer.prompt(
        "Spend ceiling in USD, for your own tracking only -- NOT YET ENFORCED by the "
        "pipeline; the image ceiling above is the only limit actually checked (blank for none)",
        default="",
        show_default=False,
    )
    max_spend_usd = float(spend_input) if spend_input.strip() else None

    keep_rejected = typer.confirm(
        "Keep rejected candidate images on disk for diagnosis instead of deleting them?",
        default=False,
    )
    staging_root = typer.prompt(
        "Staging location -- local folder for run logs and candidates before publication",
        default=RUN_ROOT_DEFAULT,
    )

    answers = {
        "provider_mode": provider_mode,
        "count": count,
        "portfolio_preset": portfolio_preset,
        "quality_preset": quality_preset,
        "max_images": max_images,
        "max_spend_usd": max_spend_usd,
        "keep_rejected": keep_rejected,
        "staging_root": staging_root,
        "execution_mode": "dry_run",
    }

    console.print("\n[bold]Run summary[/bold]")
    _print_config_summary(build_run_config_from_answers(answers))

    if typer.confirm("Execute now (paid run)? (no = dry run)", default=False):
        console.print("\n[bold yellow]This will make real, billable provider API calls.[/bold yellow]")
        _print_config_summary(build_run_config_from_answers({**answers, "execution_mode": "execute"}))
        if typer.confirm("Confirm: proceed with this paid run now?", default=False):
            answers["execution_mode"] = "execute"
        else:
            console.print("Kept as a dry-run configuration; nothing was generated.")

    return answers


@app.callback(invoke_without_command=True)
def main(ctx: typer.Context):
    if ctx.invoked_subcommand is not None:
        return
    if not _is_interactive():
        console.print(ctx.get_help())
        raise typer.Exit(code=0)

    answers = _run_interactive_wizard()
    config = build_run_config_from_answers(answers)

    config_path = Path(config.staging_root).parent / "run-config.json"
    write_run_config(config, config_path)
    console.print(f"Wrote {config_path}")
    console.print(f"Reproducible command: python3 scripts/generate_photo_batch.py generate --config {config_path}")
    console.print("(add --yes to run that command unattended)")

    if config.execution_mode == "execute":
        _execute_run(config)


# --------------------------------------------------------------------------
# plan / generate / resume / report / doctor
# --------------------------------------------------------------------------


@app.command()
def plan(
    count: int = typer.Option(10, help="Target completed pair count."),
    provider: str = typer.Option("mixed", "--provider", help="Provider mode: mixed, google, or openai."),
    critic: str = typer.Option("auto", "--critic", help="Critic mode: auto, google, or openai."),
    seed: int = typer.Option(0, help="Deterministic scheduling seed."),
    max_images: Optional[int] = typer.Option(None, help="Override the generation image ceiling."),
    max_spend: Optional[float] = typer.Option(None, "--max-spend", help="Spend ceiling in USD."),
    staging_root: str = typer.Option(RUN_ROOT_DEFAULT, help="Run staging root."),
    config_out: Optional[str] = typer.Option(
        None, "--config-out", help="Where to write the reproducible run-config.json."
    ),
):
    """Select a portfolio-balanced brief plan and print it. Makes no network calls."""
    answers = {
        "provider_mode": provider,
        "critic_mode": critic,
        "count": count,
        "seed": seed,
        "max_images": max_images,
        "max_spend_usd": max_spend,
        "staging_root": staging_root,
    }
    config = build_run_config_from_answers(answers)

    try:
        validate_run_config(config, DEFAULT_BASE_GENERATION_POLICY)
    except ValueError as exc:
        console.print(f"[red]Invalid configuration:[/red] {exc}")
        raise typer.Exit(code=1)

    _print_config_summary(config)

    briefs = load_scene_catalog(CATALOG_PATH)
    history_store = AcceptedHistoryStore(path=HISTORY_PATH_DEFAULT)
    recent = history_store.recent(limit=DEFAULT_BASE_GENERATION_POLICY.recent_history_window)
    selected = build_batch_plan(briefs, recent, config, DEFAULT_BASE_GENERATION_POLICY)
    console.print(f"Selected briefs: {', '.join(brief.id for brief in selected)}")

    config_path = config_out or str(Path(config.staging_root) / "run-config.json")
    write_run_config(config, config_path)
    console.print(f"Wrote {config_path}")
    console.print(f"Reproducible command: python3 scripts/generate_photo_batch.py generate --config {config_path}")
    console.print("(add --yes to run that command unattended)")


@app.command()
def generate(
    config: Optional[str] = typer.Option(
        None, "--config", help="Path to a run-config.json produced by plan. Overrides every other option below."
    ),
    provider: str = typer.Option("mixed", "--provider", help="Provider mode. Ignored if --config is given."),
    critic: str = typer.Option("auto", "--critic", help="Critic mode. Ignored if --config is given."),
    count: int = typer.Option(10, help="Target completed pair count. Ignored if --config is given."),
    seed: int = typer.Option(0, help="Deterministic scheduling seed. Ignored if --config is given."),
    max_images: Optional[int] = typer.Option(None, help="Image ceiling override. Ignored if --config is given."),
    max_spend: Optional[float] = typer.Option(
        None, "--max-spend", help="Spend ceiling in USD. Ignored if --config is given."
    ),
    staging_root: str = typer.Option(RUN_ROOT_DEFAULT, help="Run staging root. Ignored if --config is given."),
    keep_rejected: bool = typer.Option(
        False, "--keep-rejected", help="Keep rejected candidate images for diagnosis."
    ),
    allow_provider_fallback: bool = typer.Option(
        False, "--allow-provider-fallback", help="Narrow a mixed run to whichever provider is authenticated."
    ),
    run_id: Optional[str] = typer.Option(None, help="Explicit run id (default: generated)."),
    yes: bool = typer.Option(False, "--yes", help="Confirm an unattended paid execution."),
):
    """Execute a generation run, either from a saved --config or directly from flags."""
    if config:
        run_config = load_run_config(config)
    else:
        answers = {
            "provider_mode": provider,
            "critic_mode": critic,
            "count": count,
            "seed": seed,
            "max_images": max_images,
            "max_spend_usd": max_spend,
            "staging_root": staging_root,
            "keep_rejected": keep_rejected,
            "allow_provider_fallback": allow_provider_fallback,
            "execution_mode": "execute",
        }
        run_config = build_run_config_from_answers(answers)

    try:
        validate_run_config(run_config, DEFAULT_BASE_GENERATION_POLICY)
    except ValueError as exc:
        console.print(f"[red]Invalid configuration:[/red] {exc}")
        raise typer.Exit(code=1)

    if run_config.execution_mode != "execute":
        console.print("[yellow]This is a dry-run configuration; nothing will be generated.[/yellow]")
        _print_config_summary(run_config)
        raise typer.Exit(code=0)

    interactive = _is_interactive()
    if not yes:
        if not interactive:
            console.print("Non-interactive execution requires --yes to confirm a paid run.")
            raise typer.Exit(code=1)
        _print_config_summary(run_config)
        if not typer.confirm("Proceed with this paid run?", default=False):
            console.print("Aborted.")
            raise typer.Exit(code=1)

    _execute_run(run_config, run_id=run_id)


@app.command()
def resume(
    run_id: str = typer.Argument(..., help="The run id to resume."),
    staging_root: str = typer.Option(RUN_ROOT_DEFAULT, help="Run staging root."),
):
    """Resume an interrupted run without regenerating completed candidates."""
    run_json_path = Path(staging_root) / run_id / "run.json"
    if not run_json_path.exists():
        console.print(f"[red]No run found: {run_id}[/red]")
        raise typer.Exit(code=1)

    stored_config = json.loads(run_json_path.read_text(encoding="utf-8"))["config"]
    run_config = RunConfig(**stored_config)

    _execute_run(run_config, run_id=run_id, resume=True)


@app.command()
def report(
    run_id: str = typer.Argument(..., help="The run id to report on."),
    staging_root: str = typer.Option(RUN_ROOT_DEFAULT, help="Run staging root."),
    open_report: bool = typer.Option(False, "--open", help="Open the HTML report in a browser."),
):
    """Generate JSON and HTML reports for a run."""
    store = RunStore.resume(run_id, root=staging_root)
    json_path = write_json_report(store)
    html_path = write_html_report(store)
    console.print(f"JSON report: {json_path}")
    console.print(f"HTML report: {html_path}")
    if open_report:
        webbrowser.open(Path(html_path).resolve().as_uri())


@app.command()
def doctor():
    """Check auth, dependencies, weights, staging paths, and catalog validity.

    Never generates an image or makes a paid call.
    """
    table = Table(title="Doctor")
    table.add_column("Check")
    table.add_column("Status")

    resolver = CredentialResolver()
    google_credential = resolver.resolve_google()
    openai_credential = resolver.resolve_openai()
    table.add_row("Google credentials", "available" if google_credential else "missing")
    table.add_row("OpenAI credentials", "available" if openai_credential else "missing")

    for module_name in ("PIL", "numpy", "cv2", "ultralytics", "keyring", "typer", "rich"):
        try:
            __import__(module_name)
        except ImportError:
            table.add_row(f"Dependency: {module_name}", "missing")
        else:
            table.add_row(f"Dependency: {module_name}", "ok")

    weights_path = Path("FastSAM-s.pt")
    table.add_row("FastSAM weights", "found" if weights_path.exists() else "missing")

    staging_root = Path(RUN_ROOT_DEFAULT)
    try:
        staging_root.mkdir(parents=True, exist_ok=True)
        probe_path = staging_root / ".doctor_write_check"
        probe_path.write_text("ok", encoding="utf-8")
        probe_path.unlink()
        table.add_row("Staging path writable", "ok")
    except OSError:
        table.add_row("Staging path writable", "failed")

    briefs = load_scene_catalog(CATALOG_PATH)
    catalog_errors = validate_scene_catalog(briefs)
    table.add_row("Catalog", "valid" if not catalog_errors else f"{len(catalog_errors)} error(s)")

    _, _, free_bytes = shutil.disk_usage(".")
    table.add_row("Disk space free", f"{free_bytes / (1024 ** 3):.1f} GB")

    console.print(table)


# --------------------------------------------------------------------------
# catalog / history sub-apps
# --------------------------------------------------------------------------


@catalog_app.command("validate")
def catalog_validate():
    """Validate the scene catalog without touching any network resource."""
    briefs = load_scene_catalog(CATALOG_PATH)
    errors = validate_scene_catalog(briefs)
    if errors:
        for error in errors:
            console.print(f"[red]{error}[/red]")
        raise typer.Exit(code=1)
    console.print(f"[green]OK[/green] -- {len(briefs)} briefs valid.")


@history_app.command("stats")
def history_stats(limit: int = typer.Option(30, help="How many recent accepted scenes to summarize.")):
    """Summarize recent accepted-scene history."""
    store = AcceptedHistoryStore(path=HISTORY_PATH_DEFAULT)
    records = store.recent(limit=limit)
    console.print(f"Recent accepted scenes: {len(records)}")
    family_counts: dict = {}
    for record in records:
        family = record.get("scene_family", "unknown")
        family_counts[family] = family_counts.get(family, 0) + 1
    for family, count in sorted(family_counts.items()):
        console.print(f"  {family}: {count}")


# --------------------------------------------------------------------------
# auth sub-app
# --------------------------------------------------------------------------


@auth_app.command("status")
def auth_status():
    """Show which providers are authenticated. Never prints credential values."""
    resolver = CredentialResolver()
    for name, resolve_fn in (("google", resolver.resolve_google), ("openai", resolver.resolve_openai)):
        credential = resolve_fn()
        if credential is None:
            console.print(f"{name}: not configured")
        else:
            console.print(f"{name}: {credential.public_status()}")


@auth_app.command("login")
def auth_login(provider: str = typer.Argument(..., help="Only 'google' supports interactive login.")):
    if provider != "google":
        console.print("[red]Only Google supports interactive ADC login.[/red]")
        raise typer.Exit(code=1)
    exit_code = run_google_adc_login()
    if exit_code == 0:
        console.print("[green]Google ADC login complete.[/green]")
    else:
        console.print(f"[red]Google ADC login failed (exit code {exit_code}).[/red]")
        raise typer.Exit(code=exit_code)


@auth_app.command("set-key")
def auth_set_key(provider: str = typer.Argument(..., help="google or openai")):
    secret = typer.prompt(f"{provider} API key", hide_input=True)
    store_provider_key(provider, secret)
    console.print(f"[green]Stored the {provider} key in the system keychain.[/green]")


@auth_app.command("remove")
def auth_remove(provider: str = typer.Argument(..., help="google or openai")):
    remove_provider_key(provider)
    console.print(f"[green]Removed the {provider} key from the system keychain.[/green]")


if __name__ == "__main__":
    app()
