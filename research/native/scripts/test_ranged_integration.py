import copy
import json
import unittest
from pathlib import Path

import check_ranged_integration as check
from build_ranged_domain import build_model, validate_model
from check_ranged_blueprints import Expressions, Reader, audit_expression, validate_saved

class RangedIntegrationTests(unittest.TestCase):
    def test_public_provenance_and_model(self):
        self.assertEqual(len(check.validate_public()),23)
        validate_saved(check.ROOT)
    def test_unknown_effective_values_cannot_become_neutral_or_supported(self):
        original=build_model(check.ROOT)
        for id in original['profiles']:
            for field in ['finalProjectileDamage','effectiveShotCycleSeconds']:
                for fake in [0,1,{'state':'known','value':0}]:
                    model=copy.deepcopy(original);model['profiles'][id][field]=fake
                    with self.assertRaises(ValueError):validate_model(check.ROOT,model)
    def test_baseline_cannot_be_rounded_or_power_scaled(self):
        model=build_model(check.ROOT)
        for id,mode,value in [('shortbow','charged',61.875),('longbow','uncharged',60),('bow','charged',12500),('heavy-crossbow','charged',0)]:
            bad=copy.deepcopy(model);bad['profiles'][id]['derivedCdoBaseline'][mode]=value
            with self.assertRaises(ValueError):validate_model(check.ROOT,bad)
    def test_native_defaults_cannot_become_raw_or_measured(self):
        model=build_model(check.ROOT)
        model['profiles']['heavy-crossbow']['parameters']['chargeTimeSeconds']['origin']='raw-cdo'
        with self.assertRaises(ValueError):validate_model(check.ROOT,model)
        model=build_model(check.ROOT);model['runtimePromotion']=True
        with self.assertRaises(ValueError):validate_model(check.ROOT,model)
    def test_unrecognized_blueprint_token_and_truncation_fail_closed(self):
        with self.assertRaises(ValueError):Expressions(bytes([255]),{},[]).expr()
        with self.assertRaises(ValueError):Reader(bytes([0])).u32()
    def test_unreviewed_blueprint_calls_and_contexts_fail_closed(self):
        with self.assertRaises(ValueError):audit_expression({'op':'virtual-call','name':{'name':'ApplyDamage'},'args':[]},{},{})
        with self.assertRaises(ValueError):audit_expression({'op':'context','object':{'op':'instance','property':{'name':'UnknownCombat','class':'ObjectProperty'}}},{},{})
        with self.assertRaises(ValueError):audit_expression({'op':'unknown'},{},{})
if __name__=='__main__':unittest.main()
