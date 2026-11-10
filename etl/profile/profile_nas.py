"""Profile data/raw/nas (read-only). FAA NAS Status live snapshot (XML + JSON)."""
from __future__ import annotations

import json
import re
import xml.etree.ElementTree as ET

import pandas as pd

from common import RAW, SCOPE, human, md_table, section

D = RAW / "nas"


def profile() -> dict:
    xml_f, js_f = D / "airport-status-information.xml", D / "airport-events.json"
    md = [f"**Files:** `{xml_f.name}` ({human(xml_f.stat().st_size)}), `{js_f.name}` ({human(js_f.stat().st_size)}) · "
          "single live snapshot, no history, no date coverage beyond the capture time.\n"]

    # ---- XML structure
    root = ET.parse(xml_f).getroot()
    tags: dict[str, int] = {}
    for el in root.iter():
        tags[el.tag] = tags.get(el.tag, 0) + 1
    md.append(section("XML structure (element: count)", 4))
    md.append(", ".join(f"`{k}`={v}" for k, v in tags.items()) + "\n")
    upd = root.findtext("Update_Time")
    md.append(f"\n- Root `{root.tag}`, `Update_Time` = {upd}; `Delay_type` blocks: {len(root.findall('Delay_type'))} "
              f"(names: {[d.findtext('Name') for d in root.findall('Delay_type')]})\n")
    rows = []
    for dt in root.findall("Delay_type"):
        for a in dt.iter("Airport"):
            rows.append({"type": dt.findtext("Name"), "airport": a.findtext("ARPT"), "start": a.findtext("Start"),
                         "reopen": a.findtext("Reopen"), "reason": (a.findtext("Reason") or "")[:110]})
    x = pd.DataFrame(rows)
    md.append(section("XML events", 4))
    md.append(md_table(x, index=False))
    in_scope_x = x[x.airport.isin(SCOPE)] if len(x) else x
    md.append(f"\n**Our airports in XML snapshot:** {in_scope_x.airport.tolist() or 'none'} · "
              "airports are 3-letter IATA codes in XML.\n")

    # ---- JSON structure
    js = json.loads(js_f.read_text(encoding="utf8"))
    md.append(section("JSON structure", 4))
    md.append(f"- Top-level type: `{type(js).__name__}` with {len(js)} airport objects\n")
    keys: dict[str, int] = {}
    for o in js:
        for k in o:
            keys[k] = keys.get(k, 0) + 1
    md.append(f"- Fields (present count): {', '.join(f'`{k}`={v}' for k, v in keys.items())}\n")
    ev_fields = ["groundStop", "groundDelay", "airportClosure", "freeForm", "arrivalDelay", "departureDelay", "airportConfig", "deicing"]
    sched = []
    for o in js:
        active = [f for f in ev_fields if o.get(f)]
        sched.append({"airportId": o["airportId"], "name": o.get("airportLongName"), "active": ", ".join(active) or "(none)",
                      "in_scope": o["airportId"] in SCOPE})
    jt = pd.DataFrame(sched)
    md.append(section("JSON: airports and active event types", 4))
    md.append(md_table(jt, index=False))
    nulls = {f: sum(1 for o in js if not o.get(f)) for f in ev_fields}
    md.append(f"\n- Null counts per event field (of {len(js)}): {nulls}\n")
    md.append(f"- Airport IDs in JSON are 3-letter IATA-style: all match `^[A-Z]{{3}}$`: "
              f"{all(re.fullmatch('[A-Z]{3}', o['airportId']) for o in js)}\n")

    # ---- sample status for our airports
    md.append(section("Current status of our 16 airports (from both files)", 4))
    jset = {o["airportId"]: o for o in js}
    xset = in_scope_x.groupby("airport").size().to_dict() if len(in_scope_x) else {}
    st = []
    for a in SCOPE:
        o = jset.get(a)
        xml_ev = xset.get(a, 0)
        if o:
            act = [f for f in ev_fields if o.get(f)]
            txt = (o.get("freeForm") or {}).get("simpleText", "") if isinstance(o.get("freeForm"), dict) else ""
            status = "event: " + ", ".join(act) if act else "listed, no active event field"
            st.append({"airport": a, "JSON": status, "XML events": xml_ev, "note": txt[:90]})
        else:
            st.append({"airport": a, "JSON": "not listed (no active event)", "XML events": xml_ev, "note": ""})
    md.append(md_table(pd.DataFrame(st), index=False))
    md.append("\nNote: SNA's XML entry is a daily curfew-type NOTAM closure (`AP CLSD DLY 0730-1415` UTC), "
              "and LAX's is GA-only; neither is a scheduled-service disruption. Parse `Reason` text before treating `Airport Closures` as an outage.\n")
    md.append("- Timestamp differences: XML uses free-text 'Nov 10 at 07:30 UTC.' strings (no year); JSON uses ISO-8601. "
              "Use JSON where possible.\n")
    return {"md": "\n".join(md), "rows": len(x) + len(js), "in_scope": sorted(set(jt[jt.in_scope].airportId) | set(in_scope_x.airport) if len(x) else set(jt[jt.in_scope].airportId)),
            "files": [xml_f, js_f], "snapshot": upd}


if __name__ == "__main__":
    print(profile()["md"])
