"""Idempotent repairs found by reviewing actual browser logs, not just job status."""
from pathlib import Path
R=Path(__file__).resolve().parents[1]
p=R/'curriculum-app.js';s=p.read_text(encoding='utf-8')
old="if (el.dataset.cquestion !== undefined && currentQuiz) { const d = state.quizDrafts[currentQuiz.key];"
new="if (el.dataset.cquestion !== undefined && currentQuiz) { const qs = questionsFor(unit(),currentQuiz.kind,currentQuiz.variant); const d = state.quizDrafts[currentQuiz.key];"
if old in s:s=s.replace(old,new)
elif new not in s:raise ValueError('Quiz change handler not found')
p.write_text(s,encoding='utf-8')
p=R/'qa/browser_revision.py';s=p.read_text(encoding='utf-8')
s=s.replace("  self.context.close()\n def test_01", "  self.context.close()\n  self.assertEqual(self.errors,[], 'Uncaught page errors are a release blocker')\n def test_01")
if 'def test_10_portable_file_origin' not in s:
 s=s.replace("if __name__=='__main__':",''' def test_10_portable_file_origin(self):
  self.page.goto((ROOT/'downloads/jiangsu-english-offline.html').as_uri()+'#publishers')
  self.page.wait_for_function('window.PublisherVocab && window.LearningStartupReady')
  self.assertEqual(self.page.evaluate('ENGLISH_CURRICULUM.version'),'3.9')
  self.assertEqual(self.errors,[])
if __name__=='__main__':''')
p.write_text(s,encoding='utf-8')
p=R/'publisher-vocab-app.js';s=p.read_text(encoding='utf-8')
s=s.replace(" if(event)state=merge(state,{schemaVersion:1,events:[event]});\n",'')
s=s.replace(" try{if(navigator.locks?.request)"," try{if(event)state=merge(state,{schemaVersion:1,events:[event]});if(navigator.locks?.request)")
p.write_text(s,encoding='utf-8')
print('Fixed answer-counter scope; enabled page-error release gate; protected event-limit failure handling.')
