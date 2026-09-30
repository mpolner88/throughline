import SwiftUI

struct TodoRowsEditor: View {
    @Binding var rows: [TodoEditRow]
    @FocusState private var focusedID: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Eyebrow(text: "to-dos")
            VStack(spacing: 0) {
                ForEach($rows) { $row in
                    HStack(alignment: .top, spacing: 8) {
                        TextField("New to-do", text: $row.text, axis: .vertical)
                            .font(.body).textFieldStyle(.plain).lineLimit(1...20)
                            .focused($focusedID, equals: row.id)
                            .submitLabel(.next)
                            .onSubmit { advance(after: row.id) }
                            .onChange(of: row.text) { _, value in
                                if value.contains("\n") {
                                    row.text = value.replacingOccurrences(of: "\n", with: " ")
                                    advance(after: row.id)
                                }
                            }
                            .accessibilityLabel("To-do")
                            .padding(.vertical, 12)
                        if row.isCompleted {
                            Text("done").font(.caption).foregroundStyle(.secondary)
                                .padding(.horizontal, 7).padding(.vertical, 3)
                                .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 6))
                                .padding(.top, 12)
                        }
                        Button {
                            rows.removeAll { $0.id == row.id }
                        } label: {
                            Image(systemName: "minus.circle").font(.title3).foregroundStyle(.secondary)
                                .frame(width: 44, height: 44)
                        }.buttonStyle(.plain)
                            .accessibilityLabel("Remove to-do: \(row.text.isEmpty ? "New to-do" : row.text)")
                    }.padding(.leading, 12).padding(.trailing, 2)
                    Divider()
                }
                Button {
                    addRow()
                } label: {
                    Text("+ Add a to-do").font(.body).foregroundStyle(Theme.blue)
                        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                        .padding(.horizontal, 12)
                }.buttonStyle(.plain)
            }
            .overlay { RoundedRectangle(cornerRadius: 8).stroke(Theme.border, lineWidth: 0.5) }
        }
    }
    private func addRow() {
        let row = TodoEditRow(newText: "")
        rows.append(row)
        focusedID = row.id
    }
    private func advance(after id: String) {
        guard let index = rows.firstIndex(where: { $0.id == id }) else { return }
        if index + 1 < rows.count { focusedID = rows[index + 1].id }
        else { addRow() }
    }
}
