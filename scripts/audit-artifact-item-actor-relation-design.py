#!/usr/bin/env python3
"""Reconcile committed Artifact ItemActorClass roots and their target class role."""

import argparse
import collections
import gzip
import hashlib
import json
import subprocess
from pathlib import Path

BASELINE = '5796c70774c92672b87b40354e2194dd4c03292d'
ROOT = Path(__file__).resolve().parent.parent
STRUCTURAL = Path('research/raw/game-data-raw-structural-inventory')
DOMAINS = (
    'corrupted-seeds', 'death-cap-mushroom', 'enchanted-grass',
    'iron-hide-amulet', 'powershaker', 'satchel-of-elements',
    'satchel-of-elixirs', 'satchel-of-snacks', 'scatter-mines',
    'shadow-shifter', 'shock-powder',
)
OTHER_FIELDS = (
    'ProjectileItemSpec.ClassesToSpawn[0]', 'BeesNestClass',
    'FishingHookActorClass', 'FishingRodActorClass', 'ChargedRedstoneMineBP',
    'MobMashShockWavePrimaryClass', 'MobMashShockWaveSecondaryClass',
    'SpinWheelActorClass', 'TotemClass', 'CustomMover',
)


def read_json(path):
    with (gzip.open(path, 'rt') if str(path).endswith('.gz') else open(path)) as stream:
        return json.load(stream)


def one(values, label):
    if len(values) != 1:
        raise ValueError(f'{label}: expected exactly one, got {len(values)}')
    return values[0]


def structural_index(root):
    manifest = read_json(root / STRUCTURAL / 'manifest.json')
    packages, edges = {}, {}
    for shard in manifest['shards']:
        path = root / STRUCTURAL / shard['path']
        compressed = path.read_bytes()
        if hashlib.sha256(compressed).hexdigest() != shard['compressedSha256']:
            raise ValueError(f'compressed shard hash mismatch: {path}')
        plain = gzip.decompress(compressed)
        if hashlib.sha256(plain).hexdigest() != shard['uncompressedSha256']:
            raise ValueError(f'uncompressed shard hash mismatch: {path}')
        content = json.loads(plain)
        for index, package in enumerate(content['packages']):
            key = package['path']
            if key in packages:
                raise ValueError(f'duplicate Structural package: {key}')
            packages[key] = (package, shard['path'], f'/packages/{index}')
        for index, edge in enumerate(content['edges']):
            key = edge['id']
            if key in edges:
                raise ValueError(f'duplicate Structural edge: {key}')
            edges[key] = (edge, shard['path'], f'/edges/{index}')
    return manifest, packages, edges


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    root = args.root
    identity = read_json(root / 'research/domain/formal/identity-evidence-v1.json')
    horizontal = read_json(root / 'research/raw/game-data-horizontal-fact-inventory-v1.json.gz')
    # This reviewed census is pinned to the pre-population main, even after implementation.
    relation = json.loads(subprocess.check_output(
        ['git', 'show', f'{BASELINE}:research/domain/formal/serialized-relation-v2.json'], cwd=root))
    manifest, packages, edges = structural_index(root)
    edges_by_source = collections.defaultdict(list)
    for edge, shard, pointer in edges.values():
        edges_by_source[edge['sourcePackage']].append((edge, shard, pointer))
    source_relations = collections.defaultdict(list)
    for source in horizontal['sourceRelations']:
        source_relations[source['edgeId']].append(source)
    rows, other = [], []
    for domain in DOMAINS:
        assertion = one([a for a in identity['identityAssertions'] if a['domainId'] == domain],
                        domain + ' Identity assertion')
        semantic = one([s for s in identity['semantic']['identities'] if s['assertionId'] == assertion['id']],
                       domain + ' semantic Identity')
        if semantic['resolution']['state'] != 'matched':
            raise ValueError(f'{domain}: Identity is not matched')
        package_path = assertion['applicationScope']['packagePath']
        item = one([i for i in horizontal['items'] if i['category'] == 'artifact'
                    and i['catalogId'] == domain], domain + ' catalog row')
        candidate = one([c for c in item['rawCandidate']['candidates']
                         if c['packagePath'] == package_path], domain + ' selected candidate')
        seed = one([s for s in manifest['catalogSeeds'] if s['category'] == 'artifact'
                    and s['catalogId'] == domain], domain + ' Structural seed')
        one([c for c in seed['candidates'] if c['packagePath'] == package_path],
            domain + ' Structural candidate')
        source_package, source_shard, source_pointer = packages[package_path]
        if candidate['candidatePackageProvenance']['packageHash'] != source_package['packageHash']['value']:
            raise ValueError(f'{domain}: source package hash mismatch')
        if candidate['candidatePackageProvenance']['sourceShardPath'] != str(STRUCTURAL / source_shard):
            raise ValueError(f'{domain}: source shard mismatch')
        manifest_shard = one([s for s in manifest['shards'] if s['path'] == source_shard],
                             domain + ' manifest shard')
        if (candidate['candidatePackageProvenance']['sourceShardUncompressedSha256']
                != manifest_shard['uncompressedSha256']):
            raise ValueError(f'{domain}: candidate/Structural shard hash mismatch')
        candidates = []
        for reference in candidate['relations']:
            sources = source_relations[reference['edgeId']]
            if len(sources) != 1:
                raise ValueError(f'{domain}: sourceRelation count for {reference["edgeId"]} is {len(sources)}')
            source = sources[0]
            if source['propertyPath'] == 'ItemActorClass':
                candidates.append((reference, source))
        reference, source = one(candidates, domain + ' ItemActorClass candidate')
        if (reference['sourcePackage'] != package_path or source['sourcePackage'] != package_path
                or reference['sourceRelationPathId'] != 'rp-root'
                or source['relationKind'] != 'object-property'
                or source['sourceOccurrenceKind'] != 'cdo-property'
                or source['arrayIndex'] is not None or source['targetKind'] != 'import'
                or source['targetState'] != 'resolved-local-package'):
            raise ValueError(f'{domain}: source edge is non-root, array, or unresolved')
        edge, shard, edge_pointer = edges[reference['edgeId']]
        if shard != source_shard or edge['sourcePackage'] != package_path:
            raise ValueError(f'{domain}: Structural edge source mismatch')
        if (edge['kind'] != 'object-property' or edge['sourceOccurrence']['kind'] != 'cdo-property'
                or edge['sourceOccurrence']['propertyPath'] != 'ItemActorClass'
                or edge['sourceOccurrence']['sourceRange'] != source['sourceRange']
                or edge['targetKind'] != 'import'
                or edge['targetPackage'] != source['targetPackage']
                or edge['targetObject'] != source['targetObject']
                or edge['traversal']['stopReason'] not in ('followed', 'already-visited')):
            raise ValueError(f'{domain}: Structural edge differs from Horizontal source')
        structural_roots = [e for e, _, _ in edges_by_source[package_path]
                            if e['kind'] == 'object-property' and e['sourceOccurrence']['kind'] == 'cdo-property'
                            and e['sourceOccurrence']['propertyPath'] == 'ItemActorClass']
        one(structural_roots, domain + ' Structural ItemActorClass root')
        target, target_shard, target_pointer = packages[edge['targetPackage']]
        if not edge['targetObject'].startswith(target['gamePackageName'] + '.'):
            raise ValueError(f'{domain}: target object/package mismatch')
        class_name = edge['targetObject'].split('.')[-1]
        generated_class = one([e for e in target['exports'] if e['objectName']['value'] == class_name
                               and not e['isClassDefaultObject']], domain + ' generated class')
        chain = one([c for c in target['inheritanceChains'] if c['sourceObject'] == class_name],
                    domain + ' inheritance chain')
        if (generated_class['references']['super']['objectName'] != 'ItemActor'
                or generated_class['references']['super']['kind'] != 'import'
                or len(chain['hops']) != 1
                or chain['hops'][0]['targetObject'] != '/Script/Dungeons.ItemActor'
                or chain['stopReason'] != 'native-boundary'):
            raise ValueError(f'{domain}: target class does not directly derive from native ItemActor')
        cdo = one([e for e in target['exports'] if e['isClassDefaultObject']
                   and e['references']['class']['objectName'] == class_name], domain + ' CDO')
        if cdo['references']['template']['objectName'] != 'Default__ItemActor':
            raise ValueError(f'{domain}: target CDO template is not Default__ItemActor')
        target_relations = sorted({e['sourceOccurrence']['propertyPath'] for e, _, _ in edges_by_source[target['path']]
                                   if e['kind'] == 'object-property'
                                   and e['sourceOccurrence']['kind'] == 'cdo-property'})
        rows.append({
            'domainId': domain, 'identityAssertion': assertion['id'],
            'sourcePackage': package_path, 'sourceShard': source_shard,
            'sourcePackagePointer': source_pointer,
            'selectedCandidatePackage': candidate['packagePath'],
            'sourceRelationPathId': reference['sourceRelationPathId'],
            'edgeId': reference['edgeId'], 'edgeKind': edge['kind'],
            'propertyPath': source['propertyPath'], 'targetKind': edge['targetKind'],
            'sourceEdgePointer': edge_pointer, 'targetPackage': target['path'],
            'targetShard': target_shard, 'targetPackagePointer': target_pointer,
            'targetPackageHash': target['packageHash']['value'],
            'targetObject': edge['targetObject'], 'targetClass': class_name,
            'targetSuper': chain['hops'][0]['targetObject'],
            'targetSuperEdgeId': chain['hops'][0]['edgeId'],
            'inheritanceStopReason': chain['stopReason'],
            'targetCdo': cdo['objectName']['value'],
            'targetCdoTemplate': cdo['references']['template']['objectName'],
            'targetCdoRelations': target_relations,
            'traversalResolution': edge['traversal']['stopReason'],
        })
    # Inspect all selected Artifact roots to prevent a hidden twelfth ItemActorClass occurrence.
    root_count = 0
    structural_root_count = 0
    for item in horizontal['items']:
        if item['category'] != 'artifact':
            continue
        assertions = [a for a in identity['identityAssertions'] if a['domainId'] == item['catalogId']]
        if len(assertions) != 1:
            continue
        package_path = assertions[0]['applicationScope']['packagePath']
        candidates = [c for c in item['rawCandidate']['candidates'] if c['packagePath'] == package_path]
        if len(candidates) != 1:
            raise ValueError(f'{item["catalogId"]}: selected Artifact candidate count differs')
        structural_root_count += sum(
            edge['kind'] == 'object-property'
            and edge['sourceOccurrence']['kind'] == 'cdo-property'
            and edge['sourceOccurrence']['propertyPath'] == 'ItemActorClass'
            for edge, _, _ in edges_by_source[package_path]
        )
        for reference in candidates[0]['relations']:
            sources = source_relations[reference['edgeId']]
            if len(sources) != 1:
                raise ValueError(f'{item["catalogId"]}: sourceRelation duplicate/missing')
            source = sources[0]
            if source['propertyPath'] == 'ItemActorClass' and reference['sourceRelationPathId'] == 'rp-root':
                root_count += 1
        for edge, _, _ in edges_by_source[package_path]:
            occurrence = edge['sourceOccurrence']
            if (edge['kind'] == 'object-property' and occurrence['kind'] == 'cdo-property'
                    and occurrence['propertyPath'] in OTHER_FIELDS):
                target = packages.get(edge.get('targetPackage'))
                other.append({'domainId': item['catalogId'], 'propertyPath': occurrence['propertyPath'],
                              'edgeId': edge['id'], 'targetPackage': edge.get('targetPackage'),
                              'targetSuper': [hop['targetObject'] for chain in target[0]['inheritanceChains']
                                              for hop in chain['hops']] if target else [],
                              'traversalResolution': edge['traversal']['stopReason']})
    if root_count != len(DOMAINS) or structural_root_count != len(DOMAINS):
        raise ValueError(f'Artifact root ItemActorClass count drift: Horizontal={root_count}, Structural={structural_root_count}')
    semantic_relations = relation['semantic']['relations']
    existing = {r['sourceDomainId'] for r in semantic_relations}
    refs = {r['relationRef'] for r in semantic_relations}
    projection_refs = {r['projectionRef'] for r in relation['relationProjections']}
    for domain in DOMAINS:
        if f'relation:{domain}:item-actor@1' in refs:
            raise ValueError(f'{domain}: proposed RelationRef already exists')
        if f'projection:relation:{domain}:item-actor@1:source' in projection_refs:
            raise ValueError(f'{domain}: proposed projectionRef already exists')
    output = {
        'auditKind': 'artifact-item-actor-relation-design-census',
        'baselineMain': BASELINE, 'domainCount': len(rows), 'rootEdgeCount': root_count,
        'structuralRootEdgeCount': structural_root_count,
        'rows': rows, 'otherClassFields': sorted(other, key=lambda x: (x['domainId'], x['propertyPath'])),
        'currentRelationCounts': {'semantic': len(semantic_relations),
                                  'projections': len(relation['relationProjections']),
                                  'collections': len(relation['relationCollections']),
                                  'uniqueSourceDomains': len(existing)},
        'existingSourceDomains': sorted(existing.intersection(DOMAINS)),
        'newSourceDomains': sorted(set(DOMAINS) - existing),
        'postWaveCounts': {'semantic': len(semantic_relations) + len(DOMAINS),
                           'projections': len(relation['relationProjections']) + len(DOMAINS),
                           'collections': len(relation['relationCollections']),
                           'uniqueSourceDomains': len(existing.union(DOMAINS))},
    }
    serialized = json.dumps(output, ensure_ascii=False, sort_keys=True, indent=2) + '\n'
    if args.output:
        args.output.write_text(serialized)
    else:
        print(serialized, end='')


if __name__ == '__main__':
    main()
