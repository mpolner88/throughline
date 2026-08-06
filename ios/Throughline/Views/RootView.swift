import SwiftUI

struct RootView: View {
    @StateObject private var appState = AppState()

    var body: some View {
        Group {
            #if DEBUG
            if ProcessInfo.processInfo.arguments.contains("--throughline-preview-feedback") {
                ProductFeedbackView()
            } else {
                routedContent
            }
            #else
            routedContent
            #endif
        }
        .environmentObject(appState)
        .task {
            ProductAnalytics.track(
                "app_opened",
                properties: ["route": appState.route == .home ? "home" : "onboarding"]
            )
            ProductAnalytics.flush()
        }
    }

    @ViewBuilder
    private var routedContent: some View {
        switch appState.route {
        case .onboarding:
            OnboardingView()
        case .home:
            HomeView()
        }
    }
}
