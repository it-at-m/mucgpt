"""Unit tests for the path_matcher module."""

from src.database.path_matcher import path_matches_department


class TestPathMatcher:
    """Test cases for the path matching logic."""

    def test_exact_match(self):
        """Test exact path matching."""
        assert path_matches_department("ITM-KM", "ITM-KM")
        assert path_matches_department("POR-5/12", "POR-5/12")

    def test_hierarchical_dash_match(self):
        """Test hierarchical matching with dash delimiter."""
        assert path_matches_department("ITM", "ITM-KM")
        assert path_matches_department("ITM-KM", "ITM-KM-DI")
        assert path_matches_department("ITM", "ITM-KM-DI")

    def test_hierarchical_slash_match(self):
        """Test hierarchical matching with slash delimiter."""
        assert path_matches_department("IT/DEV", "IT/DEV/FRONTEND")
        assert path_matches_department("IT/DEV/TEST", "IT/DEV/TEST/BLUB/BLA")

    def test_numeric_slash_prefix_match(self):
        """Test numeric prefix matching with slash delimiter."""
        assert path_matches_department("POR-5/1", "POR-5/12")
        assert path_matches_department("POR-5/1", "POR-5/14")
        assert path_matches_department("POR-5/1", "POR-5/1")

    def test_mixed_delimiters(self):
        """Test paths with both slash and dash delimiters."""
        assert path_matches_department("POR-5", "POR-5/12")
        assert path_matches_department("POR-5", "POR-5/1")
        assert path_matches_department("POR-5", "POR-5-AB")
        assert path_matches_department("POR-5", "POR-5/5-AB")

    def test_no_match(self):
        """Test cases that should not match."""
        assert not path_matches_department("ITM-KM", "ITM-AB")
        assert not path_matches_department("IT/DEV", "HR/RECRUITING")
        assert not path_matches_department("POR-5/2", "POR-5/12")
        assert not path_matches_department("POR-6", "POR-5/12")

    def test_empty_access_path(self):
        """Test that empty access path matches everything."""
        assert path_matches_department("", "ANY-DEPT")
        assert path_matches_department("", "ANY-DEPT/6-12")
        # None is converted to empty string, which matches everything
        assert path_matches_department("", "")

    def test_no_match_different_branches(self):
        """Test that different branches don't match."""
        assert not path_matches_department("ITM-KM", "ITM-AB-DI")
        assert not path_matches_department("IT-T", "IT-TEAM-MEMBER")

    def test_case_sensitivity(self):
        """Test that matching is case-sensitive."""
        assert not path_matches_department("itm-km", "ITM-KM")
        assert not path_matches_department("ITM-KM", "itm-km-di")

    def test_numeric_non_prefix_no_match(self):
        """Test that non-prefix numeric values don't match."""
        assert not path_matches_department("POR-5/2", "POR-5/12")
        assert not path_matches_department("POR-5/3", "POR-5/1")

    def test_deep_hierarchical_match(self):
        """Test deeply nested hierarchical paths."""
        assert path_matches_department("ORG", "ORG-DEPT-TEAM-GROUP")
        assert path_matches_department("ORG-DEPT", "ORG-DEPT-TEAM-GROUP")
        assert path_matches_department("ORG-DEPT-TEAM", "ORG-DEPT-TEAM-GROUP")

    def test_special_characters_in_paths(self):
        """Test paths with special characters."""
        assert path_matches_department("DEPT.123", "DEPT.123")
        assert path_matches_department("DEPT.123", "DEPT.123-SUBTEAM")
        assert path_matches_department("DEPT_SPECIAL#", "DEPT_SPECIAL#")
