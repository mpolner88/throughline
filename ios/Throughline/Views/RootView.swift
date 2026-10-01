import SwiftUI

struct RootView: View {
    @StateObject private var appState = AppState()

    var body: some View {
        Group {
            #if DEBUG
            if ProcessInfo.processInfo.arguments.contains("--throughline-preview-ai-settings") {
                AccountSettingsView()
            } else if ProcessInfo.processInfo.arguments.contains("--throughline-preview-feedback") {
                ProductFeedbackView()
            } else {
                routedContent
            }
            #else
            routedContent
            #endif
        }
        .environmentObject(appState)
        .environmentObject(appState.captureQueue)
        .environmentObject(appState.captureQueue.recorder)
        .task {
            #if DEBUG
            if ProcessInfo.processInfo.arguments.contains(where: { $0.hasPrefix("--throughline-preview-") }) { return }
            #endif
            let route = appState.route == .home ? "home" : "onboarding"
            ProductAnalytics.trackFirstOpen(route: route)
            ProductAnalytics.track(
                "app_opened",
                properties: ["route": route]
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
