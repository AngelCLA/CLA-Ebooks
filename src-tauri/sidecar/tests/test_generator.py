import importlib
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

generator = importlib.import_module("generator")


class SafeNameTests(unittest.TestCase):
    def test_normalizes_characters_for_paths(self) -> None:
        self.assertEqual(generator.safe_name("  Memoria anual / 2026  "), "Memoria-anual-2026")


class DestinationTests(unittest.TestCase):
    def test_existing_output_directory_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            output = Path(temporary_directory) / "ebook"
            output.mkdir()

            with self.assertRaisesRegex(FileExistsError, "carpeta de destino ya existe"):
                generator.ensure_new_destination(output)

    def test_existing_zip_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            output = Path(temporary_directory) / "ebook"
            output.with_suffix(".zip").touch()

            with self.assertRaisesRegex(FileExistsError, "archivo ZIP de destino ya existe"):
                generator.ensure_new_destination(output)


if __name__ == "__main__":
    unittest.main()
