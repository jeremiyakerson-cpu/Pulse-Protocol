"""Author step: Python dicts -> build/content.json (checkpoint) -> build/content.js (emitter).

Keeps authoring bugs (here) separate from serialization bugs (emit_js)."""
import json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "content"))
from cases import CASES            # noqa: E402
from index_entries import INDEX    # noqa: E402
from dosing import DOSING, EXCLUDED  # noqa: E402
from cases_batch2 import CASES_2  # noqa: E402
from index_batch2 import INDEX_2  # noqa: E402
from dosing_batch2 import DOSING_2  # noqa: E402

def checkpoint():
    data = dict(version="13.1-draft", cases=CASES + CASES_2, index=INDEX + INDEX_2, dosing=DOSING + DOSING_2, excluded=EXCLUDED)
    (ROOT / "build").mkdir(exist_ok=True)
    out = ROOT / "build" / "content.json"
    out.write_text(json.dumps(data, indent=1, ensure_ascii=False))
    return data

def emit_js(data):
    # </script> can't appear inside an inline script; escape the slash.
    body = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    (ROOT / "build" / "content.js").write_text("window.PP_DATA=" + body + ";\n")

if __name__ == "__main__":
    d = checkpoint(); emit_js(d)
    print(f"authored {len(d['cases'])} cases, {len(d['index'])} index entries, {len(d['dosing'])} dosing entries")
