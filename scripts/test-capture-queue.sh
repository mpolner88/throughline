#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
test_dir="$(mktemp -d /private/tmp/throughline-capture-queue.XXXXXX)"
trap 'rm -rf "$test_dir"' EXIT
# Keep coordinator control flow byte-identical. Replace only platform imports and
# its default storage constructor with an isolated test directory. Adapters never
# contact a backend, modify credentials or invoke real recording/account deletion.
python3 - "$test_dir/CaptureQueue.swift" <<'TRANSFORM'
from pathlib import Path
import sys
source = Path("ios/Throughline/Services/CaptureQueue.swift").read_text()
for framework in ["AVFoundation", "Network", "UIKit"]:
    source = source.replace("import " + framework + "\n", "")
needle = "store = try CaptureStore()"
assert source.count(needle) == 1
source = source.replace(needle, "store = try CaptureStore(directory: CaptureHarness.directory)")
Path(sys.argv[1]).write_text(source)
TRANSFORM
xcrun swiftc -swift-version 6 -D DEBUG -module-cache-path "$test_dir/modules" \
  ios/Throughline/Models/ThroughlineNote.swift \
  ios/Throughline/Models/CaptureRecord.swift \
  ios/Throughline/Services/ProductEventAttribution.swift \
  ios/Throughline/Services/CaptureStore.swift \
  "$test_dir/CaptureQueue.swift" \
  ios/Tests/CaptureQueueHarness.swift -o "$test_dir/tests"
"$test_dir/tests"
python3 - "$test_dir/AuthSessionRefresher.swift" <<'TRANSFORM'
from pathlib import Path
import sys
source = Path("ios/Throughline/Services/AuthClient.swift").read_text()
start = source.index("actor AuthSessionRefresher {")
end = source.index("\nenum AuthConfiguration {", start)
Path(sys.argv[1]).write_text("import Foundation\n" + source[start:end])
TRANSFORM
xcrun swiftc -swift-version 6 -module-cache-path "$test_dir/modules" \
  "$test_dir/AuthSessionRefresher.swift" ios/Tests/CaptureAuthHarness.swift -o "$test_dir/auth-tests"
"$test_dir/auth-tests"
