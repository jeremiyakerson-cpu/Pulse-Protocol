"""Bundle src/ + build/content.js into single-file HTML.

dist/index.html     full document (GitHub Pages, Home Screen, Capacitor)
dist/artifact.html  fragment for a claude.ai Artifact (host supplies <html>/<head>/<body>)

Every placeholder replace asserts its count, so a template change can't silently patch
the wrong place."""
import pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
read = lambda p: (ROOT / p).read_text()

def replace_once(s, old, new):
    n = s.count(old)
    assert n == 1, f"expected 1 occurrence of {old!r}, found {n}"
    return s.replace(old, new)

def section(tpl, name):
    a, b = f"<!--{name}-->", f"<!--/{name}-->"
    assert tpl.count(a) == 1 and tpl.count(b) == 1, name
    return tpl.split(a)[1].split(b)[0].strip()

ARTIFACT_CSS = """
/* Artifact host pads :root by the safe areas, so the nav sticks below the top inset */
.site-nav { top: env(safe-area-inset-top, 0px); padding-top: 0; background: var(--nav-bg); }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 60; background: var(--navy-1); }
"""

def build():
    subprocess.run([sys.executable, str(ROOT / "tools" / "author.py")], check=True)
    tpl = read("src/app.html")
    css = read("src/css/pulse.css") + read("src/css/components.css") + read("src/css/app.css") + read("src/css/v13.css")
    def fill(t, css_text, extra_head):
        t = replace_once(t, "/*CSS*/", css_text)
        t = replace_once(t, "/*THEME*/", read("src/js/theme.js"))
        t = replace_once(t, "/*DATA*/", read("build/content.js"))
        t = replace_once(t, "/*LOGIC*/", read("src/js/logic.js"))
        t = replace_once(t, "/*APP*/", read("src/js/app.js"))
        return replace_once(t, "<!--EXTRA_HEAD-->", extra_head)

    full = fill(tpl, css, "")
    doc = ('<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n'
           '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">\n'
           + section(full, "HEAD") + "\n</head>\n<body>\n" + section(full, "BODY") + "\n</body>\n</html>\n")
    (ROOT / "dist" / "index.html").write_text(doc)

    art = fill(tpl, css + ARTIFACT_CSS, '<meta name="claude:viewport-fit-sides" content="cover">')
    frag = section(art, "HEAD") + "\n" + section(art, "BODY") + "\n"
    (ROOT / "dist" / "artifact.html").write_text(frag)
    print(f"dist/index.html {len(doc)//1024} KB, dist/artifact.html {len(frag)//1024} KB")
    build_review(css)

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700;800'
         '&family=JetBrains+Mono:wght@500;700&family=Space+Grotesk:wght@600;700&display=swap">\n')

def build_review(app_css):
    """dist/review.html: clinician review checklist (Artifact fragment, uses the db capability)."""
    t = read("src/review/review.html")
    t = replace_once(t, "/*CSS*/", app_css + ARTIFACT_CSS + read("src/review/review.css"))
    t = replace_once(t, "/*THEME*/", read("src/js/theme.js"))
    t = replace_once(t, "/*DATA*/", read("build/content.js"))
    t = replace_once(t, "/*APP*/", read("src/review/review.js"))
    t = replace_once(t, "<!--EXTRA_HEAD-->", '<meta name="claude:viewport-fit-sides" content="cover">\n' + FONTS)
    frag = section(t, "HEAD") + "\n" + section(t, "BODY") + "\n"
    (ROOT / "dist" / "review.html").write_text(frag)
    print(f"dist/review.html {len(frag)//1024} KB")

if __name__ == "__main__":
    build()
