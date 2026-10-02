#!/usr/bin/env bash
#
# Print the release notes for one version: its section of CHANGELOG.md, then a
# footer. Used by .github/workflows/release.yml; runnable locally to preview.
#
#   bin/release-notes.sh 1.2.0-beta            # notes on stdout
#   bin/release-notes.sh 1.2.0-beta > notes.md
#
# Exits 1, printing nothing, when CHANGELOG.md has no "## [<version>]" section,
# so the caller can fall back to GitHub's generated notes.

set -euo pipefail

VERSION="${1:?usage: bin/release-notes.sh <version>}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHANGELOG="$ROOT/CHANGELOG.md"
REPO_URL="https://github.com/Shepdesign-LLC/hooked-on-facets"

# Lines after "## [VERSION]" up to the next "## [" heading, or the link
# reference block at the end of the file ("[1.1.1]: https://..."). index()
# keeps the dots and hyphens in the version literal, not regex.
BODY="$(awk -v head="## [$VERSION]" '
    index($0, head) == 1                { found = 1; next }
    found && /^## \[/                   { exit }
    found && /^\[[^]]+\]: /             { exit }
    found                               { print }
' "$CHANGELOG" | cat -s | sed -e '/./,$!d')"

# Trim trailing blank lines.
BODY="$(printf '%s\n' "$BODY" | sed -e ':a' -e '/^\n*$/{$d;N;ba' -e '}')"

if [ -z "${BODY//[[:space:]]/}" ]; then
    echo "No \"## [$VERSION]\" section in CHANGELOG.md" >&2
    exit 1
fi

printf '%s\n\n' "$BODY"

case "$VERSION" in
    *-*) printf '**Pre-release.** WordPress.org installs stay on the current stable release.\n\n' ;;
esac

printf 'Full history: [CHANGELOG.md](%s/blob/v%s/CHANGELOG.md)\n' "$REPO_URL" "$VERSION"
