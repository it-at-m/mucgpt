"""Shared simplified directory tree for access control tests."""

TEST_TREE = [
    {
        "shortname": "ORG",
        "name": "Organization",
        "children": [
            {
                "shortname": "DEPT",
                "name": "DEPT",
                "children": [
                    {
                        "shortname": "DEPT-TEAM",
                        "name": "DEPT-TEAM",
                        "children": [
                            {
                                "shortname": "DEPT-TEAM-UNIT",
                                "name": "DEPT-TEAM-UNIT",
                                "children": [],
                            },
                            {
                                "shortname": "DEPT-TEAM-ALPHA",
                                "name": "DEPT-TEAM-ALPHA",
                                "children": [],
                            },
                        ],
                    },
                    {"shortname": "DEPT-OTHER", "name": "DEPT-OTHER", "children": []},
                    {
                        "shortname": "DEPT-SPECIFIC",
                        "name": "DEPT-SPECIFIC",
                        "children": [],
                    },
                ],
            }
        ],
    },
    {
        "shortname": "IT",
        "name": "IT",
        "children": [
            {
                "shortname": "IT-Test",
                "name": "IT-Test",
                "children": [
                    {
                        "shortname": "IT-Test-Department",
                        "name": "IT-Test-Department",
                        "children": [
                            {
                                "shortname": "IT-Test-Department-SubTeam",
                                "name": "IT-Test-Department-SubTeam",
                                "children": [],
                            }
                        ],
                    }
                ],
            },
            {"shortname": "IT-Support", "name": "IT-Support", "children": []},
            {
                "shortname": "IT-DEV",
                "name": "IT-DEV",
                "children": [
                    {
                        "shortname": "IT-DEV-FRONTEND",
                        "name": "IT-DEV-FRONTEND",
                        "children": [],
                    }
                ],
            },
            {
                "shortname": "IT/DEV",
                "name": "IT/DEV",
                "children": [
                    {
                        "shortname": "IT/DEV/FRONTEND",
                        "name": "IT/DEV/FRONTEND",
                        "children": [],
                    }
                ],
            },
            {
                "shortname": "IT-TEAM",
                "name": "IT-TEAM",
                "children": [
                    {
                        "shortname": "IT-TEAM-MEMBER",
                        "name": "IT-TEAM-MEMBER",
                        "children": [],
                    }
                ],
            },
            {"shortname": "IT-T", "name": "IT-T", "children": []},
        ],
    },
    {
        "shortname": "DIVISION",
        "name": "Division",
        "children": [
            {
                "shortname": "DIVISION-5",
                "name": "DIVISION-5",
                "children": [
                    {
                        "shortname": "DIVISION-5/1",
                        "name": "DIVISION-5/1",
                        "children": [
                            {
                                "shortname": "DIVISION-5/12",
                                "name": "DIVISION-5/12",
                                "children": [],
                            },
                            {
                                "shortname": "DIVISION-5/14",
                                "name": "DIVISION-5/14",
                                "children": [],
                            },
                        ],
                    },
                    {
                        "shortname": "DIVISION-5-OTHER",
                        "name": "DIVISION-5-OTHER",
                        "children": [],
                    },
                ],
            }
        ],
    },
    {
        "shortname": "HR",
        "name": "HR",
        "children": [
            {"shortname": "HR-DEPT", "name": "HR-DEPT", "children": []},
            {"shortname": "HR-Test", "name": "HR-Test", "children": []},
            {
                "shortname": "HR/RECRUITING",
                "name": "HR/RECRUITING",
                "children": [
                    {
                        "shortname": "HR/RECRUITING/SENIOR",
                        "name": "HR/RECRUITING/SENIOR",
                        "children": [],
                    }
                ],
            },
            {"shortname": "HR/FINANCE", "name": "HR/FINANCE", "children": []},
        ],
    },
    {"shortname": "FINANCE", "name": "FINANCE", "children": []},
    {
        "shortname": "MARKETING",
        "name": "MARKETING",
        "children": [
            {
                "shortname": "MARKETING-DIGITAL",
                "name": "MARKETING-DIGITAL",
                "children": [],
            }
        ],
    },
    {
        "shortname": "ORG-SECOND",
        "name": "ORG",
        "children": [
            {
                "shortname": "ORG-DEPT",
                "name": "ORG-DEPT",
                "children": [
                    {
                        "shortname": "ORG-DEPT-TEAM",
                        "name": "ORG-DEPT-TEAM",
                        "children": [
                            {
                                "shortname": "ORG-DEPT-TEAM-GROUP-SUBGROUP",
                                "name": "ORG-DEPT-TEAM-GROUP-SUBGROUP",
                                "children": [],
                            }
                        ],
                    }
                ],
            }
        ],
    },
    {
        "shortname": "DEPT.123",
        "name": "DEPT.123",
        "children": [
            {
                "shortname": "DEPT.123-SUBTEAM",
                "name": "DEPT.123-SUBTEAM",
                "children": [],
            }
        ],
    },
    {"shortname": "DEPT_SPECIAL#", "name": "DEPT_SPECIAL#", "children": []},
    *[
        {"shortname": f"DEPT-{i}", "name": f"DEPT-{i}", "children": []}
        for i in range(20)
    ],
]
