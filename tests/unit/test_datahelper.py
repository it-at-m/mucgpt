import unittest

import pytest

from core.datahelper import Requestinfo


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