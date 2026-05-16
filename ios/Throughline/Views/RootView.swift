import SwiftUI

struct RootView: View {
    @StateObject private var appState = AppState()

    var body: some View {
        Group {
            switch appState.route {
            case .onboarding:
                OnboardingView()
            case .home:
                HomeView()
            }
        }
        .environmentObject(appState)
    }
}

