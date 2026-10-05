#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
test_dir="$(mktemp -d /private/tmp/throughline-row-support-tests.XXXXXX)"
trap 'rm -rf "$test_dir"' EXIT
python3 - "$test_dir/support.swift" <<'PY'
from pathlib import Path
import sys
source = Path('ios/Throughline/Views/RunningListView.swift').read_text()
start = source.index('@MainActor private final class RunningRowActions')
end = source.index('private struct RunningTaskRow:', start)
assert '.onAppear {\n            configureRowActions()' in source
assert '.onDisappear { settling.clear(); rowActions.clear() }' in source
assert 'private func rows(_ rows: [RunningListRow]) -> some View {\n        configureRowActions()' in source
Path(sys.argv[1]).write_text('import Foundation\n' + source[start:end] + Path('ios/Tests/RunningListRowSupportTests.swift').read_text())
PY
xcrun swiftc -module-cache-path "$test_dir/modules" \
  ios/Throughline/Models/ThroughlineNote.swift \
  ios/Throughline/Models/TaskOccurrence.swift \
  ios/Throughline/Models/RunningListProjection.swift \
  "$test_dir/support.swift" -o "$test_dir/tests"
"$test_dir/tests"
