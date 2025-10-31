import logging
from typing import List, Optional
from xml.etree import ElementTree as ET


class BPMNValidationError:
    """Represents a validation error in BPMN."""

    def __init__(self, severity: str, message: str, element_id: Optional[str] = None):
        self.severity = severity  # "error" or "warning"
        self.message = message
        self.element_id = element_id

    def __repr__(self):
        if self.element_id:
            return (
                f"[{self.severity.upper()}] {self.message} (Element: {self.element_id})"
            )
        return f"[{self.severity.upper()}] {self.message}"


class BPMNValidator:
    """Validates BPMN 2.0 XML structure and semantics."""

    BPMN_NS = "{http://www.omg.org/spec/BPMN/20100524/MODEL}"

    def __init__(self, logger: logging.Logger):
        self.logger = logger
        self.errors: List[BPMNValidationError] = []

    def validate(self, bpmn_xml: str) -> tuple[bool, List[BPMNValidationError]]:
        """
        Validate BPMN XML.
        Returns (is_valid, list_of_errors).
        """
        self.errors = []

        try:
            root = ET.fromstring(bpmn_xml)
        except ET.ParseError as e:
            self.errors.append(
                BPMNValidationError("error", f"XML parsing error: {str(e)}")
            )
            return False, self.errors

        # Find process element
        process = root.find(f".//{self.BPMN_NS}process")
        if process is None:
            self.errors.append(BPMNValidationError("error", "No process element found"))
            return False, self.errors

        # Validate structure
        self._validate_start_events(process)
        self._validate_end_events(process)
        self._validate_sequence_flows(process)
        self._validate_gateways(process)
        self._validate_connectivity(process)

        # Check if there are any errors (not just warnings)
        has_errors = any(err.severity == "error" for err in self.errors)
        is_valid = not has_errors

        return is_valid, self.errors

    def _validate_start_events(self, process):
        """Ensure process has at least one start event."""
        start_events = process.findall(f".//{self.BPMN_NS}startEvent")
        if len(start_events) == 0:
            self.errors.append(
                BPMNValidationError(
                    "error", "Process must have at least one start event"
                )
            )
        elif len(start_events) > 1:
            self.errors.append(
                BPMNValidationError(
                    "warning",
                    f"Process has {len(start_events)} start events (multiple start events may be valid in some cases)",
                )
            )

    def _validate_end_events(self, process):
        """Ensure process has at least one end event."""
        end_events = process.findall(f".//{self.BPMN_NS}endEvent")
        if len(end_events) == 0:
            self.errors.append(
                BPMNValidationError("error", "Process must have at least one end event")
            )

    def _validate_sequence_flows(self, process):
        """Validate sequence flows reference existing elements."""
        flows = process.findall(f".//{self.BPMN_NS}sequenceFlow")
        all_elements = self._get_all_element_ids(process)

        for flow in flows:
            flow_id = flow.get("id")
            source_ref = flow.get("sourceRef")
            target_ref = flow.get("targetRef")

            if not source_ref:
                self.errors.append(
                    BPMNValidationError(
                        "error",
                        "Sequence flow missing sourceRef",
                        flow_id,
                    )
                )
            elif source_ref not in all_elements:
                self.errors.append(
                    BPMNValidationError(
                        "error",
                        f"Sequence flow references non-existent source: {source_ref}",
                        flow_id,
                    )
                )

            if not target_ref:
                self.errors.append(
                    BPMNValidationError(
                        "error",
                        "Sequence flow missing targetRef",
                        flow_id,
                    )
                )
            elif target_ref not in all_elements:
                self.errors.append(
                    BPMNValidationError(
                        "error",
                        f"Sequence flow references non-existent target: {target_ref}",
                        flow_id,
                    )
                )

    def _validate_gateways(self, process):
        """Validate gateway usage."""
        gateways = (
            process.findall(f".//{self.BPMN_NS}exclusiveGateway")
            + process.findall(f".//{self.BPMN_NS}parallelGateway")
            + process.findall(f".//{self.BPMN_NS}inclusiveGateway")
        )

        for gateway in gateways:
            gateway_id = gateway.get("id")
            incoming = self._count_incoming_flows(process, gateway_id)
            outgoing = self._count_outgoing_flows(process, gateway_id)

            if incoming == 0:
                self.errors.append(
                    BPMNValidationError(
                        "warning",
                        "Gateway has no incoming flows",
                        gateway_id,
                    )
                )

            if outgoing < 2:
                self.errors.append(
                    BPMNValidationError(
                        "warning",
                        "Gateway should have at least 2 outgoing flows",
                        gateway_id,
                    )
                )

    def _validate_connectivity(self, process):
        """Check that all elements are connected in the flow."""
        all_elements = self._get_all_element_ids(process)
        start_events = [
            e.get("id") for e in process.findall(f".//{self.BPMN_NS}startEvent")
        ]

        if not start_events:
            return

        # Simple reachability check from start events
        reachable = set()
        to_visit = list(start_events)

        while to_visit:
            current = to_visit.pop()
            if current in reachable:
                continue
            reachable.add(current)

            # Find outgoing flows
            for flow in process.findall(f".//{self.BPMN_NS}sequenceFlow"):
                if flow.get("sourceRef") == current:
                    target = flow.get("targetRef")
                    if target and target not in reachable:
                        to_visit.append(target)

        # Check for unreachable elements
        unreachable = all_elements - reachable
        if unreachable:
            for elem_id in unreachable:
                self.errors.append(
                    BPMNValidationError(
                        "warning",
                        "Element is not reachable from any start event",
                        elem_id,
                    )
                )

    def _get_all_element_ids(self, process) -> set:
        """Get all element IDs in the process."""
        element_types = [
            "startEvent",
            "endEvent",
            "task",
            "userTask",
            "serviceTask",
            "exclusiveGateway",
            "parallelGateway",
            "inclusiveGateway",
            "intermediateThrowEvent",
            "intermediateCatchEvent",
        ]

        ids = set()
        for elem_type in element_types:
            for elem in process.findall(f".//{self.BPMN_NS}{elem_type}"):
                elem_id = elem.get("id")
                if elem_id:
                    ids.add(elem_id)

        return ids

    def _count_incoming_flows(self, process, element_id: str) -> int:
        """Count incoming sequence flows for an element."""
        count = 0
        for flow in process.findall(f".//{self.BPMN_NS}sequenceFlow"):
            if flow.get("targetRef") == element_id:
                count += 1
        return count

    def _count_outgoing_flows(self, process, element_id: str) -> int:
        """Count outgoing sequence flows for an element."""
        count = 0
        for flow in process.findall(f".//{self.BPMN_NS}sequenceFlow"):
            if flow.get("sourceRef") == element_id:
                count += 1
        return count
