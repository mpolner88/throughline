import Foundation

@main
struct ThroughlineNoteActionItemTests {
    static func main() {
        let note = ThroughlineNote(
            id: "rec_actionable_test",
            createdAt: Date(timeIntervalSince1970: 0),
            type: .morning,
            title: "Plan the day",
            summary: "The user wants to feel more organized.",
            transcript: "I want to feel more organized, and I need to call the dentist.",
            mostImportant: ["The user wants to feel more organized"],
            actionItems: [
                ActionItem(text: "The user wants to feel more organized", source: "most_important"),
                ActionItem(text: "Call the dentist", source: "todo")
            ],
            todos: [
                Todo(text: "Call the dentist", priority: "high", due: nil, forDate: nil, context: nil)
            ],
            priorities: [],
            intentions: [],
            accomplishments: [],
            tomorrowTodos: [],
            mood: .focused,
            tags: [],
            people: [],
            projects: [],
            centersOfBalance: []
        )

        let displayed = note.displayImportantActionItems.map { ($0.text, $0.source) }
        let expected = [("Call the dentist", "todo")]
        guard displayed.elementsEqual(expected, by: ==) else {
            FileHandle.standardError.write(
                Data("Expected only the explicit todo, got: \(displayed)\n".utf8)
            )
            exit(1)
        }
    }
}
