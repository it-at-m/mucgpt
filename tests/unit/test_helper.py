import unittest

import pytest

from core.helper import format_as_ndjson


class Test_Helper(unittest.TestCase):
    
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_format_as_ndjson(self):
        async def gen():
            yield {"a": "I ❤️ 🐍"}
            yield {"b": "Newlines inside \n strings are fine"}

        result = [line async for line in format_as_ndjson(gen())]
        assert result == ['{"a": "I ❤️ 🐍"}\n', '{"b": "Newlines inside \\n strings are fine"}\n']


if __name__ == '__main__':
    unittest.main()