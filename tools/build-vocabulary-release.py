"""Build all distributions from one source. Never edit or clear learner storage."""
from pathlib import Path
import hashlib,json,re,zipfile
from urllib.parse import urlsplit,unquote
R=Path(__file__).resolve().parents[1]
VERSION='4.2.1'
s=(R/'index.html').read_text(encoding='utf-8');refs=[]
def local(url):
 p=urlsplit(url)
 if p.scheme or p.netloc:raise ValueError('External runtime dependency: '+url)
 path=(R/unquote(p.path)).resolve()
 if not path.is_relative_to(R) or not path.is_file():raise ValueError('Missing local runtime '+url)
 return path
portable=s.replace('<head>','<head>\n<meta name="distribution" content="offline">',1)
def script(m):
 url=m.group(1);refs.append(url);text=local(url).read_text(encoding='utf-8').replace('</script','<\\/script')
 return '<script data-bundled-src="'+url.split('?')[0]+'">\n'+text+'\n</script>'
portable=re.sub(r'<script\s+src="([^"]+)"[^>]*>\s*</script>',script,portable)
def style(m):
 tag=m.group(0);url=re.search(r'href="([^"]+)"',tag).group(1);refs.append(url)
 return '<style data-bundled-src="'+url.split('?')[0]+'">\n'+local(url).read_text(encoding='utf-8')+'\n</style>'
portable=re.sub(r'<link\b(?=[^>]*\brel="stylesheet")[^>]*>',style,portable)
portable=re.sub(r'<link\b(?=[^>]*\brel="(?:manifest|icon|apple-touch-icon)")[^>]*>','',portable)
portable=portable.replace('</body>','<script>document.getElementById("offlineStatus").textContent="独立学习文件 · V4.2.1";document.getElementById("offlineDetail").textContent="课程已包含在本文件内，不需要下载网页缓存。学习记录仍属于当前浏览器；请定期导出备份。";document.getElementById("offlineSave").hidden=true;document.getElementById("offlineUpdate").hidden=true;</script>\n</body>')
out=R/'downloads/jiangsu-english-offline.html';out.write_text(portable,encoding='utf-8')
zpath=R/'downloads/jiangsu-english-complete.zip'
with zipfile.ZipFile(zpath) as old:contents={n:old.read(n) for n in old.namelist()}
targets=[n for n in contents if n.endswith('/index.html')]
if len(targets)!=1:raise ValueError('Unexpected family archive structure')
contents[targets[0]]=portable.encode()
with zipfile.ZipFile(zpath,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as new:
 for name,body in contents.items():
  info=zipfile.ZipInfo(name,date_time=(2026,11,8,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;new.writestr(info,body)
sw=(R/'sw.js').read_text();m=re.search(r'const BUILD = (.*?);\n',sw);build=json.loads(m.group(1))
urls=['./']+[a['url'].replace('?v=4.1.1','?v='+VERSION).replace('?v=4.2.0','?v='+VERSION) for a in build['assets'] if a['url']!='./']+refs
urls=list(dict.fromkeys(urls))
def entry(url):
 data=(R/'index.html' if url=='./' else local(url)).read_bytes()
 return {'url':url,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)}
assets=[entry(u) for u in urls];downloads=[entry('downloads/jiangsu-english-offline.html')]
build.update(version=VERSION,id=VERSION+'-'+hashlib.sha256(json.dumps(assets,sort_keys=True).encode()).hexdigest()[:16],assets=assets,downloads=downloads,bytes=sum(x['bytes'] for x in assets),downloadBytes=sum(x['bytes'] for x in downloads))
sw=sw[:m.start(1)]+json.dumps(build,separators=(',',':'))+sw[m.end(1):];(R/'sw.js').write_text(sw)
report={'version':VERSION,'buildId':build['id'],'assets':len(assets),'coreBytes':build['bytes'],'portableBytes':out.stat().st_size,'familyZipBytes':zpath.stat().st_size}
(R/'release-vocabulary.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
