package com.diagramstudio;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public record DiagramDocument(String title, List<Node> nodes, List<Scenario> scenarios) {
    public record Node(String id, String label, Double x, Double y, String notes) {}
    public record Scenario(String name, List<String> steps, String description, List<String> review) {}

    public DiagramDocument validate() {
        check(title == null || title.length() <= 80, "Project title is too long.");
        check(nodes != null && nodes.size() <= 250, "A diagram supports up to 250 nodes.");
        check(scenarios != null && !scenarios.isEmpty() && scenarios.size() <= 100, "A diagram needs 1–100 scenarios.");
        Set<String> ids = new HashSet<>();
        for (Node node : nodes) {
            check(node != null && text(node.id(), 100) && text(node.label(), 48), "Every node needs an ID and label.");
            check(ids.add(node.id()), "Node IDs must be unique.");
            check(node.x() != null && node.y() != null && Double.isFinite(node.x()) && Double.isFinite(node.y()) && node.x() >= 0 && node.x() <= 100 && node.y() >= 0 && node.y() <= 100, "Node positions must be within the canvas.");
            check(node.notes() == null || node.notes().length() <= 2000, "Node notes are too long.");
        }
        for (Scenario scenario : scenarios) {
            check(scenario != null && text(scenario.name(), 48), "Every scenario needs a name.");
            check(scenario.steps() != null && scenario.steps().size() <= 500 && scenario.steps().stream().allMatch(ids::contains), "Scenario steps must refer to existing nodes (maximum 500).");
            check(scenario.description() == null || scenario.description().length() <= 2000, "Scenario description is too long.");
            check(scenario.review() == null || (scenario.review().size() <= 100 && scenario.review().stream().allMatch(s -> text(s, 500))), "Invalid review notes.");
        }
        return this;
    }
    public String displayTitle() { return title == null || title.isBlank() ? "Untitled Diagram" : title.trim(); }
    public DiagramDocument published() {
        return new DiagramDocument(title, nodes, scenarios.stream().map(s -> new Scenario(s.name(), s.steps(), s.description(), null)).toList());
    }
    private static boolean text(String value, int max) { return value != null && !value.isBlank() && value.length() <= max; }
    private static void check(boolean condition, String message) {
        if (!condition) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
