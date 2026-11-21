import unittest
from check_armor_coverage import model_miss, f32
class ArmorResearchTests(unittest.TestCase):
    def test_lcg_wrap(self):
        self.assertEqual(model_miss(0xffffffff,0)[0],(0x3619636b-0x0bb38435)&0xffffffff)
    def test_threshold(self):
        inv=pow(0x0bb38435,-1,2**32)
        for next_state,hit in [(2516582,True),(2516583,False)]:
            seed=((next_state-0x3619636b)*inv)&0xffffffff
            self.assertEqual(model_miss(seed,f32(.3)),(next_state,hit))
    def test_zero_and_one(self):
        for s in [0,1,0xffffffff]:
            self.assertFalse(model_miss(s,0)[1]);self.assertTrue(model_miss(s,1)[1])
if __name__=='__main__':unittest.main()
