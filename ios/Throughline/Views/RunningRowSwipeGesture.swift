import Foundation
import CoreGraphics

/// One decision per touch sequence. Vertical/leftward intent never becomes a task completion later.
struct RunningRowSwipeIntent {
    enum Direction { case pending, right, rejected }
    private(set) var direction: Direction = .pending
    private(set) var translation: CGSize = .zero
    static let recognitionDistance: CGFloat = 12
    static let completionDistance: CGFloat = 76

    mutating func update(_ translation: CGSize) {
        self.translation = translation
        guard direction == .pending,
              max(abs(translation.width), abs(translation.height)) >= Self.recognitionDistance else { return }
        // Ambiguous diagonal movement belongs to scrolling, not to a task mutation.
        direction = translation.width > abs(translation.height) * 1.2 ? .right : .rejected
    }

    var offset: CGFloat {
        direction == .right ? min(max(translation.width, 0), Self.completionDistance + 18) : 0
    }
    var completes: Bool {
        direction == .right && translation.width >= Self.completionDistance
            && translation.width > abs(translation.height)
    }
    mutating func cancel() { direction = .rejected; translation = .zero }
}

#if canImport(UIKit)
import SwiftUI
import UIKit

/// Unlike a SwiftUI DragGesture's updating closure, failure here releases the vertical scroll recognizer.
struct RunningRowSwipeGesture: UIGestureRecognizerRepresentable {
    var onChange: (CGFloat) -> Void
    var onEnd: (Bool) -> Void

    func makeUIGestureRecognizer(context: Context) -> RunningRowSwipeRecognizer {
        RunningRowSwipeRecognizer()
    }

    func handleUIGestureRecognizerAction(_ recognizer: RunningRowSwipeRecognizer, context: Context) {
        switch recognizer.state {
        case .began, .changed: onChange(recognizer.intent.offset)
        case .ended: onEnd(recognizer.intent.completes)
        case .cancelled, .failed: onEnd(false)
        default: break
        }
    }
}

final class RunningRowSwipeRecognizer: UIGestureRecognizer, UIGestureRecognizerDelegate {
    private(set) var intent = RunningRowSwipeIntent()
    private var origin: CGPoint = .zero
    private var trackedTouch: UITouch?

    init() {
        super.init(target: nil, action: nil)
        delegate = self
        cancelsTouchesInView = true
        delaysTouchesBegan = false
        delaysTouchesEnded = false
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        // A touch on a moving list belongs to native stop/re-flick behavior, not task actions.
        // Fail immediately so our direction dependency adds no delay while decelerating.
        guard !enclosingScrollIsMoving,
              trackedTouch == nil, touches.count == 1, let touch = touches.first else {
            cancelRecognition()
            return
        }
        trackedTouch = touch
        // The row moves while dragging. Window coordinates keep that motion out of the measured gesture.
        origin = touch.location(in: view?.window)
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
        guard let touch = trackedTouch, touches.contains(touch) else { return }
        update(touch)
        if state == .possible {
            switch intent.direction {
            case .pending: break
            case .right: state = .began
            case .rejected: state = .failed
            }
        } else if state == .began || state == .changed {
            state = .changed
        }
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) {
        guard let touch = trackedTouch, touches.contains(touch) else { return }
        update(touch)
        state = (state == .began || state == .changed) ? .ended : .failed
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) {
        cancelRecognition()
    }

    override func reset() {
        super.reset()
        intent = RunningRowSwipeIntent()
        trackedTouch = nil
        origin = .zero
    }

    private var enclosingScrollIsMoving: Bool {
        var ancestor = view
        while let current = ancestor {
            if let scroll = current as? UIScrollView, scroll.isDecelerating || scroll.isDragging { return true }
            ancestor = current.superview
        }
        return false
    }

    private func update(_ touch: UITouch) {
        let location = touch.location(in: view?.window)
        intent.update(CGSize(width: location.x - origin.x, height: location.y - origin.y))
    }

    private func cancelRecognition() {
        intent.cancel()
        state = (state == .began || state == .changed) ? .cancelled : .failed
    }

    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer,
                           shouldBeRequiredToFailBy otherGestureRecognizer: UIGestureRecognizer) -> Bool {
        // The enclosing scroll view waits only through the short direction decision. A vertical start
        // immediately fails this recognizer; a rightward start owns the swipe without also scrolling.
        guard let scroll = otherGestureRecognizer.view as? UIScrollView else { return false }
        return otherGestureRecognizer === scroll.panGestureRecognizer
    }
}
#endif
