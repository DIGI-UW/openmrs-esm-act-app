#!/usr/bin/env bash
# Waits until npm serves the pre-release this CI run published, so the distro's frontend build assembles it rather
# than the one before. Writes published=true|false to $GITHUB_OUTPUT.
#
# Usage: .github/scripts/wait-for-npm-pre-release.sh <run number> [wait seconds, default 900]
#
# npm takes minutes to serve a publish: first the version's own document appears, then the next tag catches up. So
# a 404 does not mean the run did not publish, and both are polled until the deadline. The one run that never
# publishes, a [skip-pre] commit, is kept from calling this script by the workflow.
set -euo pipefail

run_number=$1
wait_seconds=${2:-900}
output=${GITHUB_OUTPUT:-/dev/stdout}

# The shared release workflow publishes <package.json version, patch bumped>-pre.<run number>
name=$(node -p "require('./package.json').name")
current=$(node -p "require('./package.json').version")
version="$(npx --yes semver@7.6.3 -i patch "$current")-pre.${run_number}"
deadline=$((SECONDS + wait_seconds))

# The per-version document is served uncached, but appears some minutes after the publish step returns
while true; do
  status=$(curl -s -o /dev/null -w '%{http_code}' "https://registry.npmjs.org/${name/\//%2F}/${version}")
  case "$status" in
    200) echo "${name}@${version} is published"; break ;;
    404) ;;
    *) echo "::error::Could not ask npm whether ${name}@${version} is published: HTTP ${status}"; exit 1 ;;
  esac
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "::error::npm does not serve ${name}@${version} after ${wait_seconds} seconds: the publish failed, or npm is slower than that"
    exit 1
  fi
  echo "npm does not serve ${version} yet; waiting"
  sleep 10
done

# openmrs assemble resolves next from the package document, which npm serves from a cache that lags a publish
while true; do
  if next=$(npm view "${name}@next" version --prefer-online); then
    if [ "$next" = "$version" ]; then
      echo "npm next serves ${version}"
      break
    fi
    if [ "${next%-pre.*}" = "${version%-pre.*}" ] && [ "${next##*-pre.}" -gt "$run_number" ] 2>/dev/null; then
      echo "npm next already serves the later ${next}; its own run triggers the distro build"
      echo "published=false" >> "$output"
      exit 0
    fi
  else
    next="unknown (npm view failed)"
  fi
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "::error::${name}@${version} is published, but npm next still serves ${next} after ${wait_seconds} seconds"
    exit 1
  fi
  echo "npm next serves ${next}; waiting for ${version}"
  sleep 10
done

echo "published=true" >> "$output"
