from PIL import Image, ImageDraw, ImageFont
import json,zlib,base64
from pathlib import Path
chars=''.join(chr(i) for i in range(32,127))+''.join(chr(i) for i in range(160,256))+"‘’“”—–…•"
fonts={}
for name,path in [('sans','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'),('bold','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'),('serif','/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf')]:
 f=ImageFont.truetype(path,144);fonts[name]={}
 for c in chars:
  l,t,r,b=f.getbbox(c);w=max(1,r-l);h=max(1,b-t);im=Image.new('L',(w,h));ImageDraw.Draw(im).text((-l,-t),c,font=f,fill=255)
  raw=im.tobytes();encoded=[];last=raw[0];n=0
  for v in raw:
   if v!=last or n==255:encoded.extend([n,last]);n=0;last=v
   n+=1
  encoded.extend([n,last])
  fonts[name][c]={'w':w,'h':h,'x':l,'y':t,'a':round(f.getlength(c),3),'r':base64.b64encode(bytes(encoded)).decode()}
Path('lib/church/font-atlas.json').write_text(json.dumps(fonts,separators=(',',':')))
print('Generated original text rendering atlas:',Path('lib/church/font-atlas.json').stat().st_size,'bytes')
