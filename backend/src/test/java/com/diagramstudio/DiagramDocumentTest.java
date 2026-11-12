package com.diagramstudio;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

class DiagramDocumentTest {
    private DiagramDocument.Node node(String id) { return new DiagramDocument.Node(id,"Node",50.0,50.0,null); }
    @Test void acceptsRepeatedStepsAndEmptyGraphs() {
        assertDoesNotThrow(() -> new DiagramDocument("Loop",List.of(node("a")),List.of(new DiagramDocument.Scenario("Retry",List.of("a","a"),null,null))).validate());
        assertDoesNotThrow(() -> new DiagramDocument(null,List.of(),List.of(new DiagramDocument.Scenario("Empty",List.of(),null,null))).validate());
    }
    @Test void rejectsMissingReferencesAndDuplicateIds() {
        assertThrows(ResponseStatusException.class,() -> new DiagramDocument(null,List.of(node("a")),List.of(new DiagramDocument.Scenario("Broken",List.of("b"),null,null))).validate());
        assertThrows(ResponseStatusException.class,() -> new DiagramDocument(null,List.of(node("a"),node("a")),List.of(new DiagramDocument.Scenario("Empty",List.of(),null,null))).validate());
    }
    @Test void rejectsInvalidCoordinatesAndMissingScenarios() {
        assertThrows(ResponseStatusException.class,() -> new DiagramDocument(null,List.of(new DiagramDocument.Node("a","Node",Double.NaN,50.0,null)),List.of(new DiagramDocument.Scenario("Path",List.of("a"),null,null))).validate());
        assertThrows(ResponseStatusException.class,() -> new DiagramDocument(null,List.of(new DiagramDocument.Node("a","Node",null,50.0,null)),List.of(new DiagramDocument.Scenario("Path",List.of("a"),null,null))).validate());
        assertThrows(ResponseStatusException.class,() -> new DiagramDocument(null,List.of(),List.of()).validate());
    }
    @Test void publishingStripsReviewNotesAndPreservesExplanations() {
        var document = new DiagramDocument("Title",List.of(node("a")),List.of(new DiagramDocument.Scenario("Path",List.of("a"),"Explanation",List.of("Private review"))));
        var published = document.published();
        assertNull(published.scenarios().getFirst().review());
        assertEquals("Explanation",published.scenarios().getFirst().description());
        assertEquals(1,document.scenarios().getFirst().review().size());
    }
}
