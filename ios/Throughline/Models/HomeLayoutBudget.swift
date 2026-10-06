import CoreGraphics

/// Bound the scrollable capture tray after accounting for the actual header and recorder.
enum HomeLayoutBudget {
    private static let footerSpacing: CGFloat = 43 // 12 top + 22 bottom + 9 between tray and recorder.
    static func minimumHeight(header: CGFloat, recorder: CGFloat) -> CGFloat {
        header + recorder + footerSpacing + 44 + 180
    }
    static func captureTrayHeight(available: CGFloat, header: CGFloat, recorder: CGFloat) -> CGFloat {
        let listViewport = min(280, available * 0.4)
        let remaining = available - header - recorder - footerSpacing - listViewport
        return max(44, min(available / 2, remaining))
    }
}
