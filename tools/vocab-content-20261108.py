"""Source-scoped vocabulary data. Definitions/examples are authored; no textbook scan is published."""
from pathlib import Path
import json
R=Path(__file__).resolve().parents[1]
(R/'content').mkdir(exist_ok=True)
order='greet|introduce|each other|go by|glad|same|hobby|grade|classmate|friendly|full|be full of|energy|be good at|slim|polite|smart|ready|be ready to do sth.|other|interested|be interested in|looks|character|both|enjoy|pretty|shy|only|stay|match|luck|good luck|chess|Chinese chess|problem|weekend|at the weekend|fun|make friends with'.split('|')
rows='''jogging|n.|慢跑锻炼|We go jogging in the park before breakfast.
painting|n.|绘画；绘画作品|Painting helps me notice the colours around me.
paper-cutting|n.|剪纸艺术|My grandmother shows me how to do paper-cutting.
all kinds of|phr.|各种各样的|Our club welcomes all kinds of ideas.
fit|adj.|健康的；身体好的|Walking to school helps me keep fit.
around|prep.|围绕；在……周围|We sit around the table and share our drawings.
change|v.|改变；使发生变化|A new hobby can change the way we spend our weekends.
life|n.|生活；生命|Music is an important part of her life.
museum|n.|博物馆|We visit a local museum to learn about old toys.
thing|n.|东西；事情|The first thing I draw is a leaf.
fun|n.|乐趣；好玩的事|We have fun making small paper boats.
apart|adv.|分开|Keep the two broken pieces apart.
take ... apart|phr.|把……拆开|We take the old clock apart to see how it works.
fix|v.|修理；安装|My uncle helps me fix my broken toy.
endless|adj.|无穷无尽的|The children seem to have endless questions about space.
scientist|n.|科学家|The scientist studies how plants grow in dry places.
dream|n.|梦想；梦|Her dream is to build a useful robot.
true|adj.|真实的；确实的|Is the story about the young inventor true?
come true|phr.|实现；成为现实|I work hard to help my dream come true.
paint|v.|用颜料画；刷油漆|I paint a green tree on the card.
club|n.|社团；俱乐部|Our school has a chess club.
member|n.|成员|Every member brings one idea to the meeting.
geography|n.|地理学；地理课|In geography we learn why places have different weather.
p.m.|abbr.|下午；午后|Our club meets at 4 p.m. on Thursday.
volleyball|n.|排球运动|We play volleyball after school.
each|det., pron. & adv.|每个；各自|Each member chooses a different colour.
once|adv.|一次|We meet once a week to share our work.
join|v.|加入；和……一起参加|May I join your art club?
meeting|n.|会议；会面|Our first meeting is in the library.
sound|linking v.|听起来|Your idea sounds interesting.
plan|v.|计划；打算|We plan to make a model bridge.
questionnaire|n.|问卷；调查表|Please complete this questionnaire about school clubs.
role|n.|角色|What role do you play in the school show?
model|n.|模范；典型；模特儿|Our coach is a model of patience.
role model|n.|榜样；楷模|My sister is my role model because she never gives up.
design|v.|设计|We design a poster for the reading club.
skill|n.|技能；技艺|Drawing faces is a skill I want to develop.
artist|n.|艺术家；画家|The artist draws birds by the river.
master|n.|大师；能手|The master teaches young artists to cut paper carefully.
work|n.|作品|We display our best works at the school art show.
become|linking v.|成为；变得|I hope to become a designer one day.
designer|n.|设计师|The designer makes bags from used cloth.
would|modal v.|用于表达意愿等|I would like to learn paper-cutting.
would like|phr.|想要；愿意|Would you like to visit our art room?
future|n.|将来；未来|What job would you like to do in the future?
in the future|phr.|在将来|I want to design useful tools in the future.
hope|v.|希望|We hope to share our paintings with more people.'''
u2=[]
for i,line in enumerate(rows.splitlines(),1):
 w,pos,meaning,example=line.split('|');u2.append(dict(word=w,partOfSpeech=pos,meaning=meaning,example=example,displayOrder=i,recognitionOnly=w in ['apart','questionnaire']))
(R/'content/yilin-revision.json').write_text(json.dumps({'u1Order':{w:i+1 for i,w in enumerate(order)},'u2':u2},ensure_ascii=False,indent=2),encoding='utf-8')
pep='''get to know|phr.|逐渐认识；了解|Our class games help us get to know each other.|20
full name|phr.|全名|Please write your full name on this card.|20
grade|n.|年级|My cousin is in Grade Seven.|20
last name|phr.|姓氏|My last name is Li.|20
classmate|n.|同班同学|My new classmate likes reading too.|21
first name|phr.|名字（与姓氏区分）|In the name Alex Brown, Alex is the first name.|21
mistake|n.|错误；失误|I correct a spelling mistake in my note.|21
country|n.|国家|Which country would you like to learn more about?|22
same|adj.|相同的|We are in the same class.|23
both|adj. & pron.|两个都；双方|Both of my friends like chess.|23
information|n.|信息；资料|The school website gives us information about clubs.|25
hobby|n.|业余爱好|My hobby is drawing pictures of birds.|25'''
entries=[]
for line in pep.splitlines():
 w,pos,m,e,p=line.split('|');entries.append({'id':'rj-2024-7a-u1-'+w.replace(' ','_'),'word':w,'pos':pos,'meaning':m,'example':e,'page':int(p)})
data={'schemaVersion':1,'publisher':'人民教育出版社','book':'七年级上册','edition':'2024 修订体系（2026 印次未确认）','status':'词汇试学 · 12 项，非完整词表','officialUrl':'https://www.pep.com.cn/zslth/yyptzy/czyy/7s/','readerUrl':'https://book.pep.com.cn/1312001101241/','referenceUrl':'https://16583849.s21i.faiusr.com/61/2/ABUIABA9GAAggIGNvAYogKLPnAU.pdf','sourceNote':'目录来自人教社官网。12项成员与页码来自第三方托管教材文本副本的106—107页，未完成官方原页与最新印次核验。释义为站内教学释义，例句为原创；未录入音标。','units':[{'id':f'rj-2024-7a-s{i+1}','title':'Starter '+str(i+1)+' · '+t} for i,t in enumerate(['Hello!','Keep Tidy!','Welcome!'])]+[{'id':f'rj-2024-7a-u{i+1}','title':'Unit '+str(i+1)+' · '+t} for i,t in enumerate(['You and Me','We’re Family!','My School','My Favourite Subject','Fun Clubs','A Day in the Life','Happy Birthday!'])],'entries':entries}
(R/'publisher-vocab-data.js').write_text('window.PUBLISHER_VOCAB_DATA = '+json.dumps(data,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
print('Reference U1:',len(order),'reference U2:',len(u2),'Renjiao pilot:',len(entries))
