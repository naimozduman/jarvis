"""Regression boundaries for the documentation writer, with disposable data."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

loader = importlib.util.spec_from_file_location('canonical_docs', Path(__file__).parents[1] / 'manage.py')
manage = importlib.util.module_from_spec(loader)
loader.loader.exec_module(manage)

class DocumentWriteBoundaries(unittest.TestCase):
    def test_source_cannot_redirect_writer_to_compatibility_or_external_path(self):
        for destination in ['docs/PRD.md', '../outside.md', '/tmp/overwritten.md']:
            with self.subTest(destination=destination), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                (root / 'governance').mkdir()
                (root / manage.SPEC).write_text(json.dumps({
                    'canonicalProductSource': manage.SPEC,
                    'generatedReference': destination,
                    'sections': []
                }), encoding='utf-8')
                with self.assertRaises(ValueError):
                    manage.render(root)
                self.assertFalse((root / 'docs').exists())

    def test_inventory_cannot_read_credentials_or_escape_root(self):
        with tempfile.TemporaryDirectory() as directory:
            for relative in ['.env', 'governance/private.pem', '../private.txt', '.git/config']:
                with self.subTest(relative=relative), self.assertRaises(ValueError):
                    manage.safe(Path(directory), relative)

    def test_duplicate_requirement_cannot_silently_replace_a_requirement(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'governance').mkdir()
            requirement = {'id': 'REQ-ONE', 'requirement': 'Preserve', 'acceptance': 'Proof'}
            (root / manage.SPEC).write_text(json.dumps({
                'canonicalProductSource': manage.SPEC,
                'generatedReference': manage.PRD,
                'sections': [{'title': 'One', 'origin': 'fixture', 'intent': 'fixture',
                              'requirements': [requirement, requirement]}]
            }), encoding='utf-8')
            with self.assertRaises(ValueError):
                manage.render(root)
            self.assertFalse((root / manage.PRD).exists())

if __name__ == '__main__':
    unittest.main()
