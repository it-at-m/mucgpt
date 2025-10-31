import uuid
from typing import Callable, Optional
from xml.dom import minidom
from xml.etree import ElementTree as ET

from agent.tools.bpmn_models import ProcessStructure


class BPMNGenerator:
    """Generates BPMN 2.0 XML from structured process data."""

    BPMN_NS = "http://www.omg.org/spec/BPMN/20100524/MODEL"
    BPMNDI_NS = "http://www.omg.org/spec/BPMN/20100524/DI"
    DC_NS = "http://www.omg.org/spec/DD/20100524/DC"
    DI_NS = "http://www.omg.org/spec/DD/20100524/DI"

    def __init__(self):
        self.x_spacing = 200
        self.y_spacing = 100
        self._reset_runtime_state()

    def _notify(self, message: str):
        if self._callback:
            self._callback(message)

    def generate(
        self,
        process_structure: ProcessStructure,
        callback: Optional[Callable[[str], None]] = None,
    ) -> str:
        """Generate BPMN XML from ProcessStructure."""

        # Reset runtime state to avoid leaking positions between runs
        self._reset_runtime_state()
        self._callback = callback
        self._notify("👷 Starte BPMN-Strukturaufbau...")

        # Register namespaces
        ET.register_namespace("bpmn", self.BPMN_NS)
        ET.register_namespace("bpmndi", self.BPMNDI_NS)
        ET.register_namespace("dc", self.DC_NS)
        ET.register_namespace("di", self.DI_NS)

        # Create root definitions element
        definitions = ET.Element(
            f"{{{self.BPMN_NS}}}definitions",
            attrib={
                "id": f"Definitions_{uuid.uuid4().hex[:8]}",
                "targetNamespace": "http://bpmn.io/schema/bpmn",
            },
        )

        # Create process element
        process_id = f"Process_{uuid.uuid4().hex[:8]}"
        process = ET.SubElement(
            definitions,
            f"{{{self.BPMN_NS}}}process",
            attrib={"id": process_id, "isExecutable": "false"},
        )

        # Add process elements
        for step in process_structure.steps:
            self._notify(f"   • Element: {step.step_type.upper()} → {step.step_id}")
            self._add_step_element(process, step)

        # Add sequence flows
        for flow in process_structure.flows:
            self._notify(
                f"   ↳ Verbindung: {flow.from_step} → {flow.to_step}"
                + (f" [{flow.condition}]" if flow.condition else "")
            )
            self._add_sequence_flow(process, flow)

        # Add BPMNDiagram
        self._add_diagram(definitions, process_id)
        self._notify("📐 Diagramm-Metadaten erstellt")

        # Convert to pretty-printed string
        xml_string = ET.tostring(definitions, encoding="unicode")
        dom = minidom.parseString(xml_string)
        self._notify("✅ BPMN-XML fertiggestellt")
        return dom.toprettyxml(indent="  ")

    def _reset_runtime_state(self):
        """Reset transient state for each BPMN generation."""
        self.element_positions: dict[str, dict[str, float]] = {}
        self.sequence_flows: list[dict[str, str]] = []
        self.current_y = 100
        self.current_x = 100
        self._callback: Optional[Callable[[str], None]] = None

    def _add_step_element(self, process, step):
        """Add a BPMN element based on step type."""
        element_id = step.step_id

        if step.step_type == "event":
            if step.event_type == "start":
                element = ET.SubElement(
                    process,
                    f"{{{self.BPMN_NS}}}startEvent",
                    attrib={"id": element_id, "name": step.name},
                )
            elif step.event_type == "end":
                element = ET.SubElement(
                    process,
                    f"{{{self.BPMN_NS}}}endEvent",
                    attrib={"id": element_id, "name": step.name},
                )
            else:
                element = ET.SubElement(
                    process,
                    f"{{{self.BPMN_NS}}}intermediateThrowEvent",
                    attrib={"id": element_id, "name": step.name},
                )

        elif step.step_type == "gateway":
            if step.gateway_type == "exclusive":
                element = ET.SubElement(
                    process,
                    f"{{{self.BPMN_NS}}}exclusiveGateway",
                    attrib={"id": element_id, "name": step.name},
                )
            elif step.gateway_type == "parallel":
                element = ET.SubElement(
                    process,
                    f"{{{self.BPMN_NS}}}parallelGateway",
                    attrib={"id": element_id, "name": step.name},
                )
            else:
                element = ET.SubElement(
                    process,
                    f"{{{self.BPMN_NS}}}inclusiveGateway",
                    attrib={"id": element_id, "name": step.name},
                )

        else:  # task
            element = ET.SubElement(
                process,
                f"{{{self.BPMN_NS}}}task",
                attrib={"id": element_id, "name": step.name},
            )

        # Add documentation if description exists
        if step.description:
            doc = ET.SubElement(element, f"{{{self.BPMN_NS}}}documentation")
            doc.text = step.description

        # Calculate and store position for diagram
        self._calculate_position(element_id, step.step_type)

    def _add_sequence_flow(self, process, flow):
        """Add a sequence flow between two elements."""
        flow_id = f"Flow_{uuid.uuid4().hex[:8]}"
        attribs = {
            "id": flow_id,
            "sourceRef": flow.from_step,
            "targetRef": flow.to_step,
        }

        if flow.condition:
            attribs["name"] = flow.condition

        ET.SubElement(process, f"{{{self.BPMN_NS}}}sequenceFlow", attrib=attribs)

        self.sequence_flows.append(
            {
                "id": flow_id,
                "from": flow.from_step,
                "to": flow.to_step,
            }
        )

    def _calculate_position(self, element_id, step_type):
        """Calculate position for visual diagram."""
        self.element_positions[element_id] = {
            "x": self.current_x,
            "y": self.current_y,
            "width": 100 if step_type == "task" else 36,
            "height": 80 if step_type == "task" else 36,
        }
        self.current_x += self.x_spacing

    def _add_diagram(self, definitions, process_id):
        """Add BPMN diagram information for visualization."""
        diagram = ET.SubElement(
            definitions,
            f"{{{self.BPMNDI_NS}}}BPMNDiagram",
            attrib={"id": f"BPMNDiagram_{uuid.uuid4().hex[:8]}"},
        )

        plane = ET.SubElement(
            diagram,
            f"{{{self.BPMNDI_NS}}}BPMNPlane",
            attrib={
                "id": f"BPMNPlane_{uuid.uuid4().hex[:8]}",
                "bpmnElement": process_id,
            },
        )

        # Add shapes for each step
        for element_id, pos in self.element_positions.items():
            shape = ET.SubElement(
                plane,
                f"{{{self.BPMNDI_NS}}}BPMNShape",
                attrib={
                    "id": f"{element_id}_di",
                    "bpmnElement": element_id,
                },
            )
            ET.SubElement(
                shape,
                f"{{{self.DC_NS}}}Bounds",
                attrib={
                    "x": str(pos["x"]),
                    "y": str(pos["y"]),
                    "width": str(pos["width"]),
                    "height": str(pos["height"]),
                },
            )

        # Add edges for flows
        for flow_meta in self.sequence_flows:
            from_id = flow_meta["from"]
            to_id = flow_meta["to"]
            if from_id in self.element_positions and to_id in self.element_positions:
                shape = ET.SubElement(
                    plane,
                    f"{{{self.BPMNDI_NS}}}BPMNEdge",
                    attrib={
                        "id": f"{flow_meta['id']}_di",
                        "bpmnElement": flow_meta["id"],
                    },
                )
                ET.SubElement(
                    shape,
                    f"{{{self.DI_NS}}}waypoint",
                    attrib={
                        "x": str(
                            self.element_positions[from_id]["x"]
                            + self.element_positions[from_id]["width"]
                        ),
                        "y": str(
                            self.element_positions[from_id]["y"]
                            + self.element_positions[from_id]["height"] / 2
                        ),
                    },
                )
                ET.SubElement(
                    shape,
                    f"{{{self.DI_NS}}}waypoint",
                    attrib={
                        "x": str(self.element_positions[to_id]["x"]),
                        "y": str(
                            self.element_positions[to_id]["y"]
                            + self.element_positions[to_id]["height"] / 2
                        ),
                    },
                )
