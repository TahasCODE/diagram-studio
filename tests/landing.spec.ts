import {test,expect} from '@playwright/test';
import {examples} from '../src/lib/examples';

for(const width of [1440,1024,390])test(`product page scrolls to its footer and preserves the workspace at ${width}px`,async({page,context})=>{
  await context.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//,route=>route.abort());
  await page.setViewportSize({width,height:900});
  const workspace=JSON.stringify({...examples.refund,title:'My existing explanation'});
  await page.addInitScript(value=>{if(!localStorage.getItem('diagram-studio-v1'))localStorage.setItem('diagram-studio-v1',value);},workspace);
  const writes:string[]=[];page.on('request',r=>{if(r.url().includes('/api/')&&r.method()!=='GET')writes.push(r.url());});
  await page.goto('/welcome');
  await expect(page.getByRole('heading',{level:1})).toHaveText(/Show how your\s*system behaves\./);
  expect(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`.runtime/landing-${width}-light.png`});
  await page.getByRole('button',{name:'Use Dark Theme',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.screenshot({path:`.runtime/landing-${width}-dark.png`});
  const footer=page.getByRole('contentinfo');await footer.scrollIntoViewIfNeeded();
  await expect(footer).toContainText('Designed & built by Taha Waheed');
  await expect(footer.getByRole('link',{name:'LinkedIn',exact:false})).toHaveAttribute('href','https://www.linkedin.com/in/taha-khan-970a743bb');
  await page.screenshot({path:`.runtime/landing-footer-${width}.png`});
  await expect(footer.getByRole('link',{name:'GitHub',exact:true})).toHaveAttribute('href','https://github.com/TahasCODE/diagram-studio');
  await expect(footer.getByRole('link',{name:'API Reference',exact:true})).toHaveAttribute('href','/api/docs');
  await footer.getByRole('link',{name:'Demo Limits',exact:true}).click();
  await expect(page.locator('#demo-limits')).toBeInViewport();
  await expect(page.locator('#demo-limits')).toContainText('collaboration and comments are disabled');
  expect(await page.evaluate(()=>localStorage.getItem('diagram-studio-v1'))).toBe(workspace);
  expect(writes).toEqual([]);
  await page.getByRole('link',{name:'Open Studio',exact:false}).first().click();
  await expect(page.locator('#project-heading')).toHaveText('My existing explanation');
  const help=page.getByLabel('Help & About',{exact:true});await help.click();
  await expect(page.getByRole('navigation',{name:'Help & About Links'})).toBeVisible();
  await page.screenshot({path:`.runtime/help-${width}.png`});
  await page.keyboard.press('Escape');await expect(help).toBeFocused();
  await expect(page.getByRole('navigation',{name:'Help & About Links'})).toBeHidden();
  await help.click();await page.getByRole('link',{name:'Product Home',exact:true}).click();
  await expect(page).toHaveURL('/welcome');await expect(page.getByRole('heading',{level:1})).toBeVisible();
  await page.goto('/welcome#about');await expect(page.locator('#about')).toBeInViewport();
});

test('landing video plays with captions and walkthrough URLs still enter playback',async({page,context})=>{
  await context.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//,route=>route.abort());
  await page.goto('/welcome/');
  await expect(page.getByRole('heading',{level:1})).toBeVisible();
  await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Skip to content'})).toBeFocused();
  const video=page.getByLabel('Captioned Diagram Studio guest demonstration');
  await video.scrollIntoViewIfNeeded();
  await video.evaluate(async element=>{const v=element as HTMLVideoElement;v.muted=true;await v.play();});
  await expect.poll(()=>video.evaluate(element=>(element as HTMLVideoElement).currentTime)).toBeGreaterThan(0);
  const metadata=await video.evaluate(element=>{const v=element as HTMLVideoElement;v.pause();return{duration:v.duration,captions:v.textTracks[0]?.cues?.length};});
  expect(metadata.duration).toBeGreaterThan(80);expect(metadata.captions).toBeGreaterThan(0);
  await page.getByRole('link',{name:'Try the Walkthrough',exact:false}).click();
  await expect(page).toHaveURL('/?walkthrough=cache-outage');
  await expect(page.getByRole('button',{name:'Start Walkthrough',exact:true})).toBeVisible();
});

test('website Sign In opens the full-app form without replacing the local draft',async({page,context})=>{
  await context.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//,route=>route.abort());
  await page.addInitScript(document=>localStorage.setItem('diagram-studio-v1',JSON.stringify(document)),{...examples.refund,title:'Preserve my local work'});
  await page.goto('/welcome');
  const signIn=page.getByRole('navigation',{name:'Website Navigation'}).getByRole('link',{name:'Sign In',exact:true});
  await expect(signIn).toHaveAttribute('href','/?signin=1');await signIn.click();
  await expect(page.getByRole('dialog',{name:'Sign In to Diagram Studio',exact:true})).toBeVisible();
  await expect(page.locator('#project-heading')).toHaveText('Preserve my local work');
  await expect(page).toHaveURL('/');
});

test('guest website Sign In explains the limitation without showing account forms',async({page,context})=>{
  await context.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//,route=>route.abort());
  await context.route('**/api/auth/me',route=>route.fulfill({json:{user:null,csrfToken:'guest-capability-test',accountsEnabled:false}}));
  await page.goto('/welcome');
  const signIn=page.getByRole('navigation',{name:'Website Navigation'}).getByRole('link',{name:'Sign In',exact:true});
  await expect(signIn).not.toHaveAttribute('aria-disabled','true');
  await expect(signIn).toHaveAttribute('href','#demo-limits');await signIn.click();
  await expect(page.locator('#demo-limits')).toBeInViewport();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Open Studio shows a workspace skeleton while the editor module loads',async({page,context})=>{
  await context.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//,route=>route.abort());
  let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve;});
  await page.route(/\/(?:src\/App\.tsx|assets\/App-[^/]+\.js)(?:\?.*)?$/,async route=>{await pending;await route.continue();});
  try{
    await page.goto('/welcome');await expect(page.getByRole('heading',{level:1})).toBeVisible();
    await page.getByRole('link',{name:'Open Studio',exact:false}).first().click({noWaitAfter:true});
    const loading=page.getByRole('status',{name:'Loading workspace',exact:true});
    await expect(loading).toBeVisible();await expect(page.getByText('Loading Diagram Studio…',{exact:true})).toHaveCount(0);
    await page.screenshot({path:'.runtime/workspace-loading.png'});
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:'.runtime/workspace-loading-mobile.png'});
    release();await expect(page.locator('#project-heading')).toBeVisible();await expect(loading).toHaveCount(0);
  }finally{release();}
});
