"""Shared simplified directory tree for access control tests."""

TEST_TREE = [
    {
        "shortname": "RIT",
        "name": "IT-Referat",
        "children": [
            {
                "shortname": "ITM",
                "name": "ITM",
                "children": [
                    {
                        "shortname": "ITM-KM",
                        "name": "ITM-KM",
                        "children": [
                            {
                                "shortname": "ITM-KM-DI",
                                "name": "ITM-KM-DI",
                                "children": [],
                            },
                            {
                                "shortname": "ITM-KM-TEAM1",
                                "name": "ITM-KM-TEAM1",
                                "children": [],
                            },
                        ],
                    },
                    {"shortname": "ITM-AB", "name": "ITM-AB", "children": []},
                    {
                        "shortname": "ITM-SPECIFIC",
                        "name": "ITM-SPECIFIC",
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
        "shortname": "POR",
        "name": "Personal- und Organisationsreferat",
        "children": [
            {
                "shortname": "POR-5",
                "name": "POR-5",
                "children": [
                    {
                        "shortname": "POR-5/1",
                        "name": "POR-5/1",
                        "children": [
                            {
                                "shortname": "POR-5/12",
                                "name": "POR-5/12",
                                "children": [],
                            },
                            {
                                "shortname": "POR-5/14",
                                "name": "POR-5/14",
                                "children": [],
                            },
                        ],
                    },
                    {"shortname": "POR-5-AB", "name": "POR-5-AB", "children": []},
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
        "shortname": "ORG",
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
    {"shortname": "HR-DEPT", "name": "HR-DEPT", "children": []},
    {"shortname": "FINANCE", "name": "FINANCE", "children": []},
]
