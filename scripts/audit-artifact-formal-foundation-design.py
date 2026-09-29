#!/usr/bin/env python3
"""Deterministic, read-only census of the 23 matched Formal Artifact source closures."""
import argparse
import collections
import gzip
import hashlib
import json
from pathlib import Path

BASELINE = '6faa63442319c0569d684a55646997beac6cc0ff'
MANIFEST = 'research/raw/game-data-raw-structural-inventory/manifest.json'
HORIZONTAL = 'research/raw/game-data-horizontal-fact-inventory-v1.json.gz'
IDENTITY = 'research/domain/formal/identity-evidence-v1.json'


def load(path):
    with (gzip.open(path, 'rt') if str(path).endswith('.gz') else open(path)) as stream:
        return json.load(stream)


def require_one(values, label):
    if len(values) != 1:
        raise ValueError(f'{label}: expected one, found {len(values)}')
    return values[0]


def scalar_type(value):
    if isinstance(value, bool):
        return 'boolean'
    if isinstance(value, (int, float)):
        return 'number'
    if isinstance(value, str):
        return 'string'
    if value is None:
        return 'null'
    return 'object' if isinstance(value, dict) else 'array'


def flatten_property(prop, pointer, output, role, package, shard, route):
    decoding = prop['decoding']
    children = decoding.get('properties')
    if children is not None:
        for index, child in enumerate(children):
            flatten_property(child, f'{pointer}/decoding/properties/{index}', output, role, package, shard, route)
        return
    elements = decoding.get('elements')
    if elements is not None:
        for index, element in enumerate(elements):
            child = dict(prop)
            child['path'] = f"{prop['path']}[{element['index']}]"
            child['sourceRange'] = element.get('sourceRange')
            child['decoding'] = element['decoding']
            if 'value' in element:
                child['decoding'] = {**element['decoding'], 'value': element['value']}
            flatten_property(child, f'{pointer}/decoding/elements/{index}', output, role, package, shard, route)
        return
    value = decoding.get('value')
    output.append({
        'role': role, 'sourcePackage': package, 'shard': shard, 'pointer': pointer,
        'traversalEdgeIds': route, 'propertyPath': prop['path'],
        'propertyType': prop['type']['value'], 'decodingState': decoding['state'],
        'decodedValueType': scalar_type(value) if decoding['state'] == 'decoded' else None,
        'decodedValue': value if isinstance(value, (str, int, float, bool)) or value is None else None,
        'sourceRange': prop.get('sourceRange'),
    })


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument('--output', type=Path, help='Write census JSON here; otherwise print to stdout')
    args = parser.parse_args()
    root = args.root
    identity = load(root / IDENTITY)
    horizontal = load(root / HORIZONTAL)
    manifest = load(root / MANIFEST)
    artifacts = [item for item in horizontal['items'] if item['category'] == 'artifact']
    rows = []
    packages = {}
    edges = {}
    for shard in manifest['shards']:
        path = root / 'research/raw/game-data-raw-structural-inventory' / shard['path']
        compressed = path.read_bytes()
        if hashlib.sha256(compressed).hexdigest() != shard['compressedSha256']:
            raise ValueError(f"compressed shard hash mismatch: {path}")
        uncompressed = gzip.decompress(compressed)
        if hashlib.sha256(uncompressed).hexdigest() != shard['uncompressedSha256']:
            raise ValueError(f"uncompressed shard hash mismatch: {path}")
        data = json.loads(uncompressed)
        for index, package in enumerate(data['packages']):
            key = package['path']
            if key in packages:
                raise ValueError(f'duplicate Structural package: {key}')
            packages[key] = (package, shard['path'], index)
        for index, edge in enumerate(data['edges']):
            key = edge['id']
            if key in edges:
                raise ValueError(f'duplicate Structural edge: {key}')
            edges[key] = (edge, shard['path'], index)
    edges_by_package = collections.defaultdict(list)
    for edge_id, (edge, shard, index) in edges.items():
        edges_by_package[edge['sourcePackage']].append((edge_id, edge, shard, index))
    source_relations = collections.defaultdict(list)
    for relation in horizontal['sourceRelations']:
        source_relations[relation['edgeId']].append(relation)
    assertions = []
    for item in artifacts:
        matches = [a for a in identity['identityAssertions'] if a['domainId'] == item['catalogId']]
        if len(matches) == 1:
            assertion = matches[0]
            semantic = require_one([s for s in identity['semantic']['identities']
                if s['assertionId'] == assertion['id']], item['catalogId'] + ' semantic Identity')
            if semantic['resolution']['state'] != 'matched':
                raise ValueError(f"unmatched Formal Identity: {item['catalogId']}")
            assertions.append((item, assertion))
    if len(assertions) != 23 or len({a['domainId'] for _, a in assertions}) != 23:
        raise ValueError(f'Formal Artifact Identity count/uniqueness drift: {len(assertions)}')
    for item, assertion in sorted(assertions, key=lambda pair: pair[1]['domainId']):
        domain = assertion['domainId']
        package = assertion['applicationScope']['packagePath']
        seed = require_one([s for s in manifest['catalogSeeds']
            if s['category'] == 'artifact' and s['catalogId'] == domain], domain + ' Structural seed')
        horizontal_candidate = require_one([c for c in item['rawCandidate']['candidates']
            if c['packagePath'] == package], domain + ' Horizontal candidate')
        require_one([c for c in seed['candidates'] if c['packagePath'] == package], domain + ' Structural candidate')
        package_info = packages.get(package)
        if package_info is None:
            raise ValueError(f'{domain}: missing root package')
        if package_info[0]['packageHash']['value'] != horizontal_candidate['candidatePackageProvenance']['packageHash']:
            raise ValueError(f'{domain}: selected package hash differs')
        routes = {path['sourcePackage']: path['edgeIds']
            for path in horizontal_candidate['traversal']['relationPaths']}
        if len(routes) != horizontal_candidate['traversal']['visitedPackageCount'] or package not in routes:
            raise ValueError(f'{domain}: closure route count/root drift')
        for reference in horizontal_candidate['relations']:
            edge_id = reference['edgeId']
            if edge_id not in edges or len(source_relations[edge_id]) != 1:
                raise ValueError(f'{domain}: unresolved Horizontal/Structural edge {edge_id}')
            if reference['sourcePackage'] not in routes:
                raise ValueError(f'{domain}: relation source outside closure {edge_id}')
        facts = []
        relation_edges = []
        for source_package, route in sorted(routes.items()):
            if source_package not in packages:
                raise ValueError(f'{domain}: missing traversed package {source_package}')
            source, shard, package_index = packages[source_package]
            role = 'root' if source_package == package else 'traversed'
            for inventory_index, inventory in enumerate(source['cdoPropertyInventory']):
                for property_index, prop in enumerate(inventory['properties']):
                    pointer = (f'/packages/{package_index}/cdoPropertyInventory/{inventory_index}'
                               f'/properties/{property_index}')
                    flatten_property(prop, pointer, facts, role, source_package, shard, route)
            for edge_id, edge, edge_shard, edge_index in edges_by_package[source_package]:
                occ = edge['sourceOccurrence']
                if occ['kind'] != 'cdo-property' and edge['kind'] not in ('super', 'template'):
                    continue
                relation_edges.append({
                    'role': role, 'sourcePackage': source_package, 'shard': edge_shard,
                    'pointer': f'/edges/{edge_index}', 'traversalEdgeIds': route,
                    'edgeId': edge_id, 'edgeKind': edge['kind'],
                    'sourceObject': occ.get('sourceObject'),
                    'propertyPath': occ.get('propertyPath', occ.get('serializedField')),
                    'sourceRange': occ['sourceRange'],
                    'targetPackage': edge.get('targetPackage'),
                    'targetObject': edge.get('targetObject'),
                    'targetKind': edge.get('targetKind'),
                    'resolution': edge['traversal']['stopReason'],
                })
        relation_edges.sort(key=lambda edge: (edge['role'] != 'root', edge['sourcePackage'],
            edge['propertyPath'] or '', edge['edgeId']))
        facts.sort(key=lambda fact: (fact['role'] != 'root', fact['sourcePackage'], fact['pointer']))
        rows.append({
            'domainId': domain, 'identityAssertion': assertion['id'],
            'applicationScopePackage': package, 'rawCandidateStatus': item['rawCandidate']['status'],
            'selectedCandidatePackage': horizontal_candidate['packagePath'],
            'structuralCandidatePackage': package, 'closurePackageCount': len(routes),
            'baseCooldownState': item['artifactCooldown']['state'],
            'baseCooldownAuthority': item['artifactCooldown']['authorityPath'],
            'facts': facts, 'edges': relation_edges,
        })
    result = {
        'auditKind': 'artifact-formal-foundation-design-census', 'baselineMain': BASELINE,
        'sourceArtifacts': [IDENTITY, HORIZONTAL, MANIFEST],
        'domainCount': len(rows), 'rows': rows,
    }
    serialized = json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + '\n'
    if args.output:
        args.output.write_text(serialized)
    else:
        print(serialized, end='')


if __name__ == '__main__':
    main()
