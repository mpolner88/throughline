import Foundation

@main struct RunningRowSwipeTests {
    static func main() {
        func trace(_ samples: [CGSize]) -> RunningRowSwipeIntent {
            var intent = RunningRowSwipeIntent()
            for sample in samples { intent.update(sample) }
            return intent
        }
        func point(_ x: CGFloat, _ y: CGFloat = 0) -> CGSize { CGSize(width: x, height: y) }
        let tiny = trace([point(2), point(9, 3)])
        precondition(tiny.direction == .pending && tiny.offset == 0 && !tiny.completes)
        print("PASS taps and small finger motion do not begin a swipe")
        for first in [point(0, 12), point(3, -20), point(-15), point(12, 12), point(12, -11)] {
            let intent = trace([first, point(140, 30)])
            precondition(intent.direction == .rejected && intent.offset == 0 && !intent.completes)
        }
        print("PASS vertical, left and ambiguous diagonal starts cannot become completion")
        for distance in [12.0, 45, 75.9] {
            let intent = trace([point(15, 2), point(distance, 4)])
            precondition(intent.direction == .right && !intent.completes)
        }
        let full = trace([point(15, 2), point(76, 4)])
        precondition(full.completes && full.offset == 76)
        let beyond = trace([point(15), point(300)])
        precondition(beyond.completes && beyond.offset == 94)
        print("PASS 76-point release threshold and bounded visual offset")
        let reversed = trace([point(20), point(90), point(-8)])
        precondition(reversed.direction == .right && reversed.offset == 0 && !reversed.completes)
        let turnedVertical = trace([point(20), point(85, 110)])
        precondition(!turnedVertical.completes)
        print("PASS reversing or finishing vertically cancels completion")
        var cancelled = full
        cancelled.cancel()
        cancelled.update(point(150))
        precondition(cancelled.direction == .rejected && !cancelled.completes && cancelled.offset == 0)
        cancelled = RunningRowSwipeIntent()
        cancelled.update(point(80))
        precondition(cancelled.completes)
        print("PASS cancellation stays terminal until a fresh touch sequence")
        // Repeated sweeps cover boundary and sign combinations, including a vertical-first curved path.
        for x in stride(from: -100.0, through: 100, by: 5) {
            for y in stride(from: -100.0, through: 100, by: 5) {
                let candidate = trace([point(x, y)])
                if candidate.completes { precondition(x >= 76 && x > abs(y) * 1.2) }
                let verticalFirst = trace([point(1, 15), point(x, y)])
                precondition(!verticalFirst.completes && verticalFirst.offset == 0)
            }
        }
        print("PASS 1681 direction/threshold combinations and vertical-first paths")
        for available in [550.0, 620, 760, 900] {
            for header in [70.0, 90, 110] {
                for recorder in [100.0, 190, 240] {
                    let tray = HomeLayoutBudget.captureTrayHeight(available: available, header: header, recorder: recorder)
                    precondition(tray >= 44 && tray <= available / 2)
                    let visibleList = available - header - recorder - 43 - tray
                    precondition(visibleList >= min(160, available - header - recorder - 87))
                }
            }
        }
        let idleTray = HomeLayoutBudget.captureTrayHeight(available: 760, header: 78, recorder: 126)
        let recordingTray = HomeLayoutBudget.captureTrayHeight(available: 760, header: 78, recorder: 190)
        precondition(recordingTray < idleTray)
        print("PASS full capture trays preserve list space as screen/header/recorder sizes change")
        for actualHeight in [220.0, 320, 550, 900] {
            for recorder in [126.0, 190, 400, 600] {
                let layoutHeight = max(actualHeight, HomeLayoutBudget.minimumHeight(header: 110, recorder: recorder))
                let tray = HomeLayoutBudget.captureTrayHeight(available: layoutHeight, header: 110, recorder: recorder)
                precondition(layoutHeight - 110 - recorder - 43 - tray >= 180)
            }
        }
        print("PASS constrained-height fallback keeps at least 180 points of scrollable list")
    }
}
