import tempfile
from unittest.mock import MagicMock, patch

import pytest
from langchain.docstore.document import Document

from core.text_processor import TextProcessor


class TestTextProcessor:
    """
    Test suite for the TextProcessor class.
    """

    @patch("core.text_processor.TokenTextSplitter")
    def test_split_text(self, mock_splitter_class):
        """Test splitting text into chunks."""
        # Setup mock
        mock_splitter_instance = MagicMock()
        mock_splitter_class.from_tiktoken_encoder.return_value = mock_splitter_instance

        # Test with a simple text
        short_text = "This is a short text that should not be split."
        mock_splitter_instance.split_text.return_value = [short_text]

        chunks = TextProcessor.split_text(short_text, chunk_size=100, chunk_overlap=0)

        # Verify the mock was called correctly
        mock_splitter_class.from_tiktoken_encoder.assert_called_once_with(
            chunk_size=100, chunk_overlap=0
        )
        mock_splitter_instance.split_text.assert_called_once_with(short_text)

        # Verify results
        assert len(chunks) == 1
        assert chunks[0] == short_text

        # Test with multiple chunks
        mock_splitter_instance.reset_mock()
        long_text = " ".join(["word"] * 1000)
        mock_splitter_instance.split_text.return_value = ["chunk1", "chunk2", "chunk3"]

        chunks = TextProcessor.split_text(long_text, chunk_size=500, chunk_overlap=100)

        # Verify results
        assert len(chunks) > 1
        assert chunks == ["chunk1", "chunk2", "chunk3"]

    @patch("core.text_processor.TextProcessor.split_text")
    def test_text_to_documents(self, mock_split_text):
        """Test converting text to Document objects."""
        # Setup mock
        mock_split_text.return_value = ["Chunk 1", "Chunk 2"]

        # Test text_to_documents
        text = "This is a sample text for testing document conversion."
        documents = TextProcessor.text_to_documents(
            text, chunk_size=1000, chunk_overlap=50
        )

        # Verify mock was called correctly
        mock_split_text.assert_called_once_with(text, 1000, 50)

        # Verify results
        assert len(documents) == 2
        assert all(isinstance(doc, Document) for doc in documents)
        assert documents[0].page_content == "Chunk 1"
        assert documents[1].page_content == "Chunk 2"

    @patch("core.text_processor.PdfReader")
    def test_pdf_to_text(self, mock_pdf_reader):
        """Test converting PDF to text."""
        # Mock the PdfReader and its pages
        mock_page1 = MagicMock()
        mock_page1.extract_text.return_value = "Page 1 content."
        mock_page2 = MagicMock()
        mock_page2.extract_text.return_value = "Page 2 content."

        mock_reader_instance = MagicMock()
        mock_reader_instance.pages = [mock_page1, mock_page2]
        mock_pdf_reader.return_value = mock_reader_instance

        # Create a mock PDF file
        pdf_file = "mock_pdf.pdf"

        # Call the method
        text = TextProcessor.pdf_to_text(pdf_file)

        # Assertions
        mock_pdf_reader.assert_called_once_with(pdf_file)
        assert text == "Page 1 content.Page 2 content."

    def test_pdf_to_text_error_handling(self):
        """Test error handling in pdf_to_text method."""
        # Create a non-PDF file to trigger an error
        with tempfile.NamedTemporaryFile(suffix=".txt") as non_pdf_file:
            non_pdf_file.write(b"This is not a PDF file")
            non_pdf_file.flush()

            # The method should raise a ValueError
            with pytest.raises(ValueError) as excinfo:
                TextProcessor.pdf_to_text(non_pdf_file.name)

            assert "Failed to extract text from PDF" in str(excinfo.value)

    @patch("core.text_processor.TextProcessor.pdf_to_text")
    @patch("core.text_processor.TextProcessor.text_to_documents")
    def test_pdf_to_documents(self, mock_text_to_documents, mock_pdf_to_text):
        """Test converting PDF to Document objects."""
        # Setup mocks
        mock_pdf_to_text.return_value = "Extracted text from PDF."
        mock_text_to_documents.return_value = [
            Document(page_content="Extracted text from PDF.")
        ]

        # Create a mock PDF file
        pdf_file = "mock_pdf.pdf"

        # Call the method
        documents = TextProcessor.pdf_to_documents(
            pdf_file, chunk_size=1000, chunk_overlap=50
        )

        # Assertions
        mock_pdf_to_text.assert_called_once_with(pdf_file)
        mock_text_to_documents.assert_called_once_with(
            "Extracted text from PDF.", 1000, 50
        )
        assert len(documents) == 1
        assert documents[0].page_content == "Extracted text from PDF."
