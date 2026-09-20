"""Render an offline, read-only gallery beside an isolated pair manifest."""
import argparse
import json
from pathlib import Path


PAGE = """<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Local photo candidate review</title>
<style>
body{background:#10141c;color:#edf1fa;font:16px system-ui;margin:24px auto;max-width:1400px;padding:0 16px}
article{border-top:1px solid #445;margin:32px 0;padding-top:16px}h2{font-size:17px;overflow-wrap:anywhere}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}.pair img{width:100%;display:block}
figure{margin:0}figcaption{padding:8px 0;color:#b7c8e0}.crop{display:flex;gap:12px;flex-wrap:wrap}
canvas{max-width:44vw;border:1px solid #445}summary{cursor:pointer;margin:12px 0}
</style><h1>Local photo candidate review</h1>
<p>Unapproved candidates. Compare the full pair, then expand the detail crops to inspect the edit.
This gallery does not change curation status or publish content remotely.</p><main id="gallery"></main>
<script>
const entries = __ENTRIES__;
for(const entry of entries){
 const article=document.createElement('article');
 const title=document.createElement('h2');title.textContent=entry.id;article.append(title);
 const pair=document.createElement('div');pair.className='pair';article.append(pair);
 const details=document.createElement('details');const summary=document.createElement('summary');
 summary.textContent='Inspect the difference';details.append(summary);
 const crops=document.createElement('div');crops.className='crop';details.append(crops);
 for(const [label,path] of [['Base',entry.baseImage],['Variant',entry.variantImage]]){
  const figure=document.createElement('figure');const caption=document.createElement('figcaption');
  caption.textContent=label;figure.append(caption);const img=new Image();
  img.alt=label+' — '+entry.id;img.loading='lazy';figure.append(img);pair.append(figure);
  const canvas=document.createElement('canvas');canvas.width=240;canvas.height=240;crops.append(canvas);
  img.onload=()=>{const diff=entry.diffs[0],size=Math.max(100,Math.min(img.naturalWidth,img.naturalHeight)*diff.radius/100*3);
   const x=Math.max(0,Math.min(img.naturalWidth-size,img.naturalWidth*diff.x/100-size/2));
   const y=Math.max(0,Math.min(img.naturalHeight-size,img.naturalHeight*diff.y/100-size/2));
   canvas.getContext('2d').drawImage(img,x,y,size,size,0,0,240,240);};
  img.src=path;
 }
 article.append(details);document.getElementById('gallery').append(article);
}
</script></html>"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    args = parser.parse_args()
    entries = json.loads(args.manifest.read_text(encoding="utf-8"))
    # Escape HTML script terminators in arbitrary imported titles/metadata.
    payload = json.dumps(entries).replace("<", "\\u003c")
    output = args.manifest.parent / "review.html"
    output.write_text(PAGE.replace("__ENTRIES__", payload), encoding="utf-8")
    print(output.resolve())


if __name__ == "__main__":
    main()
