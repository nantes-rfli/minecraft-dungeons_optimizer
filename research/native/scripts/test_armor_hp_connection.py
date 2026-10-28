"""Reject drift, unknown erasure and accidental promotion in the HP study."""
import copy
import gzip
import json
from pathlib import Path
import tempfile
import unittest

import check_armor_hp_connection as check


class ArmorHpConnectionTests(unittest.TestCase):
    def setUp(self):
        self.report = check.read_json(check.ROOT, check.ARTIFACT)

    def test_public_sources_and_existing_identity(self):
        check.validate_public(check.ROOT, self.report)

    def test_unknown_cannot_be_replaced_with_zero_or_supported(self):
        for key in check.LIMITS:
            for value in (0, 1, 'supported', 'verified'):
                with self.subTest(key=key, value=value):
                    report = copy.deepcopy(self.report)
                    report['limits'][key] = value
                    with self.assertRaises(ValueError):
                        check.validate_public(check.ROOT, report)

    def test_no_runtime_or_calculable_equipment_claim(self):
        for key, value in [('runtimePromotion', True), ('applicationImpact', True),
                           ('newCalculableEquipment', ['mercenary-armor']),
                           ('status', 'accepted')]:
            report = copy.deepcopy(self.report)
            report[key] = value
            with self.assertRaises(ValueError):
                check.validate_public(check.ROOT, report)

    def test_constructor_default_cannot_become_effective_hp(self):
        self.report['facts']['constructorDefaultIsEffectivePlayerBase'] = True
        with self.assertRaises(ValueError):
            check.validate_public(check.ROOT, self.report)

    def test_new_formula_cannot_use_limited_reuse_or_skip_adoption(self):
        for key, value in [('route', 'limited-reuse'), ('decision', 'accepted'),
                           ('eligibility', 'eligible'), ('productRegression', 'passed')]:
            report = copy.deepcopy(self.report)
            report['adoption'][key] = value
            with self.assertRaises(ValueError):
                check.validate_public(check.ROOT, report)

    def test_drifted_or_missing_native_evidence(self):
        for mutation in ('hash', 'span', 'binary'):
            report = copy.deepcopy(self.report)
            if mutation == 'hash':
                report['nativeSpans'][0]['sha256'] = 'not-a-hash'
            elif mutation == 'span':
                report['nativeSpans'].pop()
            else:
                report['binarySha256'] = '0' * 64
            with self.assertRaises(ValueError):
                check.validate_public(check.ROOT, report)

    def test_private_image_mismatch_is_rejected_before_decode(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            capture = root / check.CAPTURE
            capture.mkdir(parents=True)
            (capture / 'mapped-image.bin').write_bytes(b'incomplete')
            with self.assertRaisesRegex(ValueError, 'Recovered image hash mismatch'):
                check.verify_private(check.ROOT, root, self.report)

    def test_missing_private_input_is_not_success(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(FileNotFoundError):
                check.verify_private(check.ROOT, Path(directory), self.report)

    def test_raw_semantic_mutations_even_with_updated_hashes(self):
        original_manifest = check.read_json(check.ROOT, f'{check.RAW}/manifest.json')
        relative = 'shards/part-010.json.gz'
        original = json.loads(gzip.decompress((check.ROOT / check.RAW / relative).read_bytes()))
        for mutation in ('missing-package', 'override', 'unknown-identity', 'superclass'):
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                raw = root / check.RAW
                (raw / 'shards').mkdir(parents=True)
                shard = copy.deepcopy(original)
                package = shard['packages'][28]
                if mutation == 'missing-package':
                    shard['packages'].pop(28)
                elif mutation == 'override':
                    package['cdoPropertyInventory'][0]['properties'].append({'path': 'PowerEffects'})
                elif mutation == 'unknown-identity':
                    package['cdoPropertyInventory'][0]['properties'][2]['decoding'] = {'state': 'unsupported'}
                else:
                    package['inheritanceChains'][0]['hops'][0]['targetObject'] = '/Script/Dungeons.ItemInstance'
                content = json.dumps(shard).encode()
                compressed = gzip.compress(content)
                (raw / relative).write_bytes(compressed)
                manifest = copy.deepcopy(original_manifest)
                record = manifest['shards'][10]
                record['compressedSha256'] = check.digest(compressed)
                record['uncompressedSha256'] = check.digest(content)
                (raw / 'manifest.json').write_text(json.dumps(manifest))
                with self.assertRaises(ValueError):
                    check.raw_snapshot(root)

    def test_corrupted_compressed_raw_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            raw = root / check.RAW
            (raw / 'shards').mkdir(parents=True)
            (raw / 'manifest.json').write_text(json.dumps(check.read_json(check.ROOT, f'{check.RAW}/manifest.json')))
            (raw / 'shards/part-010.json.gz').write_bytes(b'corrupt')
            with self.assertRaisesRegex(ValueError, 'Raw compressed hash drift'):
                check.raw_snapshot(root)


if __name__ == '__main__':
    unittest.main()
