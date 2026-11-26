"""Apply the EO/IR common header, locally on the review branch only.
No network, authentication, simulator logic, CAD, or database changes.
Run from repository root: python3 audit/apply-eoir-common-design.py
"""
import hashlib
import re
from pathlib import Path

path = Path("TSD_EOIR_V24_Mission.html")
original = path.read_bytes()
expected = "1720167fac449e030bf5159fb506f647b8336b27"
actual = hashlib.sha1(b"blob " + str(len(original)).encode() + b"\0" + original).hexdigest()
if actual != expected:
    raise SystemExit(f"Refusing unexpected source: {actual}")
s = original.decode("utf-8")
brand = '<a class="tsdBrand" href="https://lwhfpv.github.io/TSD-FPV/" aria-label="TSD 메인 페이지">TSD</a>'
header = """<header data-tsd-common-header>
 <div data-tsd-common-bar><a data-tsd-common-brand href="./index.html"><span aria-hidden="true">TSD</span> TSD Aero Systems</a><nav data-tsd-common-nav aria-label="주 메뉴"><a href="./education.html">체험교육</a><a href="./simulator.html" aria-current="page">시뮬레이터 체험</a><a href="./drone-design.html">드론설계</a><a href="./flight-safety.html">비행안전정보</a></nav><a data-tsd-common-contact href="./contact.html">문의</a></div>
</header>
<section data-tsd-common-hero aria-label="EO·IR 수색 훈련" class="tsdEoirHero"><h1>EO·IR 수색 훈련</h1><p>광학·열화상 카메라 및 비행 실습</p></section>
"""
css = """<link rel="stylesheet" href="./tsd-aero-common.css">
<style>.tsdEoirHero{padding:13px 16px}.tsdEoirHero h1{font:700 clamp(20px,3vw,28px)/1.25 system-ui;margin:0}.tsdEoirHero p{font:500 13px/1.5 system-ui;margin:4px 0 0}@media(max-width:600px){.tsdEoirHero{padding:8px 12px}.tsdEoirHero p{font-size:12px}}</style>
"""
for anchor in (brand, "</head>", "<body>"):
    if s.count(anchor) != 1:
        raise SystemExit("Unexpected source anchor")
if "data-tsd-common-header" in s:
    raise SystemExit("Already contains the common header")
p = s.replace("</head>", css + "</head>", 1).replace("<body>", "<body>\n" + header, 1).replace(brand, "", 1)
scripts = re.compile(r"<script\b[^>]*>[\s\S]*?</script>", re.I)
ids = re.compile(r'\bid="([^"]+)"')
if len(scripts.findall(s)) != 9 or scripts.findall(s) != scripts.findall(p):
    raise SystemExit("Script preservation check failed")
if ids.findall(s) != ids.findall(p):
    raise SystemExit("Element ID preservation check failed")
if not Path("tsd-aero-common.css").is_file():
    raise SystemExit("Missing existing common stylesheet")
path.write_bytes(p.encode("utf-8"))
print("PASS: source blob matched; 9 original script blocks and element ID sequence unchanged.")
print("Visual and runtime regression tests remain required; do not deploy.")
