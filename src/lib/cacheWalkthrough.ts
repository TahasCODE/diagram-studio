import type { Diagram } from './model';

export const CACHE_CHOICE_STEP=3;
export const cacheWalkthrough:Diagram={
  title:'What happens when the cache goes down?',
  nodes:[
    {id:'read',label:'Read request',x:16,y:20,notes:'A customer opens a product page. The API needs the product details to answer the read request.'},
    {id:'api',label:'API receives request',x:38,y:20,notes:'The API looks for a cached copy before asking PostgreSQL, the source of truth.'},
    {id:'redis',label:'Look up value in Redis',x:60,y:20,notes:'A cache hit would avoid a database query. This time, Redis cannot answer.'},
    {id:'cache-down',label:'Redis is unavailable',x:82,y:20,notes:'The cache attempt times out. Imagine a 50 ms cache timeout budget: this figure is illustrative, not measured. What should the API do next?'},
    {id:'postgres',label:'Read from PostgreSQL',x:38,y:52,notes:'The API bypasses Redis and reads the source of truth. This adds a database query after the failed cache attempt. Many simultaneous fallbacks could overload PostgreSQL.'},
    {id:'success',label:'Return data (200)',x:60,y:52,notes:'The request succeeds with HTTP 200. Keeping reads available costs extra latency and database load. A production fallback needs capacity limits; it is not unlimited safety.'},
    {id:'temporary-error',label:'Return temporary error (503)',x:82,y:52,notes:'The API returns HTTP 503 without reading PostgreSQL. This protects database capacity, but the customer receives no product data for this request.'},
    {id:'retry-later',label:'Client can retry later',x:82,y:82,notes:'The request failed. The client may retry later with a bounded retry policy and backoff. Uncontrolled retries could create another traffic spike.'},
  ],
  scenarios:[
    {name:'Fall back to PostgreSQL',description:'Keep this read available by querying PostgreSQL. The tradeoff is extra latency and more database load.',steps:['read','api','redis','cache-down','postgres','success']},
    {name:'Return a temporary error',description:'Protect database capacity by returning HTTP 503. The tradeoff is that this request fails and the client must try again later.',steps:['read','api','redis','cache-down','temporary-error','retry-later']},
  ],
};
