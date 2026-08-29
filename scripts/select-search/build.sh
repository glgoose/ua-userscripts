#!/usr/bin/env bash
# Bouwt het userscript en de bookmarklet uit src/select-search.js.
# Gebruik: ./build.sh   (de bookmarklet belandt ook meteen in het klembord)
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
src="$here/src/select-search.js"
hdr="$here/src/userscript-header.txt"
out="$here"

for f in "$src" "$hdr"; do
  if [ ! -f "$f" ]; then
    echo "build.sh: ontbrekend bestand: $f" >&2
    exit 1
  fi
done

if ! command -v python3 >/dev/null 2>&1; then
  echo "build.sh: python3 is nodig om de bookmarklet te encoderen" >&2
  exit 1
fi

if grep -q 'MATCH_PLACEHOLDER' "$hdr"; then
  echo "build.sh: vul eerst de echte @match-URL in $hdr in" >&2
  exit 1
fi

# 1. Userscript = metadatablok + ongewijzigde core.
cat "$hdr" "$src" > "$out/select-search.user.js"

# 2. Bookmarklet = core, URL-encoded achter javascript:.
python3 - "$src" "$out/bookmarklet.txt" <<'PY'
import io, sys, urllib.parse

src, out = sys.argv[1], sys.argv[2]
code = io.open(src, encoding='utf-8').read()
# Regelcommentaar sneuvelt zodra alles op een regel staat; strip het weg.
lines = []
for line in code.split('\n'):
    stripped = line.strip()
    if stripped.startswith('//'):
        continue
    lines.append(line)
code = '\n'.join(lines)

# Een bladwijzerbeheerder mag de nieuwe regels weggooien zonder dat de
# bookmarklet stukgaat: dus geen enkel regelcommentaar meer overhouden.
for n, line in enumerate(code.split('\n'), 1):
    if '//' in line:
        sys.exit('build.sh: regelcommentaar op regel %d breekt de bookmarklet: %s'
                 % (n, line.strip()))

url = 'javascript:' + urllib.parse.quote(code, safe="!#$&'()*+,-./:;=?@_~")
io.open(out, 'w', encoding='utf-8').write(url)
print('bookmarklet: %d tekens' % len(url))
PY

if command -v pbcopy >/dev/null 2>&1; then
  pbcopy < "$out/bookmarklet.txt"
  echo "bookmarklet gekopieerd naar het klembord"
fi

echo "geschreven: $out/select-search.user.js"
echo "geschreven: $out/bookmarklet.txt"
