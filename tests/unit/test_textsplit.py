import os
import unittest

import pytest

from core.textsplit import PDFtoDocs, splitPDF, splitText, textToDocs


class Test_Testsplit(unittest.TestCase):

    @pytest.mark.asyncio    
    @pytest.mark.unit
    def test_textToDocs(self):
        text = "Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet."
        self.assertEqual(len(textToDocs(text, 100, 10)), 3)

    @pytest.mark.asyncio    
    @pytest.mark.unit
    def test_PDFtoDocs(self):
        file_path = os.path.join('app', 'frontend', 'src', 'assets', 'mucgpt_cheatsheet.pdf')
        file_path = os.path.abspath(file_path)
        assert os.path.exists(file_path), "File does not exist"
        self.assertEqual(len(PDFtoDocs(file_path)), 2)

    @pytest.mark.asyncio    
    @pytest.mark.unit
    def test_splitText(self):
        text = "Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet."
        self.assertEqual(len(splitText(text, 100, 10)), 3)

    @pytest.mark.asyncio    
    @pytest.mark.unit
    def test_splitPDF(self):
        file_path = os.path.join('app', 'frontend', 'src', 'assets', 'mucgpt_cheatsheet.pdf')
        file_path = os.path.abspath(file_path)
        assert os.path.exists(file_path), "File does not exist"
        self.assertEqual(len(splitPDF(file_path)), 2)