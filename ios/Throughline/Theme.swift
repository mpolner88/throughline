import SwiftUI

enum Theme {
    static let blue = Color(red: 37 / 255, green: 99 / 255, blue: 235 / 255)
    static let liftedBlue = Color(red: 59 / 255, green: 130 / 255, blue: 246 / 255)
    static let pillBackground = Color(red: 239 / 255, green: 246 / 255, blue: 255 / 255)
    static let pillText = Color(red: 30 / 255, green: 58 / 255, blue: 140 / 255)
    static let border = Color.primary.opacity(0.14)
    static let secondaryText = Color.secondary
    static let cardRadius: CGFloat = 8
}

extension Font {
    static var throughlineTitle: Font {
        .system(size: 48, weight: .medium, design: .default)
    }

    static var throughlineHeading: Font {
        .system(size: 30, weight: .medium, design: .default)
    }
}

