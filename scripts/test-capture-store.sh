#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
test_dir="$(mktemp -d /private/tmp/throughline-capture-tests.XXXXXX)"
trap 'rm -rf "$test_dir"' EXIT
xcrun swiftc -module-cache-path "$test_dir/modules" \
  ios/Throughline/Models/ThroughlineNote.swift \
  ios/Throughline/Models/CaptureRecord.swift \
  ios/Throughline/Services/ProductEventAttribution.swift \
  ios/Throughline/Services/CaptureStore.swift \
  ios/Tests/CaptureStoreTests.swift -o "$test_dir/tests"
"$test_dir/tests"
xcrun swiftc -module-cache-path "$test_dir/modules" \
  ios/Throughline/Services/AIProcessingPermission.swift \
  ios/Tests/CaptureStreamTests.swift -o "$test_dir/stream-tests"
"$test_dir/stream-tests"
