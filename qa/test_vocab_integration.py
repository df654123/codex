import json, unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class VocabularyIntegrationTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  raw=(ROOT/'curriculum-data.js').read_text(encoding='utf-8')
  cls.data=json.loads(raw.split('=',1)[1].strip().rstrip(';'))
  cls.units={u['id']:u for u in cls.data['units']}
 def test_unit1_has_41_cross_checked_items_plus_4_extensions(self):
  u=self.units['7a-u1']; self.assertEqual(len(u['vocabulary']),45)
  self.assertEqual(sum(w.get('category') in ('textbook_word','textbook_phrase') for w in u['vocabulary']),41)
  self.assertEqual(sum(w.get('category')=='extension' for w in u['vocabulary']),4)
  for term in ['greet','introduce','each other','go by','hobby','be full of','energy','be interested in','make friends with']:
   self.assertIn(term,{w['word'] for w in u['vocabulary']})
 def test_existing_review_ids_and_positions_are_stable(self):
  u=self.units['7a-u1']; self.assertEqual([w['word'] for w in u['vocabulary'][:8]],['introduce','classmate','friendly','quiet','ready','favourite','name','new'])
  self.assertEqual([w['reviewId'] for w in u['vocabulary'][:8]],list(range(8)))
 def test_other_units_are_not_claimed_as_full_textbook_lists(self):
  for uid in ['7a-u2','7a-u3','7b-u1','8a-u1','8b-u1','9a-u1','9b-u1']:
   self.assertNotIn('vocabularyAlignment',self.units[uid])
 def test_no_unverified_phonetics_are_invented(self):
  self.assertTrue(all('phonetic' not in w for w in self.units['7a-u1']['vocabulary']))
if __name__=='__main__': unittest.main()
