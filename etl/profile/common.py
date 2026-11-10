"""Shared helpers for the read-only data profiling scripts.

Nothing in here writes to data/. All functions return pandas objects or markdown strings.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
DOCS = ROOT / "docs"

SCOPE = ["BOS", "BDL", "PVD", "MHT", "PWM", "BTV", "LAX", "SNA", "BUR", "LGB", "ONT", "ANC", "FAI", "SFO", "OAK", "SJC"]
NEW_ENGLAND = ["BOS", "BDL", "PVD", "MHT", "PWM", "BTV"]

LOW_CARD = 25  # columns with <= this many distinct values get a value/count listing


def human(n: float) -> str:
    for unit in ["B", "KB", "MB", "GB"]:
        if abs(n) < 1024:
            return f"{n:,.1f} {unit}"
        n /= 1024
    return f"{n:,.1f} TB"


def fmt(x) -> str:
    """Compact number formatting for tables."""
    if x is None or (isinstance(x, float) and np.isnan(x)):
        return "–"
    if isinstance(x, (int, np.integer)):
        return str(x) if 1900 <= x <= 2100 else f"{x:,}"
    if isinstance(x, (float, np.floating)):
        if abs(x) >= 1000:
            return f"{x:,.0f}"
        if abs(x) >= 10:
            return f"{x:,.1f}"
        return f"{x:,.3g}"
    return str(x)


def md_table(df: pd.DataFrame, index: bool = True, max_rows: int | None = None) -> str:
    """Render a DataFrame as a GitHub markdown table."""
    if df is None or len(df) == 0:
        return "_(none)_\n"
    d = df.copy()
    truncated = False
    if max_rows is not None and len(d) > max_rows:
        d = d.head(max_rows)
        truncated = True
    if index:
        d.index.name = d.index.name or ""
        d = d.reset_index()
    cols = [str(c) for c in d.columns]
    lines = ["| " + " | ".join(cols) + " |", "|" + "|".join("---" for _ in cols) + "|"]
    for row in d.itertuples(index=False):
        lines.append("| " + " | ".join(fmt(v).replace("|", "\\|") for v in row) + " |")
    out = "\n".join(lines) + "\n"
    if truncated:
        out += f"\n_(showing first {max_rows} of {len(df)} rows)_\n"
    return out


def schema_table(df: pd.DataFrame, low_card: int = LOW_CARD) -> pd.DataFrame:
    """Per-column dtype, null count/%, distinct count, and value counts for low-cardinality columns."""
    n = len(df)
    rows = []
    for c in df.columns:
        s = df[c]
        nn = int(s.isna().sum())
        nu = int(s.nunique(dropna=True))
        vals = ""
        if nu <= low_card:
            vc = s.value_counts(dropna=False).head(low_card)
            vals = ", ".join(f"{('<NA>' if pd.isna(k) else k)!s}={v:,}" for k, v in vc.items())
        rows.append({"column": c, "dtype": str(s.dtype), "nulls": nn, "null %": round(100 * nn / n, 2) if n else 0,
                     "distinct": nu, "values (value=count)": vals})
    return pd.DataFrame(rows).set_index("column")


def numeric_table(df: pd.DataFrame, cols: list[str] | None = None) -> tuple[pd.DataFrame, list[str]]:
    """min/p5/median/p95/max/mean/std; returns (table, flagged columns where max > 10x p95)."""
    cols = cols or [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
    rows, flags = [], []
    for c in cols:
        s = df[c].dropna().astype("float64")
        if s.empty:
            continue
        q = s.quantile([0.05, 0.5, 0.95])
        mx, p95 = s.max(), q[0.95]
        # p95 == 0 with a positive max is a sparse column (ratio undefined) -> flag too
        flag = bool((p95 > 0 and mx > 10 * p95) or (p95 == 0 and mx > 0))
        if s.nunique() <= 2:  # binary indicator columns (0/1) are not meaningful for the 10x rule
            flag = False
        if flag:
            flags.append(c)
        rows.append({"column": c, "min": s.min(), "p5": q[0.05], "median": q[0.5], "p95": p95, "max": mx,
                     "mean": s.mean(), "std": s.std(), "max>10×p95": "FLAG" if flag else ""})
    return pd.DataFrame(rows).set_index("column"), flags


def dup_counts(df: pd.DataFrame, key: list[str]) -> dict:
    """Exact duplicate rows and natural-key duplicates (rows beyond the first occurrence)."""
    exact = int(df.duplicated(keep="first").sum())
    kd = df.duplicated(subset=key, keep="first")
    key_extra = int(kd.sum())
    key_groups = int(df.duplicated(subset=key, keep=False).sum())
    return {"exact_dup_rows": exact, "key": key, "key_dup_extra_rows": key_extra, "rows_in_dup_key_groups": key_groups}


def gaps_from_grid(grid: pd.DataFrame, expected_cols: list | None = None) -> list[str]:
    """List every (row, col) cell where a count grid is zero/missing."""
    out = []
    g = grid.copy()
    if expected_cols is not None:
        g = g.reindex(columns=expected_cols)
    g = g.fillna(0)
    for idx in g.index:
        missing = [str(c) for c in g.columns if g.loc[idx, c] == 0]
        if missing:
            out.append(f"{idx}: {', '.join(missing)}")
    return out


def section(title: str, level: int = 3) -> str:
    return f"\n{'#' * level} {title}\n\n"


def generic_profile(df: pd.DataFrame, key: list[str], files: list[Path]) -> tuple[str, dict]:
    """Shape + schema + numeric + duplicates block shared by all tabular sources."""
    md = []
    size = sum(f.stat().st_size for f in files)
    md.append(f"**Shape:** {len(df):,} rows x {df.shape[1]} columns | files: "
              + ", ".join(f"`{f.name}` ({human(f.stat().st_size)})" for f in files[:10])
              + (f" ... (+{len(files) - 10} more)" if len(files) > 10 else "") + f" | total {human(size)}\n")
    md.append(section("Schema (dtype, nulls, distinct, low-cardinality values)", 4))
    md.append(md_table(schema_table(df)))
    nt, flags = numeric_table(df)
    md.append(section("Numeric columns", 4))
    md.append(md_table(nt))
    if flags:
        md.append("\n**Flagged (max > 10x p95):** " + ", ".join(f"`{c}`" for c in flags) + "\n")
    d = dup_counts(df, key)
    md.append(section("Duplicates", 4))
    md.append(f"- Exact duplicate rows: **{d['exact_dup_rows']:,}**\n"
              f"- Natural key `{', '.join(key)}`: **{d['key_dup_extra_rows']:,}** extra rows "
              f"({d['rows_in_dup_key_groups']:,} rows in duplicated-key groups)\n")
    return "\n".join(md), {"dups": d, "flags": flags, "size": size}
