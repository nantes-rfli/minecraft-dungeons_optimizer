"""Public evidence guards and arithmetic regression checks; no game execution."""
import copy
from fractions import Fraction
import json
import unittest

import check_armor_hp_final_path as check


class ArmorHpFinalPathTests(unittest.TestCase):
    def setUp(self):
        self.report = json.loads(check.REPORT.read_text())

    def test_public_evidence(self):
        check.public_check(self.report)

    def test_unknown_state_and_crt_cannot_be_promoted(self):
        for key in check.LIMITS:
            for value in (0, 'verified', 'supported'):
                with self.subTest(key=key, value=value):
                    report = copy.deepcopy(self.report)
                    report['limits'][key] = value
                    with self.assertRaises(ValueError):
                        check.public_check(report)
        for key, value in [('runtimePromotion', True), ('applicationImpact', True),
                           ('newCalculableEquipment', ['mercenary-armor']),
                           ('status', 'accepted')]:
            report = copy.deepcopy(self.report)
            report[key] = value
            with self.assertRaises(ValueError):
                check.public_check(report)

    def test_input_drift_is_rejected(self):
        for mutation in ('baseline', 'image', 'span', 'raw-shard', 'raw-selection'):
            report = copy.deepcopy(self.report)
            if mutation == 'baseline':
                report['baselineCommit'] = '0' * 40
            elif mutation == 'image':
                report['recoveredImageSha256'] = '0' * 64
            elif mutation == 'span':
                report['nativeSpans'].pop()
            elif mutation == 'raw-shard':
                report['playerRaw']['compressedSha256'] = '0' * 64
            else:
                report['playerRaw']['abilityExportIndex'] = 270
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                check.public_check(report)

    def test_binary32_ties_and_subnormal_boundary(self):
        self.assertEqual(check.rounded(Fraction(1) + Fraction(1, 2**24)), 0x3f800000)
        self.assertEqual(check.rounded(Fraction(1) + Fraction(3, 2**24)), 0x3f800002)
        self.assertEqual(check.rounded(Fraction(1, 2**150)), 0)
        self.assertEqual(check.rounded(Fraction(3, 2**150)), 2)
        self.assertEqual(check.rounded(-Fraction(1, 2**150)), 0x80000000)

    def test_reassociation_changes_the_result(self):
        base, magnitude = 0x43fa0000, 0x3f800001
        groups = [[], [(magnitude, True)], [], []]
        self.assertEqual(check.channel_model(base, groups), 0x43fa0000)
        self.assertEqual(check.op(base, magnitude, 'mul'), 0x43fa0002)

    def test_saved_replay_matches_current_checker_and_image(self):
        result = json.loads((check.REPORT.parent/'armor-hp-aggregation-replay.json').read_text())
        watchdog = json.loads((check.REPORT.parent/'armor-hp-aggregation-replay.watchdog.json').read_text())
        self.assertEqual(result['checkerSha256'], check.sha(check.Path(check.__file__).read_bytes()))
        self.assertEqual(result['recoveredImageSha256'], self.report['recoveredImageSha256'])
        self.assertEqual((result['publicChecks'], result['privateChecks']), ('passed', 'passed'))
        replay = result['nativeReplay']
        self.assertEqual((replay['stackCases'], replay['channelCases'], replay['mismatches']), (4120, 461, 0))
        self.assertEqual(replay['caseDigestSha256'], 'ee8695fccf15784218e909b282023a0ad56b15e799b23d41a5c16d4f08653d62')
        self.assertEqual((watchdog['status'], watchdog['returncode'], watchdog['cleanupComplete']), ('exited', 0, True))


if __name__ == '__main__':
    unittest.main()
