import unittest

import pytest
from sqlalchemy import Engine

from core.datahelper import Repository, Requestinfo


class Test_Datahelper(unittest.TestCase):
    @pytest.mark.asyncio    
    @pytest.mark.unit
    def test_requestinfo_creation(self):
        request = Requestinfo(tokencount=100, department='IT', messagecount=50, method='GET')
        self.assertIsInstance(request, Requestinfo)
        self.assertEqual(request.tokencount, 100)
        self.assertEqual(request.department, 'IT')
        self.assertEqual(request.messagecount, 50)
        self.assertEqual(request.method, 'GET')
        self.assertEqual(str(request), '<ID None, Department \'IT\', Tokencount 100, Method \'GET\', Messagecount 50>')
    
    @pytest.mark.asyncio    
    @pytest.mark.unit
    def test_repository_creation(self):
        repo = Repository("user", "host", "database", "password")
        self.assertIsInstance(repo, Repository)
        self.assertIsInstance(repo.engine, Engine)
    
    