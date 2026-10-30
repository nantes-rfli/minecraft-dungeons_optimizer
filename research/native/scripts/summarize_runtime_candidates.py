#!/usr/bin/env python3
"""Reproduce the main-based next-WU census; analysis only, never runtime inputs."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / 'research/native/next-work-unit-census.json'
TARGETS = ['shortbow', 'longbow', 'power-bow', 'heavy-crossbow']


def census():
    inputs = {}

    def read(path):
        data = (ROOT / path).read_bytes()
        inputs[path] = hashlib.sha256(data).hexdigest()
        return data

    def load(path):
        return json.loads(read(path))

    def runtime_ids(path, name):
        # Read only the explicit object initializer, stopping at its closing line.
        text = re.split(r'export const ' + name + r'\b[^=]*=\s*\{', read(path).decode(), maxsplit=1)[1].split('\n}', 1)[0]
        ids = re.findall(r"^  (?:'([^']+)'|([a-z][a-z0-9]*)): \{", text, re.M)
        return sorted(a or b for a, b in ids)

    runtime = {
        'melee': runtime_ids('src/data/weapons.ts', 'WEAPONS'),
        'armor': runtime_ids('src/data/armors.ts', 'ARMORS'),
        'ranged': runtime_ids('src/data/ranged.ts', 'RANGED_WEAPONS'),
        'artifact': runtime_ids('src/data/artifacts.ts', 'ARTIFACTS'),
    }
    audit = load('research/ranged-weapon-audit.json')
    armor = load('research/armor-audit.json')
    melee = load('research/melee-attack-profile-audit.json')
    artifacts = load('research/artifact-audit.json')
    identities = load('research/domain/formal/identity-evidence-v1.json')
    values = load('research/domain/formal/value-availability-v2.json')
    relations = load('research/domain/formal/serialized-relation-v2.json')
    selected = []
    for domain in TARGETS:
        assert domain not in runtime['ranged'], 'candidate already supported'
        entry = next(e for e in audit['entries'] if e['id'] == domain)
        identity = next(e for e in identities['identityAssertions'] if e['domainId'] == domain)
        assert identity['reviewState'] == 'accepted'
        value = values['semantic']['ranged'][domain]
        assert value['configuredProjectileDefinitions']['value'] == [0]
        definition = value['projectileDefinitions'][0]
        assert definition['sourceIndex'] == 0 and definition['configuredProjectileCount']['value'] == 1
        relation = next(e for e in relations['semantic']['relations']
                        if e['occurrence'] == {'domainId': domain, 'collectionRef': 'projectile-definitions', 'sourceIndex': 0})
        selected.append({
            'domainId': domain, 'mode': 'single' if domain == 'heavy-crossbow' else 'charged',
            'rawIdentity': identity['rawIdentity'], 'sourcePackage': identity['applicationScope']['packagePath'],
            'identityRef': identity['id'], 'identityEvidenceRefs': identity['evidenceRefs'],
            'publishedOwnIntrinsic': entry['intrinsic']['own'],
            'publishedInheritedIntrinsic': entry['intrinsic']['inherited'],
            'completeMechanicVerification': entry['intrinsic']['completeMechanicVerification'],
            'configuredProjectileCount': definition['configuredProjectileCount'],
            'projectileRelation': relation,
            'effectiveSingleHitAndAmmo': 'unverified', 'switchEvidence': 'not-acquired',
            'runtimeEligibility': 'held-pending-target-specific-evidence-and-review',
        })
    shard_path = 'research/raw/game-data-raw-structural-inventory/shards/part-060.json.gz'
    package = json.loads(gzip.decompress(read(shard_path)))['packages'][49]
    assert package['path'].endswith('/TwistingVineBow/BP_TwistingVineBowArrow')
    effect = next(p for p in package['cdoPropertyInventory'][0]['properties'] if p['path'] == 'SporeDamageEffect')
    assert effect['decoding']['state'] == 'decoded'
    # Empty published intrinsic lists cannot erase this explicit gameplay reference.
    excluded = {'domainId': 'twisting-vine-bow', 'reason': 'additional-gameplay-effect-reference',
                'rawLocator': shard_path + '#/packages/49/cdoPropertyInventory/0',
                'property': effect['path'], 'reference': effect['decoding']['value'],
                'effectMagnitudeAndRuntimeBehavior': 'unknown'}
    reusable_kinds = {'melee-attack-speed', 'weapon-damage-aura', 'damage-reduction',
                      'soul-gathering', 'life-steal-aura', 'melee-damage', 'artifact-cooldown'}
    armor_screen = [{'domainId': e['id'], 'rawIdentity': e['levelId'],
                     'properties': e['intrinsicProperties'], 'builtInEnchantments': e['builtInEnchantments'],
                     'reuseEligibility': 'not-approved-by-current-B-or-B2'}
                    for e in armor['entries'] if e['id'] not in runtime['armor'] and e['obtainable']
                    and e['intrinsicProperties']
                    and all(p['kind'] in reusable_kinds for p in e['intrinsicProperties'])]
    return {
        'schemaVersion': 1, 'artifactKind': 'next-runtime-work-unit-selection-census',
        'baselineCommit': 'e0a239a3623a4b16a4cd7cd0eb13f83193ed1f1a',
        'status': 'planning-only', 'runtimePromotion': False, 'newCalculableEquipment': [],
        'population': {'melee': len(melee['weapons']), 'armor': len(armor['entries']),
                       'ranged': len(audit['entries']),
                       'artifact': len(artifacts['entries']) + len(artifacts['populationDifferences'])},
        'runtimeIds': runtime,
        'selectedWorkUnit': 'source-bound-observed-single-projectile-ranged-batch',
        'conditionalNewEquipmentUpperBound': len(selected),
        'acceptedNewEquipment': 0, 'selectedTargets': selected,
        'excludedAfterRawCrosscheck': [excluded],
        'armorExistingNumericFamilyScreen': armor_screen,
        'inputSha256': dict(sorted(inputs.items())),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    rendered = json.dumps(census(), indent=2, ensure_ascii=False) + '\n'
    if args.write:
        OUTPUT.write_text(rendered)
    elif OUTPUT.read_text() != rendered:
        raise SystemExit('FAIL: next-WU census drift; review inputs before regenerating')
    print('PASS: next-WU census (planning only; newly calculable equipment = 0)')


if __name__ == '__main__':
    main()
