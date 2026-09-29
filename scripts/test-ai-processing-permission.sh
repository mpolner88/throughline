#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
test_dir="$(mktemp -d "${TMPDIR:-/tmp}/throughline-permission.XXXXXX")"
trap 'rm -rf "$test_dir"' EXIT
cd "$repo_dir"
xcrun swiftc -module-cache-path "$test_dir/modules" \
  ios/Throughline/Models/ThroughlineNote.swift \
  ios/Throughline/Services/ProductEventAttribution.swift \
  ios/Throughline/Services/EvaluationContributionContract.swift \
  ios/Throughline/Services/AIProcessingPermission.swift \
  ios/Throughline/Services/UploadClient.swift \
  ios/Tests/AIProcessingPermissionTests.swift \
  -o "$test_dir/tests"
"$test_dir/tests"
