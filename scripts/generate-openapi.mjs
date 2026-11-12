import fs from 'node:fs';
const ref=name=>({$ref:'#/components/schemas/'+name});
const json=schema=>({content:{'application/json':{schema}}});
const error={description:'Request failed',content:{'application/problem+json':{schema:ref('Error')}}};
const auth={cookieAuth:[]};
const write={cookieAuth:[],csrfToken:[]};
const idParameter={name:'id',in:'path',required:true,schema:{type:'string',format:'uuid'}};
function operation(operationId,description,method,response,body,security=[],extra={}) {
  return {operationId,description,security,...(body?{requestBody:{required:true,...json(body)}}:{}),responses:{[method==='post'&&operationId!=='login'&&operationId!=='logout'&&operationId!=='restoreRevision'?'201':method==='delete'||operationId==='logout'?'204':'200']:{description:'Successful response',...(response?json(response):{})},'400':error,'401':error,'403':error,...extra}};
}
const optionalText=max=>({type:['string','null'],maxLength:max});
const schemas={
 Error:{type:'object',required:['type','title','status','detail','message','instance','requestId'],properties:{type:{type:'string'},title:{type:'string'},status:{type:'integer'},detail:{type:'string'},message:{type:'string'},instance:{type:'string'},requestId:{type:'string',format:'uuid'},timestamp:{type:'string',format:'date-time'},errors:{type:'array',items:{type:'object',properties:{field:{type:'string'},message:{type:'string'}}}}}},
 Account:{type:'object',required:['id','name','email'],properties:{id:{type:'string',format:'uuid'},name:{type:'string'},email:{type:'string',format:'email'}}},
 Session:{type:'object',required:['user','csrfToken'],properties:{user:{anyOf:[ref('Account'),{type:'null'}]},csrfToken:{type:'string'}}},
 Node:{type:'object',required:['id','label','x','y'],properties:{id:{type:'string',minLength:1,maxLength:100},label:{type:'string',minLength:1,maxLength:48},x:{type:'number',minimum:0,maximum:100},y:{type:'number',minimum:0,maximum:100},notes:optionalText(2000)}},
 Scenario:{type:'object',required:['name','steps'],properties:{name:{type:'string',minLength:1,maxLength:48},steps:{type:'array',maxItems:500,items:{type:'string'}},description:optionalText(2000),review:{type:['array','null'],maxItems:100,items:{type:'string',minLength:1,maxLength:500}}}},
 Diagram:{type:'object',required:['nodes','scenarios'],properties:{title:optionalText(80),nodes:{type:'array',maxItems:250,items:ref('Node')},scenarios:{type:'array',minItems:1,maxItems:100,items:ref('Scenario')}}},
 Draft:{type:'object',required:['id','version','updatedAt','document'],properties:{id:{type:'string',format:'uuid'},version:{type:'integer',minimum:1},updatedAt:{type:'string',format:'date-time'},document:ref('Diagram')}},
 ProjectSummary:{type:'object',properties:{id:{type:'string',format:'uuid'},title:{type:'string'},version:{type:'integer'},updatedAt:{type:'string',format:'date-time'}}},
 PublicationSummary:{type:'object',properties:{id:{type:'string',format:'uuid'},title:{type:'string'},createdAt:{type:'string',format:'date-time'}}},
 Publication:{allOf:[ref('PublicationSummary'),{type:'object',required:['document'],properties:{document:ref('Diagram')}}]},
};
const object=(properties,required=Object.keys(properties))=>({type:'object',required,properties});
const version={type:'integer',minimum:1};
schemas.RevisionSummary=object({version,title:{type:'string'},createdAt:{type:'string',format:'date-time'}});
schemas.Revision={allOf:[ref('RevisionSummary'),object({document:ref('Diagram')})]};
schemas.ProjectPage=object({items:{type:'array',items:ref('ProjectSummary')},page:{type:'integer'},size:{type:'integer'},total:{type:'integer'},totalPages:{type:'integer'}});
schemas.AuditEvent=object({id:{type:'integer'},projectId:{type:'string',format:'uuid'},action:{type:'string'},version:{type:['integer','null']},requestId:{type:['string','null']},createdAt:{type:'string',format:'date-time'}});
schemas.ActivityPage=object({items:{type:'array',items:ref('AuditEvent')},page:{type:'integer'},size:{type:'integer'},total:{type:'integer'},totalPages:{type:'integer'}});
const paging=[{name:'page',in:'query',schema:{type:'integer',minimum:0,maximum:10000,default:0}},{name:'size',in:'query',schema:{type:'integer',minimum:1,maximum:50,default:12}}];
const paths={
 '/auth/me':{get:operation('session','Returns the current account and a CSRF token. Creates an anonymous session when signed out.','get',ref('Session'))},
 '/auth/register':{post:operation('register','Creates an account without signing in. Submit credentials to /auth/login next.','post',ref('Account'),object({name:{type:'string',minLength:1,maxLength:80},email:{type:'string',format:'email',maxLength:254},password:{type:'string',minLength:10,maxLength:72}}),[write],{'409':error})},
 '/auth/login':{post:operation('login','Signs in. Passwords are compared using bcrypt. Errors do not reveal which credential was wrong.','post',ref('Account'),object({email:{type:'string',format:'email'},password:{type:'string',maxLength:72}}),[write])},
 '/auth/logout':{post:operation('logout','Invalidates the current session. Fetch /auth/me again before the next write.','post',null,null,[write])},
 '/activity':{get:{...operation('listActivity','Returns owned audit events, including events for deleted projects. Document content and credentials are excluded.','get',ref('ActivityPage'),null,[auth]),parameters:[...paging,{name:'projectId',in:'query',schema:{type:'string',format:'uuid'}}]}},
 '/openapi.json':{get:operation('apiSpecification','Returns this OpenAPI specification.','get',{type:'object'},null,[])},
 '/docs':{get:{operationId:'apiDocumentation',description:'Human-readable API reference.',security:[],responses:{200:{description:'HTML documentation',content:{'text/html':{schema:{type:'string'}}}}}}},
 '/health':{get:operation('health','Checks database reachability.','get',object({status:{const:'ok'}}),null,[],{'503':error})},
 '/projects':{get:{...operation('listProjects','Returns a bounded searchable page of owned projects.','get',ref('ProjectPage'),null,[auth]),parameters:[...paging,{name:'q',in:'query',schema:{type:'string',maxLength:80,default:''}}]},post:operation('createProject','Creates an owned private draft. Node IDs must be unique and steps must reference existing nodes.','post',ref('Draft'),object({document:ref('Diagram')}),[write])},
 '/projects/{id}':{parameters:[idParameter],get:operation('getProject','Loads an owned draft; returns 404 for nonexistent and non-owned IDs.','get',ref('Draft'),null,[auth],{'404':error}),put:operation('updateProject','Saves only if the supplied version matches. Version increments on every save.','put',ref('Draft'),object({version,document:ref('Diagram')}),[write],{'404':error,'409':error}),delete:{...operation('deleteProject','Deletes the owned draft and revokes its published links.','delete',null,null,[write],{'404':error,'409':error}),parameters:[{name:'version',in:'query',required:true,schema:version}]}},
 '/projects/{id}/publications':{parameters:[idParameter],get:operation('listPublications','Lists the latest 50 publications for an owned project.','get',{type:'array',items:ref('PublicationSummary')},null,[auth],{'404':error}),post:operation('publishProject','Atomically copies the matching draft version into a new immutable publication. Review flags are excluded.','post',ref('PublicationSummary'),object({version}),[write],{'404':error,'409':error})},
 '/projects/{id}/revisions':{parameters:[idParameter],get:operation('listRevisions','Lists the owner’s latest 100 saved revisions in descending order.','get',{type:'array',items:ref('RevisionSummary')},null,[auth],{'404':error})},
 '/projects/{id}/revisions/{version}':{parameters:[idParameter,{name:'version',in:'path',required:true,schema:version}],get:operation('getRevision','Loads an owned immutable revision. Other owners and missing versions return 404.','get',ref('Revision'),null,[auth],{'404':error})},
 '/projects/{id}/restore':{parameters:[idParameter],post:operation('restoreRevision','Restores revisionVersion as a new draft version if the current version still matches. Earlier revisions and publications stay unchanged.','post',ref('Draft'),object({version,revisionVersion:version}),[write],{'404':error,'409':error,'200':{description:'Restored draft',...json(ref('Draft'))}})},
 '/publications/{id}':{parameters:[idParameter],get:operation('getPublication','Public playback document. Does not expose the owner or current draft.','get',ref('Publication'),null,[],{'404':error})},
 '/publications/{id}/remix':{parameters:[idParameter],post:operation('remixPublication','Creates an independent private project owned by the signed-in reader.','post',ref('Draft'),null,[write],{'404':error})},
};
for(const item of Object.values(paths)) for(const [method,operation] of Object.entries(item)) {
 if(!['get','post','put','delete','patch'].includes(method))continue;
 for(const response of Object.values(operation.responses))response.headers={...(response.headers||{}),'X-Request-ID':{description:'Server-issued request correlation identifier',schema:{type:'string',format:'uuid'}}};
 if(operation.requestBody)operation.responses['413']=error;
 if(['register','login'].includes(operation.operationId))operation.responses['429']={...error,headers:{'Retry-After':{description:'Seconds before retrying',schema:{type:'integer',minimum:1}}}};
}
fs.writeFileSync('api/openapi.json',JSON.stringify({openapi:'3.1.0',info:{title:'Diagram Studio API',version:'1.0.0',description:'Private versioned drafts and immutable public snapshots. JSON request bodies are limited to 1 MB. See contract.md for cookie, CSRF, and document constraints.'},servers:[{url:'http://localhost:8090/api'}],paths,components:{securitySchemes:{cookieAuth:{type:'apiKey',in:'cookie',name:'DIAGRAM_SESSION',description:'HttpOnly SameSite=Lax session cookie. Anonymous sessions also receive a cookie for CSRF.'},csrfToken:{type:'apiKey',in:'header',name:'X-CSRF-TOKEN',description:'Fetch /auth/me and send csrfToken on writes.'}},schemas}},null,2)+'\n');
console.log('Wrote OpenAPI 3.1 contract.');
