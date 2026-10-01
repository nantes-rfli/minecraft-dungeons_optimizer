#!/usr/bin/env python3
"""Design-only census of every committed CDO edge of the 23 Formal Artifacts.

Reads Git blobs, never extracts game binaries or writes Formal population. The
fallback commit has an identical tree to baseline (GitHub compare: files=[]).
"""
import argparse
import collections
import gzip
import hashlib
import json
import subprocess
from pathlib import Path

BASELINE = '4957c9b5912b853f581ec16b0f4f6f73360ec1e2'
EQUIVALENT = '29050725e569dfd964fd8c88516ed6c1dede70af'
TREE = '5fa2fe8649b90e866791a45b61daae7f593ef0f9'
STRUCTURAL = 'research/raw/game-data-raw-structural-inventory'
IDENTITY = 'research/domain/formal/identity-evidence-v1.json'
HORIZONTAL = 'research/raw/game-data-horizontal-fact-inventory-v1.json.gz'
RELATION = 'research/domain/formal/serialized-relation-v2.json'
VALUE = 'research/domain/formal/value-availability-v2.json'
# Reviewed outcomes, applied only AFTER the exhaustive edge scan. Not discovery taxonomy.
POLICIES = {
    'ProjectileItemSpec.ClassesToSpawn[0]': ('spore-grenade-spawn-class', 'ready-with-new-kind', 'SporeGrenade'),
    'BeesNestClass': ('bee-nest', 'requires-additional-source-evidence', 'BeeNest'),
    'FishingHookActorClass': ('fish-hook', 'ready-with-new-kind', 'FishHookItem'),
    'FishingRodActorClass': ('rod-actor-unconfirmed', 'semantic-ambiguous', 'Actor'),
    'CustomMover': ('pushback-custom-mover', 'requires-additional-source-evidence', 'PushbackCustomMover'),
    'MobMashShockWavePrimaryClass': ('mob-mash-shockwave', 'requires-additional-source-evidence', 'MobMashShockWave'),
    'MobMashShockWaveSecondaryClass': ('mob-mash-shockwave', 'requires-additional-source-evidence', 'MobMashShockWave'),
    'ChargedRedstoneMineBP': ('charged-redstone-mine', 'requires-additional-source-evidence', 'ChargedRedstoneMineActor'),
    'SpinWheelActorClass': ('spin-wheel-actor', 'ready-with-new-kind', 'SpinWheelActor'),
    'TotemClass': ('soul-totem-of-casting', 'requires-additional-source-evidence', 'SoulTotemOfCastingActor'),
}
PRESENTATION = {'ActivationAnimation', 'Montage', 'FishHookPullAnimationSequence',
                'FishHookThrowAnimationSequence', 'LandingEffect', 'LandingSound',
                'InventoryDropSound', 'Paperdoll', 'UIData', 'iconClass', 'RootComponent'}


def one(values, label):
    if len(values) != 1:
        raise ValueError(f'{label}: expected one, found {len(values)}')
    return values[0]


def require(ok, label):
    if not ok:
        raise ValueError(label)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def parse_boundary(pkg):
    # Non-CDO bytecode remains unextracted; record its counts, not hundreds of
    # repeated range objects. Retain every actual property failure range.
    return {
        'parse': {'state': pkg['parse']['state'], 'runId': pkg['parse']['runId']},
        'payloadCoverage': pkg['payloadCoverage'],
        'unavailableRangeCountsByState': dict(sorted(collections.Counter(
            r['state'] for r in pkg['unavailableRanges']).items())),
        'propertyUnavailableRanges': [r for r in pkg['unavailableRanges'] if r['state'] != 'not-extracted'],
    }


def property_nodes(properties, pointer):
    """Include containers and array elements; preserve undecoded states."""
    for index, prop in enumerate(properties):
        ptr = f'{pointer}/{index}'
        yield prop, ptr
        dec = prop['decoding']
        yield from property_nodes(dec.get('properties', []), ptr + '/decoding/properties')
        for ei, elem in enumerate(dec.get('elements', [])):
            eptr = ptr + f'/decoding/elements/{ei}'
            yield {'path': f"{prop['path']}[{elem['index']}]",
                   'type': {'value': prop.get('metadata', {}).get('innerType')},
                   'decoding': {**elem.get('decoding', {}), **({'value': elem['value']} if 'value' in elem else {})},
                   'sourceRange': elem.get('sourceRange', prop.get('sourceRange'))}, eptr
            yield from property_nodes(elem.get('properties', elem.get('decoding', {}).get('properties', [])), eptr + '/properties')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    root = args.root.resolve()

    def git(*argv, check=True):
        return subprocess.run(['git', *argv], cwd=root, check=check, capture_output=True).stdout

    available = subprocess.run(['git', 'cat-file', '-e', BASELINE + '^{commit}'], cwd=root,
                               capture_output=True).returncode == 0
    source_ref = BASELINE if available else EQUIVALENT
    require(git('rev-parse', source_ref + '^{tree}').decode().strip() == TREE,
            'baseline tree mismatch; audit must be re-reviewed')
    input_hashes = {}

    def read(path):
        data = git('show', f'{source_ref}:{path}')
        input_hashes[path] = digest(data)
        return json.loads(gzip.decompress(data) if path.endswith('.gz') else data)

    identity, horizontal, relation, value = [read(p) for p in (IDENTITY, HORIZONTAL, RELATION, VALUE)]
    manifest = read(STRUCTURAL + '/manifest.json')
    dataset = manifest['scope']['dataset']['id']
    require(horizontal['inventoryIdentity']['datasetId'] == dataset, 'dataset mismatch')
    selected = []
    for item in horizontal['items']:
        if item['category'] != 'artifact':
            continue
        assertions = [a for a in identity['identityAssertions'] if a['domainId'] == item['catalogId']]
        if not assertions:
            continue
        assertion = one(assertions, item['catalogId'] + ' assertion')
        semantic = one([s for s in identity['semantic']['identities'] if s['assertionId'] == assertion['id']], 'Identity')
        require(semantic['resolution']['state'] == 'matched', 'unmatched Identity')
        path = assertion['applicationScope']['packagePath']
        candidate = one([c for c in item['rawCandidate']['candidates'] if c['packagePath'] == path], 'candidate')
        seed = one([s for s in manifest['catalogSeeds'] if s['category'] == 'artifact' and s['catalogId'] == item['catalogId']], 'seed')
        one([c for c in seed['candidates'] if c['packagePath'] == path], 'Structural seed candidate')
        selected.append((item, assertion, semantic, candidate))
    require(len(selected) == 23 and len({a['domainId'] for _, a, _, _ in selected}) == 23, '23 Artifact drift')
    root_paths = {a['applicationScope']['packagePath'] for _, a, _, _ in selected}
    source_shards = {c['candidatePackageProvenance']['sourceShardPath'] for _, _, _, c in selected}
    cached = {p: read(p) for p in sorted(source_shards)}
    wanted = root_paths | {e.get('targetPackage') for sh in cached.values() for e in sh['edges']
                           if e['sourcePackage'] in root_paths and e['sourceOccurrence']['kind'] == 'cdo-property'}
    ui_sources = {p['sourcePackage'] for _, _, _, c in selected
                  for p in c['traversal']['relationPaths']
                  if '/UI/StatusEffects/GameplayEffect/UIData/' in p['sourcePackage']}
    wanted |= ui_sources
    # Also examine locally reached ItemActor presentation/component wiring, without
    # broadening root population to traversed edges.
    packages, edges, by_source, all_paths = {}, {}, collections.defaultdict(list), set()
    verified_shards = []
    for meta in manifest['shards']:
        path = STRUCTURAL + '/' + meta['path']
        compressed = git('show', f'{source_ref}:{path}')
        plain = gzip.decompress(compressed)
        require(digest(compressed) == meta['compressedSha256'], path + ' compressed hash')
        require(digest(plain) == meta['uncompressedSha256'], path + ' plain hash')
        input_hashes[path] = digest(compressed)
        content = cached.get(path) or json.loads(plain)
        require(content['schemaVersion'] == manifest['schemaVersion'] == 1, path + ' schema')
        require(len(content['packages']) == meta['packageCount'] and len(content['edges']) == meta['edgeCount'], path + ' counts')
        verified_shards.append(path)
        for pi, pkg in enumerate(content['packages']):
            require(pkg['path'] not in all_paths, 'duplicate package')
            all_paths.add(pkg['path'])
            if pkg['path'] in wanted:
                packages[pkg['path']] = (pkg, path, f'/packages/{pi}')
        for ei, edge in enumerate(content['edges']):
            if edge['sourcePackage'] not in wanted:
                continue
            require(edge['id'] not in edges, 'duplicate edge')
            edges[edge['id']] = (edge, path, f'/edges/{ei}')
            by_source[edge['sourcePackage']].append(edge['id'])
    source_relations = collections.defaultdict(list)
    for src in horizontal['sourceRelations']:
        source_relations[src['edgeId']].append(src)
    evidence = {e['id']: e for e in identity['provenance']['evidence']}

    def target_info(edge):
        path = edge.get('targetPackage')
        if path not in packages:
            return {'state': 'native-boundary' if edge['traversal']['stopReason'] == 'native-boundary'
                    else 'resolved-local-package' if path in all_paths
                    else edge['traversal']['stopReason'], 'packagePath': path}
        pkg, shard, pointer = packages[path]
        name = (edge.get('targetObject') or '').split('.')[-1]
        exact = [e for e in pkg['exports'] if e['objectName']['value'] == name]
        result = {'state': 'resolved-local-package', 'packagePath': path, 'shard': shard,
                  'packagePointer': pointer, 'packageHash': pkg['packageHash'], **parse_boundary(pkg)}
        if len(exact) != 1:
            result['exactExportCount'] = len(exact)
            return result
        export = exact[0]
        result.update({'export': export, 'exportPointer': pointer + f"/exports/{export['exportIndex']}"})
        if export['references']['class'].get('objectName') != 'BlueprintGeneratedClass':
            return result
        require(edge['targetObject'] == pkg['gamePackageName'] + '.' + name, 'target object/package binding')
        require(not export['isClassDefaultObject'], 'target is a CDO, not a generated class')
        require(export['references']['class']['kind'] == 'import'
                and export['references']['super']['kind'] == 'import', 'target class import role')
        chain = one([c for c in pkg['inheritanceChains'] if c['sourceObject'] == name], 'target chain')
        cdo = one([e for e in pkg['exports'] if e['isClassDefaultObject']
                   and e['references']['class'].get('objectName') == name], 'target CDO')
        supers = [edges[i][0] for i in by_source[path] if edges[i][0]['kind'] == 'super'
                  and edges[i][0]['sourceOccurrence'].get('sourceObject') == name]
        super_edge = one(supers, 'target super edge')
        require(super_edge['sourceOccurrence']['rawPackageIndex'] == export['references']['super']['rawPackageIndex'], 'class super index')
        require(len(chain['hops']) == 1 and chain['hops'][0]['edgeId'] == super_edge['id'], 'chain edge mismatch')
        require(super_edge['traversal']['stopReason'] == chain['stopReason'] == 'native-boundary', 'target native boundary')
        require(cdo['references']['class']['rawPackageIndex'] == export['rawPackageIndex'], 'CDO class index')
        require(cdo['references']['class']['kind'] == 'export'
                and cdo['references']['template']['kind'] == 'import', 'CDO class/template role')
        inv = one([inv for inv in pkg['cdoPropertyInventory'] if inv['exportIndex'] == cdo['exportIndex']], 'target CDO inventory')
        result.update({'generatedClass': name, 'directSuperclass': super_edge['targetObject'],
                       'superEdge': super_edge, 'superEdgeLocator': edges[super_edge['id']][1:],
                       'inheritanceChain': chain, 'cdo': cdo,
                       'cdoPointer': pointer + f"/exports/{cdo['exportIndex']}",
                       'cdoPropertyStates': [{'propertyPath': p['path'], 'type': p['type']['value'],
                                             'decodingState': p['decoding']['state']}
                                            for p in inv['properties']],
                       'cdoEdges': [edges[i][0] for i in by_source[path]
                                    if edges[i][0]['sourceOccurrence']['kind'] == 'cdo-property']})
        return result

    rows, candidates, unclassified = [], [], []
    for item, assertion, semantic, candidate in sorted(selected, key=lambda x: x[1]['domainId']):
        domain = assertion['domainId']; path = assertion['applicationScope']['packagePath']
        pkg, shard, pointer = packages[path]
        prov = candidate['candidatePackageProvenance']
        require(prov['packageHash'] == pkg['packageHash']['value'] and prov['sourceShardPath'] == shard, 'source provenance')
        meta = one([s for s in manifest['shards'] if STRUCTURAL + '/' + s['path'] == shard], 'shard meta')
        require(meta['uncompressedSha256'] == prov['sourceShardUncompressedSha256'], 'source shard binding')
        cdo = one([e for e in pkg['exports'] if e['isClassDefaultObject']], domain + ' root CDO')
        inv = one(pkg['cdoPropertyInventory'], domain + ' inventory')
        require(cdo['exportIndex'] == inv['exportIndex'], 'source CDO mismatch')
        nodes = list(property_nodes(inv['properties'], pointer + '/cdoPropertyInventory/0/properties'))
        for ref in semantic['resolution']['evidenceRefs']:
            ev = evidence[ref]; ep = ev['provenance']
            require(ep['datasetId'] == dataset and ep['packagePath'] == path and ep['packageHash'] == pkg['packageHash'], 'same-source Identity')
            if ep['artifactPath'] == shard:
                require(ep['extractionRunId'] == pkg['parse']['runId'], 'Identity parse run')
                observed, _ = one([(p, ptr) for p, ptr in nodes if ptr == ep['nodePointer']], 'Identity property pointer')
                require(observed['decoding'].get('value') == ev['observation']['value'] == assertion['rawIdentity'], 'Identity observed value')
            else:
                snapshot = read(ep['artifactPath'])
                require(snapshot['logicalPackage']['contentHash'] == pkg['packageHash'], 'full Raw same logical package')
        root_edges = []
        for eid in sorted(by_source[path], key=lambda i: (edges[i][0]['sourceOccurrence'].get('propertyPath', ''), i)):
            edge, eshard, epointer = edges[eid]; occ = edge['sourceOccurrence']
            if occ['kind'] != 'cdo-property':
                continue
            field = occ['propertyPath']; target = target_info(edge)
            prop, prop_ptr = one([(p, ptr) for p, ptr in nodes if p['path'] == field], domain + ':' + field)
            require(prop['decoding']['state'] == 'decoded', domain + ' undecoded edge')
            raw_ref = prop['decoding'].get('value')
            if edge['kind'] == 'object-property':
                require(isinstance(raw_ref, dict) and raw_ref['rawPackageIndex'] == occ['rawPackageIndex'], 'Raw reference mismatch')
            hsrc = source_relations[eid]
            href = [r for r in candidate['relations'] if r['edgeId'] == eid]
            require(len(hsrc) <= 1 and len(href) <= 1, 'Horizontal duplicate')
            if hsrc:
                hs = hsrc[0]
                require(hs['propertyPath'] == field and hs['sourcePackage'] == path
                        and hs['sourceRange'] == occ['sourceRange']
                        and hs['targetObject'] == edge.get('targetObject')
                        and hs['targetPackage'] == edge.get('targetPackage')
                        and hs['targetKind'] == edge['targetKind'], 'Horizontal/Structural mismatch')
                require(len(href) == 1 and href[0]['sourceRelationPathId'] == 'rp-root', 'Horizontal non-root')
            else:
                require(not href, 'dangling Horizontal ref')
            classification = ('ready-with-existing-kind' if field in {'Effect', 'ItemActorClass'}
                              else 'presentation-or-structural' if field in PRESENTATION
                              else 'native/runtime-boundary' if field.startswith('TypeHierarchy[')
                              else POLICIES[field][1] if field in POLICIES else 'semantic-ambiguous')
            rec = {'domainId': domain, 'sourcePackage': path, 'sourcePackageHash': pkg['packageHash'],
                   'sourceShard': eshard, 'sourceEdgePointer': epointer, 'sourcePropertyPointer': prop_ptr,
                   'edge': edge, 'target': target, 'horizontalSource': hsrc[0] if hsrc else None,
                   'horizontalReference': href[0] if href else None, 'classification': classification}
            root_edges.append(rec)
            if field in POLICIES:
                family, _, parent = POLICIES[field]
                expected_super = '/Script/' + ('Engine.' if parent == 'Actor' else 'Dungeons.') + parent
                require(target.get('directSuperclass') == expected_super, field + ' target role drift')
                require(target['cdo']['references']['template'].get('objectName') == 'Default__' + parent, 'target template drift')
                require(target['export']['references']['super'].get('objectName') == parent, 'target superclass ref drift')
                require(bool(hsrc) == (field in {'ProjectileItemSpec.ClassesToSpawn[0]', 'FishingHookActorClass', 'FishingRodActorClass', 'SpinWheelActorClass'}), 'Horizontal binding drift')
                candidates.append({**rec, 'family': family, 'existingKindCompatible': False})
            elif field not in PRESENTATION and field not in {'Effect', 'ItemActorClass'} and not field.startswith('TypeHierarchy['):
                unclassified.append(rec)
        # Every decoded reference-bearing root property must have a Structural edge.
        references = [p['path'] for p, _ in nodes if p['type']['value'] in {'ObjectProperty', 'ClassProperty', 'SoftObjectProperty'}]
        require(collections.Counter(references) == collections.Counter(r['edge']['sourceOccurrence']['propertyPath'] for r in root_edges), 'reference/edge completeness')
        rows.append({'domainId': domain, 'identityAssertion': assertion['id'], 'sourcePackage': path,
                     'sourceShard': shard, 'sourcePackagePointer': pointer, 'sourceCdo': cdo['objectName']['value'],
                     'sourceBoundary': parse_boundary(pkg), 'rootEdges': root_edges,
                     'nonCdoEdges': [{
                         'edgeId': edges[i][0]['id'], 'kind': edges[i][0]['kind'],
                         'sourceObject': edges[i][0]['sourceOccurrence'].get('sourceObject'),
                         'serializedField': edges[i][0]['sourceOccurrence'].get('serializedField'),
                         'targetKind': edges[i][0]['targetKind'],
                         'targetObject': edges[i][0].get('targetObject'),
                         'traversalResolution': edges[i][0]['traversal']['stopReason'],
                     } for i in by_source[path] if edges[i][0]['sourceOccurrence']['kind'] != 'cdo-property'],
                     'nonCdoEdgeKindCounts': dict(sorted(collections.Counter(edges[i][0]['kind'] for i in by_source[path]
                         if edges[i][0]['sourceOccurrence']['kind'] != 'cdo-property').items())),
                     'rootPropertyStates': [{'propertyPath': p['path'], 'type': p['type']['value'], 'decodingState': p['decoding']['state']}
                                            for p in inv['properties']]})
    require(not unclassified, 'unclassified new root edge; design review required')
    require(len(candidates) == 10, 'remaining edge count drift')
    all_edges = [r for row in rows for r in row['rootEdges']]
    presentation_support = []
    for path in sorted(wanted - root_paths - {None}):
        for eid in by_source[path]:
            edge, shard, pointer = edges[eid]
            if (edge['sourceOccurrence']['kind'] == 'cdo-property'
                    and edge['sourceOccurrence']['propertyPath'] in {'Paperdoll', 'UIData', 'iconClass'}):
                presentation_support.append({'edge': edge, 'sourceShard': shard,
                                             'sourceEdgePointer': pointer,
                                             'classification': 'presentation-or-structural'})
    artifact_domains = {r['domainId'] for r in rows}
    semantic_relations = relation['semantic']['relations']
    existing = {r['sourceDomainId'] for r in semantic_relations}
    current = {'schemaVersion': relation['schemaVersion'], 'semanticRelations': len(semantic_relations),
               'identityDomains': len(identity['semantic']['identities']), 'artifactIdentityDomains': len(rows),
               'relationKindCount': len({r['relationRef'].split(':')[-1].split('@')[0] for r in semantic_relations}),
               'projections': len(relation['relationProjections']), 'collections': len(relation['relationCollections']),
               'uniqueSourceDomains': len(existing),
               'artifactSourceDomains': len(existing & artifact_domains),
               'artifactRelationsByKind': dict(sorted(collections.Counter(r['relationRef'].split(':')[-1].split('@')[0]
                   for r in semantic_relations if r['sourceDomainId'] in artifact_domains).items())),
               'artifactValueDomains': len(value['semantic']['artifact'])}
    require(current['identityDomains'] == 152 and current['relationKindCount'] == 5
            and current['semanticRelations'] == current['projections'] == 225 and current['collections'] == 58
            and current['uniqueSourceDomains'] == 145 and current['artifactSourceDomains'] == 16
            and current['artifactRelationsByKind'] == {'effect': 10, 'item-actor': 11}
            and current['artifactValueDomains'] == 3, 'Formal counts drift')
    new_ref = 'relation:spinblade:spin-wheel-actor@1'
    new_projection = 'projection:' + new_ref + ':source'
    require(all(r['relationRef'] != new_ref for r in semantic_relations), 'new RelationRef collision')
    require(all(r['projectionRef'] != new_projection for r in relation['relationProjections']), 'new projection collision')
    output = {'auditKind': 'artifact-remaining-relation-semantic-design-census', 'baselineMain': BASELINE,
              'baselineTree': TREE, 'equivalentCommit': EQUIVALENT,
              'baselineEquivalenceEvidence': f'https://github.com/nantes-rfli/minecraft-dungeons_optimizer/compare/{EQUIVALENT}...{BASELINE}',
              'inputSha256': dict(sorted(input_hashes.items())), 'datasetId': dataset,
              'verifiedShardCount': len(verified_shards), 'domainCount': len(rows),
              'rootEdgeCountsByKind': dict(sorted(collections.Counter(r['edge']['kind'] for r in all_edges).items())),
              'rootEdgeCountsByProperty': dict(sorted(collections.Counter(r['edge']['sourceOccurrence']['propertyPath'] for r in all_edges).items())),
              'classificationCounts': dict(sorted(collections.Counter(r['classification'] for r in all_edges).items())),
              'remainingCandidateCount': len(candidates), 'remainingFamilyCount': len({r['family'] for r in candidates}),
              'remainingCandidates': candidates, 'rows': rows, 'currentFormalState': current,
              'supplementalPresentationEdges': presentation_support,
              'nextWave': {'domainId': 'spinblade', 'kind': 'spin-wheel-actor', 'occurrence': {'domainId': 'spinblade', 'scopeRef': 'source'},
                           'relationRef': new_ref, 'projectionRef': new_projection,
                           'expectedPostWave': {**current, 'semanticRelations': 226, 'projections': 226, 'uniqueSourceDomains': 146,
                                                'relationKindCount': 6,
                                                'artifactSourceDomains': 17,
                                                'artifactRelationsByKind': {'effect': 10, 'item-actor': 11, 'spin-wheel-actor': 1}}}}
    serialized = json.dumps(output, ensure_ascii=False, indent=2, sort_keys=True) + '\n'
    if args.output:
        args.output.write_text(serialized)
    else:
        print(serialized, end='')


if __name__ == '__main__':
    main()
