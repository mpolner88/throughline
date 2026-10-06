#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
test_dir="$(mktemp -d /private/tmp/throughline-row-swipe-tests.XXXXXX)"
trap 'rm -rf "$test_dir"' EXIT
xcrun swiftc -module-cache-path "$test_dir/modules" \
  ios/Throughline/Views/RunningRowSwipeGesture.swift \
  ios/Throughline/Models/HomeLayoutBudget.swift \
  ios/Tests/RunningRowSwipeTests.swift -o "$test_dir/tests"
"$test_dir/tests"
