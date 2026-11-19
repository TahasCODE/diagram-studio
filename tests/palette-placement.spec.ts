import {test,expect} from '@playwright/test';
const order={title:'Order fulfillment',nodes:[
  {id:'receive',label:'Receive order',x:14,y:50},{id:'check',label:'Check inventory',x:37,y:50},
  {id:'pack',label:'Pack order',x:62,y:32},{id:'ship',label:'Ship order',x:86,y:32},{id:'restock',label:'Wait for restock',x:62,y:72}
],scenarios:[{name:'In stock',steps:['receive','check','pack','ship']},{name:'Restocked later',steps:['receive','check','restock','pack','ship']}]};
for(const width of [1440,1024,390])test(`palette cards do not cover the existing order flow at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:800});await page.emulateMedia({reducedMotion:'reduce'});
 await page.route(/^https:\/\/fonts\./,r=>r.abort());
 await page.addInitScript(d=>localStorage.setItem('diagram-studio-v1',JSON.stringify(d)),order);
 await page.goto('/');
 if(width<1024)await page.getByRole('button',{name:'Open Inspector',exact:true}).click();
 await page.getByRole('tab',{name:'Editor',exact:true}).click();
 for(const type of ['Client','API','Service','Database','Cache','Queue','Decision']){
  await page.getByRole('button',{name:'Add '+type,exact:true}).click();
  await expect(page.locator('#label')).toHaveValue(type);
  const overlaps=await page.locator('.node').evaluateAll((nodes,label)=>{
   const card=nodes.find(n=>n.getAttribute('aria-label')===label)!.getBoundingClientRect();
   return nodes.filter(n=>n.getAttribute('aria-label')!==label).filter(n=>{
    const other=n.getBoundingClientRect();return Math.min(card.right,other.right)-Math.max(card.left,other.left)>1&&Math.min(card.bottom,other.bottom)-Math.max(card.top,other.top)>1;
   }).map(n=>n.getAttribute('aria-label'));
  },type);
  expect(overlaps).toEqual([]);
 }
 await expect(page.locator('.node')).toHaveCount(12);
 await page.getByRole('button',{name:'Arrange Nodes',exact:true}).click();
 await expect.poll(()=>page.locator('.node').evaluateAll(nodes=>nodes.every((n,i)=>{
  const a=n.getBoundingClientRect();return nodes.slice(i+1).every(other=>{
   const b=other.getBoundingClientRect();return Math.min(a.right,b.right)-Math.max(a.left,b.left)<=1||Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)<=1;
  });
 }))).toBe(true);
 if(width<1024)await page.getByRole('button',{name:'Close Inspector',exact:true}).click();
 await page.getByRole('button',{name:'Fit Diagram',exact:true}).click();
 await page.screenshot({path:`.runtime/palette-placement-${width}.png`});
});
