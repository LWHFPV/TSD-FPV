import json
import unittest
from catalog_probe import parse_catalog, official, DETAIL

def sample(**changes):
    data = {"identifier":"15120580","url":DETAIL,"creator":{"name":"산림청"},"dateModified":"2026-09-04","encodingFormat":"CSV"}
    data.update(changes)
    return json.dumps(data).encode()

class TestCatalog(unittest.TestCase):
    def test_metadata_only(self):
        result = parse_catalog(sample())
        self.assertEqual(result["catalogModified"], "2026-09-04")
        self.assertIsNone(result["asOf"])
        self.assertFalse(result["sourceCrsVerified"])
        self.assertFalse(result["coverageComplete"])
        self.assertEqual(result["occurrenceDataStatus"], "not_collected")
    def test_wrong_id(self):
        with self.assertRaises(ValueError): parse_catalog(sample(identifier="other"))
    def test_wrong_source(self):
        with self.assertRaises(ValueError): parse_catalog(sample(url="https://example.org/"))
    def test_wrong_format(self):
        with self.assertRaises(ValueError): parse_catalog(sample(encodingFormat="HTML"))
    def test_invalid_date(self):
        with self.assertRaises(ValueError): parse_catalog(sample(dateModified="invalid"))
    def test_link_filter(self):
        result = parse_catalog(sample(distribution=[{"contentUrl":"https://www.data.go.kr/example.csv"},{"contentUrl":"https://example.org/example.csv"}]))
        self.assertEqual(result["candidateDistributionUrls"], ["https://www.data.go.kr/example.csv"])
    def test_host_lookalike(self):
        self.assertFalse(official("https://www.data.go.kr.example.org/file"))
        self.assertFalse(official("https://www.data.go.kr@example.org/file"))
        self.assertFalse(official("http://www.data.go.kr/file"))

if __name__ == "__main__":
    unittest.main()
