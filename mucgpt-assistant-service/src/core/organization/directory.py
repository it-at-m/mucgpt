from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Iterable, Sequence


@dataclass
class OrganizationNode:
    """Represents a single organization unit within a tree."""

    id: str
    name: str
    dn: str
    parent_id: str | None = None
    attributes: dict[str, Any] = field(default_factory=dict)
    children: list[OrganizationNode] = field(default_factory=list)

    def add_child(self, child: OrganizationNode) -> None:
        self.children.append(child)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "dn": self.dn,
            "parent_id": self.parent_id,
            "attributes": self.attributes,
            "children": [child.to_dict() for child in self.children],
        }


@dataclass
class DepartmentDirectory:
    """Holds the organization tree and provides helper utilities."""

    roots: list[OrganizationNode]
    source: str
    generated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def as_flat_list(self) -> list[str]:
        """Return a depth-first flattened list of department names."""

        names: list[str] = []

        def _walk(nodes: Iterable[OrganizationNode]) -> None:
            for node in nodes:
                names.append(node.name)
                _walk(node.children)

        _walk(self.roots)
        return names

    def iter_nodes(self) -> Iterable[OrganizationNode]:
        def _walk(node: OrganizationNode) -> Iterable[OrganizationNode]:
            yield node
            for child in node.children:
                yield from _walk(child)

        for root in self.roots:
            yield from _walk(root)

    @property
    def node_count(self) -> int:
        return sum(1 for _ in self.iter_nodes())

    @classmethod
    def from_flat_list(
        cls, departments: Sequence[str], source: str = "static-json"
    ) -> DepartmentDirectory:
        nodes = [
            OrganizationNode(
                id=f"static::{index}",
                name=name,
                dn=name,
                parent_id=None,
                attributes={"source": source},
                children=[],
            )
            for index, name in enumerate(departments)
        ]
        return cls(roots=nodes, source=source)


class OrganizationTreeBuilder:
    """Builds a hierarchy of organization nodes based on LDAP entries."""

    def __init__(
        self,
        *,
        display_attribute: str = "ou",
        parent_attribute: str | None = None,
        search_base: str | None = None,
        ignored_prefixes: Sequence[str] | None = None,
        ignored_suffixes: Sequence[str] | None = None,
        required_attributes: Sequence[str] | None = None,
    ) -> None:
        self.display_attribute = display_attribute
        self.parent_attribute = parent_attribute
        self.search_base = search_base.lower() if search_base else None
        self.ignored_prefixes = self._normalize_patterns(ignored_prefixes)
        self.ignored_suffixes = self._normalize_patterns(ignored_suffixes)
        self.required_attributes = tuple(
            (value or "").strip().lower()
            for value in (required_attributes or [])
            if (value or "").strip()
        )

    def build(self, entries: Sequence[dict[str, Any]]) -> list[OrganizationNode]:
        nodes: dict[str, OrganizationNode] = {}
        for entry in entries:
            if not self._has_required_attributes(entry.get("attributes") or {}):
                continue
            node = self._build_node(entry)
            nodes[node.id] = node

        # If no explicit parent attribute is provided, ensure the DN chain exists
        # by creating placeholder parent nodes up to the search base (if set).
        if not self.parent_attribute:
            for node in list(nodes.values()):
                self._ensure_parent_chain(node, nodes)

        roots = self._link_nodes(nodes)

        ignore_cache: dict[str, bool] = {}
        return self._filter_ignored_nodes(roots, nodes, ignore_cache)

    def sort_children(self, roots: list[OrganizationNode]) -> None:
        def _sort(node: OrganizationNode) -> None:
            node.children.sort(key=lambda c: c.name.lower())
            for child in node.children:
                _sort(child)

        for root in roots:
            _sort(root)

    def _build_node(self, entry: dict[str, Any]) -> OrganizationNode:
        dn = str(entry.get("dn") or entry.get("entry_dn") or "").strip()
        if not dn:
            raise ValueError("LDAP entry is missing a distinguishedName (dn)")
        attributes = self._sanitize_attributes(entry.get("attributes") or {})
        node_id = self._normalize_dn(dn)
        name = self._extract_display_name(dn, attributes)
        parent_id = self._determine_parent_identifier(dn, attributes)
        return OrganizationNode(
            id=node_id,
            name=name,
            dn=dn,
            parent_id=parent_id,
            attributes=attributes,
        )

    def _sanitize_attributes(self, attributes: dict[str, Any]) -> dict[str, Any]:
        sanitized: dict[str, Any] = {}
        for key, value in attributes.items():
            sanitized[key] = self._sanitize_value(value)
        return sanitized

    def _sanitize_value(self, value: Any) -> Any:
        if isinstance(value, bytes):
            return value.decode("utf-8", errors="ignore")
        if isinstance(value, (list, tuple, set)):
            return [self._sanitize_value(v) for v in value]
        return value

    def _extract_display_name(self, dn: str, attributes: dict[str, Any]) -> str:
        value = attributes.get(self.display_attribute)
        if isinstance(value, list) and value:
            value = value[0]
        if isinstance(value, str) and value.strip():
            return value.strip()
        return self._extract_rdn_value(dn)

    def _determine_parent_identifier(
        self, dn: str, attributes: dict[str, Any]
    ) -> str | None:
        if self.parent_attribute:
            parent_value = attributes.get(self.parent_attribute)
            if isinstance(parent_value, list) and parent_value:
                parent_value = parent_value[0]
            if isinstance(parent_value, str) and parent_value.strip():
                return self._normalize_dn(parent_value)
        return self._parent_from_dn(dn)

    def _parent_from_dn(self, dn: str) -> str | None:
        parts = [part.strip() for part in dn.split(",") if part.strip()]
        if len(parts) <= 1:
            return None
        parent_dn = ",".join(parts[1:])
        normalized_parent = self._normalize_dn(parent_dn)
        if self.search_base and not normalized_parent.endswith(self.search_base):
            return None
        return normalized_parent

    def _extract_rdn_value(self, dn: str) -> str:
        first = dn.split(",", 1)[0]
        if "=" in first:
            return first.split("=", 1)[1].strip()
        return first.strip()

    def _normalize_dn(self, dn: str | None) -> str:
        if dn is None:
            return ""
        return dn.strip().lower()

    def _normalize_patterns(self, patterns: Sequence[str] | None) -> tuple[str, ...]:
        if not patterns:
            return ()
        normalized: list[str] = []
        for value in patterns:
            cleaned = (value or "").strip().lower()
            if cleaned:
                normalized.append(cleaned)
        return tuple(normalized)

    def _matches_ignore_rule(self, name: str) -> bool:
        if not (self.ignored_prefixes or self.ignored_suffixes):
            return False

        normalized = name.strip().lower()
        if not normalized:
            return False

        return any(
            normalized.startswith(prefix) for prefix in self.ignored_prefixes
        ) or any(normalized.endswith(suffix) for suffix in self.ignored_suffixes)

    def _is_ignored_node(
        self,
        node_id: str,
        nodes: dict[str, OrganizationNode],
        cache: dict[str, bool],
    ) -> bool:
        if node_id in cache:
            return cache[node_id]

        node = nodes[node_id]
        ignore = self._matches_ignore_rule(node.name)
        if not ignore and node.parent_id and node.parent_id in nodes:
            ignore = self._is_ignored_node(node.parent_id, nodes, cache)

        cache[node_id] = ignore
        return ignore

    def _filter_ignored_nodes(
        self,
        roots: list[OrganizationNode],
        nodes: dict[str, OrganizationNode],
        cache: dict[str, bool],
    ) -> list[OrganizationNode]:
        def _filter(node: OrganizationNode) -> OrganizationNode | None:
            if self._is_ignored_node(node.id, nodes, cache):
                return None

            filtered_children: list[OrganizationNode] = []
            for child in node.children:
                filtered_child = _filter(child)
                if filtered_child is not None:
                    filtered_children.append(filtered_child)

            node.children = filtered_children
            return node

        filtered_roots: list[OrganizationNode] = []
        for root in roots:
            filtered_root = _filter(root)
            if filtered_root is not None:
                filtered_roots.append(filtered_root)

        return filtered_roots

    def _ensure_parent_chain(
        self, node: OrganizationNode, nodes: dict[str, OrganizationNode]
    ) -> None:
        parts = [part.strip() for part in node.dn.split(",") if part.strip()]
        if len(parts) <= 1:
            return

        # Walk upward through the DN, creating placeholders where missing
        current_parts = parts[1:]
        while current_parts:
            parent_dn = ",".join(current_parts)
            parent_id = self._normalize_dn(parent_dn)

            # Respect search_base if provided
            if self.search_base and not parent_id.endswith(self.search_base):
                break

            if parent_id not in nodes:
                grand_parent_id = (
                    self._normalize_dn(",".join(current_parts[1:]))
                    if len(current_parts) > 1
                    else None
                )
                nodes[parent_id] = OrganizationNode(
                    id=parent_id,
                    name=self._extract_rdn_value(parent_dn),
                    dn=parent_dn,
                    parent_id=grand_parent_id,
                    attributes={},
                )

            current_parts = current_parts[1:]

    def _has_required_attributes(self, attributes: dict[str, Any]) -> bool:
        if not self.required_attributes:
            return True

        normalized_keys = {key.strip().lower(): key for key in attributes.keys() if key}
        for required in self.required_attributes:
            original_key = normalized_keys.get(required)
            value = attributes.get(original_key) if original_key else None
            if value is None:
                return False
            if isinstance(value, (list, tuple, set)):
                if not value:
                    return False
                # ensure at least one non-empty string/bytes value exists
                has_content = False
                for item in value:
                    if isinstance(item, bytes):
                        item = item.decode("utf-8", errors="ignore")
                    if isinstance(item, str) and item.strip():
                        has_content = True
                        break
                if not has_content:
                    return False
            elif isinstance(value, bytes):
                if not value.decode("utf-8", errors="ignore").strip():
                    return False
            elif isinstance(value, str):
                if not value.strip():
                    return False
        return True

    def _link_nodes(self, nodes: dict[str, OrganizationNode]) -> list[OrganizationNode]:
        roots: list[OrganizationNode] = []
        for node in nodes.values():
            if node.parent_id and node.parent_id in nodes:
                nodes[node.parent_id].add_child(node)
            else:
                roots.append(node)
        roots.sort(key=lambda item: item.name.lower())
        return roots
