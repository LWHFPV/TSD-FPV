import io
import pathlib
import tempfile
import unittest
import zipfile
from inspect_download import inspect_download

HEADER = "지역 X 좌표,지역 Y 좌표,감염목 구분\n"
class TestDownloadInspection(unittest.TestCase):
    def check_file(self, data, suffix=".bin"):
        with tempfile.TemporaryDirectory() as tmp:
            p=pathlib.Path(tmp)/("source"+suffix)
            p.write_bytes(data)
            return inspect_download(p)
    def test_plain_extensionless(self):
        r=self.check_file(HEADER.encode("utf-8-sig"))
        self.assertTrue(r["schemaVerified"])
        self.assertEqual(r["container"],"plain")
    def test_cp949(self):
        self.assertEqual(self.check_file(HEADER.encode("cp949"))["encodingCandidate"],"cp949")
    def test_zip(self):
        b=io.BytesIO()
        with zipfile.ZipFile(b,"w",zipfile.ZIP_DEFLATED) as z:
            z.writestr("nested/data.csv",HEADER.encode("utf-8"))
        r=self.check_file(b.getvalue(),".zip")
        self.assertEqual(r["container"],"zip")
        self.assertTrue(r["schemaVerified"])
    def test_html_rejected(self):
        with self.assertRaises(ValueError): self.check_file(b"<html>not a CSV</html>")
    def test_multiple_csv_rejected(self):
        b=io.BytesIO()
        with zipfile.ZipFile(b,"w") as z:
            for n in ("a.csv","b.csv"): z.writestr(n,HEADER.encode("utf-8"))
        with self.assertRaises(ValueError): self.check_file(b.getvalue(),".zip")
    def test_missing_coordinate_rejected(self):
        with self.assertRaises(ValueError): self.check_file("지역X좌표,감염목구분\n".encode())
if __name__=="__main__":
    unittest.main()
