#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
test_dir="$(mktemp -d /private/tmp/throughline-running-list-tests.XXXXXX)"
trap 'rm -rf "$test_dir"' EXIT
xcrun swiftc -D DEBUG -module-cache-path "$test_dir/modules" \
  ios/Throughline/Models/ThroughlineNote.swift \
  ios/Throughline/Models/TaskOccurrence.swift \
  ios/Throughline/Models/RunningListProjection.swift \
  ios/Throughline/Services/TaskStore.swift \
  ios/Throughline/Services/TaskTransport.swift \
  ios/Throughline/Services/TaskCoordinator.swift \
  ios/Tests/TaskCoordinatorTests.swift -o "$test_dir/tests"
"$test_dir/tests"
