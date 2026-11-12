"""Reproducible 15-page implementation guide. Run with the bundled Python runtime."""
from pathlib import Path
from xml.sax.saxutils import escape
import json
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/pdf/Diagram-Studio-Technical-Guide.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
FONTS = Path('C:/Windows/Fonts')
for name, filename in [('Body','segoeui.ttf'),('BodyBold','segoeuib.ttf'),('Mono','consola.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(FONTS / filename)))
pdfmetrics.registerFontFamily('Body',normal='Body',bold='BodyBold',italic='Body',boldItalic='BodyBold')
W,H=A4
M=52
CW=W-2*M
INK=colors.HexColor('#25372f')
MUTED=colors.HexColor('#697a70')
GREEN=colors.HexColor('#31654c')
LINE=colors.HexColor('#dbe4dd')
PALE=colors.HexColor('#f1f5f1')
styles={
 'body':ParagraphStyle('body',fontName='Body',fontSize=9.6,leading=14.5,textColor=INK,spaceAfter=0),
 'small':ParagraphStyle('small',fontName='Body',fontSize=8.2,leading=11.7,textColor=MUTED),
 'heading':ParagraphStyle('heading',fontName='BodyBold',fontSize=11.1,leading=15.5,textColor=GREEN),
 'cell':ParagraphStyle('cell',fontName='Body',fontSize=8.4,leading=12,textColor=INK),
}
c=canvas.Canvas(str(OUT),pagesize=A4,pageCompression=1)
c.setTitle('Diagram Studio | Java-Centered Full-Stack Technical Guide')
c.setAuthor('Diagram Studio Project Documentation')
c.setSubject('Architecture, technologies, implementation, verification, and resume discussion')
page_number=0
y=0

def footer():
    c.setStrokeColor(LINE);c.line(M,45,W-M,45)
    c.setFillColor(MUTED);c.setFont('Body',7.5)
    c.drawString(M,30,'DIAGRAM STUDIO  /  TECHNICAL GUIDE')
    c.drawRightString(W-M,30,f'{page_number:02d} / 15')

def page(title,kicker,subtitle=''):
    global page_number,y
    if page_number: footer();c.showPage()
    page_number+=1
    c.bookmarkPage(f'page-{page_number}')
    c.addOutlineEntry(title,f'page-{page_number}',0,False)
    c.setFillColor(GREEN);c.setFont('BodyBold',8)
    c.drawString(M,H-49,kicker.upper())
    c.setFillColor(INK);c.setFont('BodyBold',23)
    c.drawString(M,H-84,title)
    y=H-108
    if subtitle: p(subtitle,'small',after=15)
    c.setStrokeColor(LINE);c.line(M,y+1,W-M,y+1);y-=18

def p(text,style='body',after=9):
    global y
    paragraph=Paragraph(text,styles[style])
    _,height=paragraph.wrap(CW,1000)
    if y-height<61: raise RuntimeError(f'Page {page_number} overflow at {text[:65]!r}; y={y}, h={height}')
    paragraph.drawOn(c,M,y-height);y-=height+after

def h(text):
    global y
    y-=4;p(text,'heading',after=7)

def note(text):
    p('<b>Implementation note.</b> '+text,'small',after=12)

def source(text):
    p('CODE: '+escape(text),'small',after=8)

def code(text):
    global y
    lines=text.strip('\n').splitlines()
    height=18+len(lines)*11.4
    if y-height<61:raise RuntimeError(f'Page {page_number} code overflow')
    c.setFillColor(PALE);c.roundRect(M,y-height,CW,height,5,fill=1,stroke=0)
    c.setFillColor(INK);c.setFont('Mono',8)
    for i,line in enumerate(lines):
        if pdfmetrics.stringWidth(line,'Mono',8)>CW-24:raise RuntimeError('Code line too wide: '+line)
        c.drawString(M+12,y-16-i*11.4,line)
    y-=height+12

def table(rows,widths=None):
    global y
    cells=[[Paragraph(escape(str(value)),styles['cell']) for value in row] for row in rows]
    t=Table(cells,colWidths=widths or [CW/len(rows[0])]*len(rows[0]),hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),PALE),('LINEBELOW',(0,0),(-1,0),.6,LINE),('LINEBELOW',(0,1),(-1,-1),.4,LINE),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]))
    _,height=t.wrap(CW,1000)
    if y-height<61:raise RuntimeError(f'Page {page_number} table overflow')
    t.drawOn(c,M,y-height);y-=height+13

def flow(labels):
    global y
    height=73; gap=12; boxw=(CW-gap*(len(labels)-1))/len(labels)
    if y-height<61:raise RuntimeError('Diagram overflow')
    for i,(title,detail) in enumerate(labels):
        x=M+i*(boxw+gap)
        c.setFillColor(PALE);c.setStrokeColor(LINE);c.roundRect(x,y-height,boxw,height,5,fill=1,stroke=1)
        q=Paragraph('<b>'+title+'</b><br/><font color="#697a70">'+detail+'</font>',styles['cell']);_,qh=q.wrap(boxw-16,height-14);q.drawOn(c,x+8,y-12-qh)
        if i<len(labels)-1:
            c.setStrokeColor(GREEN);c.line(x+boxw+2,y-height/2,x+boxw+gap-2,y-height/2)
    y-=height+17

lock=json.loads((ROOT/'package-lock.json').read_text(encoding='utf-8-sig'))
def version(name):return lock['packages']['node_modules/'+name]['version']

# 01: A cover with substance, not a blank title page.
page('Diagram Studio','Java-centered full-stack project','Implementation guide and engineering handover | 12 November 2026')
p('A browser-based studio for building interactive technical diagrams, explaining multiple system scenarios, and publishing stable playback links. This guide describes the application that exists in this folder, rather than an imagined production platform. It explains how Java, the browser, and PostgreSQL cooperate and identifies the boundaries of the current implementation.')
h('What the application does')
p('An author builds one reusable graph and defines ordered scenarios over its nodes. Readers can step through a refund, payment failure, retry, or duplicate-request explanation without creating an account. Authors can save private drafts, publish immutable snapshots, remix a published explanation, and recover earlier online versions.')
table([['Backend','Frontend','Storage'],['Java 21\nSpring Boot 4.1.2',f'React {version("react")}\nTypeScript {version("typescript")}', 'PostgreSQL 18\nJSONB + relational ownership']], [CW/3]*3)
h('Why this is a Java-centered project')
p('Java owns the trusted behavior: credentials, session identity, ownership checks, validation, transactional writes, conflict detection, publication creation, and revision restoration. React provides the interactive client. HTML remains the browser entry document; it does not replace or weaken the Java backend.')
h('Reading map')
table([['Pages','Subject'],['02-04','Architecture, Java/Spring Boot, REST contracts and validation'],['05-07','Security, database design, transactions and persistent revisions'],['08-11','React, custom graph canvas, browser persistence, publish/remix'],['12-15','Design, build tools, tests, operations and resume positioning']], [65,CW-65])
note('The guide is based on the source, dependency lockfile, SQL migrations and verification performed during this update. Container execution, Internet deployment, production load and email-based account recovery are not claimed.')

# 02
page('How the system fits together','02 / Architecture','A modular monolith with one deployable Java application and a separate database.')
flow([('Browser','React editor<br/>SVG canvas<br/>Local recovery copy'),('Java application','Spring MVC API<br/>Spring Security<br/>Transactional services'),('PostgreSQL','Accounts and sessions<br/>Drafts and revisions<br/>Public snapshots')])
h('Development and packaged operation')
p('During development, Vite serves the React application on port 5173 and proxies /api requests to Spring Boot on port 8090. The browser sees one origin, which avoids introducing an unnecessary cross-origin authentication arrangement. PostgreSQL uses the isolated local port 55432. The database belongs to Diagram Studio and is separate from the earlier CRUD application.')
p('For packaged operation, Vite produces static HTML, CSS and JavaScript in dist/. Maven copies those files into the Spring Boot JAR. Embedded Tomcat serves both the user interface and the REST API on port 8090. A production host therefore needs the Java application and a PostgreSQL database, rather than a Node server for the frontend.')
h('A useful request trace')
p('When the author selects Save Online, the browser serializes the current document and sends a CSRF-protected POST or PUT. Spring Security establishes the caller. Spring MVC binds JSON to a Java record. ProjectService checks the document, writes the owned draft, appends a revision, and commits the transaction. The response returns the new version number. React records that exact saved document so the save indicator can distinguish local changes from the online version.')
h('Separation of responsibilities')
p('The frontend can decide which controls to show, but visibility is not authorization. Java repeats all ownership and input checks. PostgreSQL provides durability, transactions, foreign keys and uniqueness constraints. The browser copy is a recovery convenience; it is neither an authentication credential nor a substitute for an online save.')
source('src/lib/api.ts; ProjectController.java; ProjectService.java; vite.config.ts; backend/pom.xml')

# 03
page('The Java application','03 / Java 21 and Spring Boot','Records, dependency injection, explicit SQL, and a deliberately small service layer.')
h('Java, the JDK, and the JVM')
p('Java 21 is the language and build target. The JDK supplies javac and development tools; the JVM executes the compiled application. Maven compiles source into class files, and Spring Boot packages the application and dependencies as an executable JAR. The final container uses a Java runtime image because compilation already happened in the build stage. Java is distinct from the JavaScript that executes in the browser.')
h('Spring Boot and the application context')
p('DiagramStudioApplication starts SpringApplication. Component scanning discovers controllers, services and configuration within com.diagramstudio. Spring constructs these objects and injects dependencies through constructors. ProjectService receives JdbcTemplate and JsonMapper; AuthController receives JdbcTemplate, PasswordEncoder and the security-context repository. This centralizes infrastructure and avoids constructing separate database connections or security components inside every request.')
h('The main classes')
table([['Class','Responsibility'],['DiagramStudioApplication','Starts the application and its embedded web server.'],['AuthController','Registers users, validates credentials, and establishes or ends sessions.'],['ProjectController','Maps HTTP requests to owned project and publication operations.'],['ProjectService','Coordinates persistence, revisions, optimistic saves, publish and restore.'],['DiagramDocument','Represents and validates nodes, scenarios and document limits.'],['SecurityConfiguration / ApiErrors','Configures access rules, CSRF, headers, and consistent API errors.']], [180,CW-180])
h('Records and data boundaries')
p('Java records describe requests and responses, including Account, Draft, Publication and Revision. Their named components give the API explicit shapes. They are not JPA entities: this application uses Spring JDBC and hand-written parameterized SQL. Collections inside a record are not automatically deeply immutable, so the code treats documents as values and creates separate publication and revision records instead of exposing mutable drafts as shared links.')
note('This is a modular monolith, not a microservices system. That choice keeps transactions and deployment understandable for one developer. Splitting services would add network and operational concerns without solving a demonstrated requirement.')

# 04
page('HTTP, JSON, and validation','04 / REST API and contracts','The browser and Java agree on data shapes, ownership, versions and failure responses.')
h('Spring MVC and Jackson')
p('Spring MVC maps route annotations such as @GetMapping and @PutMapping to controller methods. Jackson 3, exposed through JsonMapper in Spring Boot 4, converts JSON to Java records and back. JSON is also the file-transfer format and the representation written into PostgreSQL JSONB. TypeScript interfaces improve client-side development, while Java validation remains authoritative for untrusted requests.')
table([['API area','Operations and behavior'],['/api/auth','Read session/CSRF token; register, sign in and sign out.'],['/api/projects','List and create private drafts; load, update or delete an owned draft.'],['/projects/{id}/revisions','List saved versions and inspect an individual historical document.'],['/projects/{id}/restore','Restore historical content as a new version using an expected current version.'],['/projects/{id}/publications','Create immutable public snapshots and list a project\'s publications.'],['/api/publications/{id}','Read public playback; signed-in readers can create an owned remix.']], [180,CW-180])
h('Validation has several layers')
p('Jakarta Bean Validation checks request fields with @Valid, @NotBlank, @Email, @Size, @Min and @NotNull. DiagramDocument then checks graph-specific invariants: unique nonempty IDs, existing step references, finite coordinates between 0 and 100, and bounded text and array lengths. The client parser repeats compatible checks for imported files and local data, but cannot grant permission or bypass the server.')
p('Documents allow at most 250 nodes, 100 scenarios and 500 steps per scenario, subject to the total 1 MB request limit. At least one scenario must exist, but an empty graph or route is valid. A request filter limits both declared-length and streamed JSON bodies before deserialization. This is separate from multipart file configuration.')
h('Errors are part of the interface')
p('400 identifies invalid input; 401 requires sign-in; 403 covers invalid CSRF/access; 404 conceals nonexistent and non-owned projects alike; 409 identifies a stale version or duplicate email; 413 rejects oversized input; and 503 reports unavailable storage. ApiErrors returns readable JSON messages without database internals or stack traces. OpenAPI 3.1 documents the contract in api/openapi.json, generated from scripts/generate-openapi.mjs.')

# 05
page('Authentication and security','05 / Spring Security, bcrypt and server-side sessions','A session-based browser application; no JWT or password is stored in localStorage.')
h('Registration and credential verification')
p('AuthController trims and lowercases email addresses and relies on a unique database constraint to prevent duplicate accounts. Passwords are hashed with BCryptPasswordEncoder rather than stored as plaintext. bcrypt is a one-way password-checking function with a salt and work factor; login verifies a candidate against the saved hash. The application enforces a minimum registration length of 10 characters and a maximum of 72 UTF-8 bytes. It also performs a bcrypt comparison for unknown accounts to reduce obvious timing differences.')
h('Session identity and persistence')
p('After successful authentication, Java creates an authenticated security context whose principal is the account UUID. The session identifier is rotated, and the context is saved through HttpSessionSecurityContextRepository. Spring Session JDBC stores session metadata and serialized attributes in PostgreSQL, with a configured seven-day session timeout. The browser receives an opaque DIAGRAM_SESSION cookie, not the user\'s password or a bearer token saved by React.')
p('The cookie is HttpOnly, which prevents ordinary browser JavaScript from reading it, and SameSite=Lax, which restricts some cross-site use. COOKIE_SECURE controls whether it is sent only over HTTPS. Local HTTP uses false; an HTTPS deployment must set true. These cookie properties complement authentication; they do not replace server authorization or a secure deployment.')
h('CSRF and authorization')
p('GET /api/auth/me returns the current account, if present, plus a CSRF token associated with the session. The client keeps that token in memory and sends X-CSRF-TOKEN on modifying requests. Login and registration remain CSRF-protected. Logout invalidates the session, after which the client obtains a fresh anonymous token. Ownership checks derive the owner UUID from the authenticated principal, never from a caller-supplied owner field.')
h('Defense and remaining boundaries')
p('Spring Security applies security headers and a content security policy that permits the application\'s assets and the configured font hosts. Private JSON responses are not cacheable. Public publication reads do not return owner metadata or draft review flags. Before an Internet launch, HTTPS, strong database credentials, authentication rate limits and operational backups still need deployment configuration. Email verification, password recovery, role-based administration and an independent penetration test are not implemented or claimed.')
source('AuthController.java; SecurityConfiguration.java; application.properties; V1__initial_schema.sql')

# 06
page('PostgreSQL and the data model','06 / Relational integrity with JSONB documents','Ownership is relational; graph content is stored as a validated document.')
flow([('app_users','UUID account key<br/>Unique email<br/>bcrypt password hash'),('projects','Owner foreign key<br/>JSONB current draft<br/>Monotonic version'),('Related records','project_revisions<br/>publications<br/>Cascade on deletion')])
h('Why JSONB fits this graph')
p('A diagram is naturally a nested document containing nodes, ordered scenario steps, notes and descriptions. PostgreSQL JSONB stores parsed JSON content while ordinary columns keep frequently queried metadata such as owner, title, version and updated time. The application validates graph references in Java. It does not currently create a row per node or use a graph database. No JSONB search index is claimed: the actual queries primarily filter relational IDs and ownership.')
h('Tables and constraints')
table([['Table','What it preserves'],['app_users','Account identity, unique canonical email, password hash and creation time.'],['projects','Owned current document, current version and creation/update timestamps.'],['project_revisions','Full saved document per (project_id, version), title and saved time.'],['publications','Random public UUID, source project, fixed JSONB document and creation time.'],['SPRING_SESSION / attributes','Session IDs, expiry/principal metadata and serialized security/session attributes.']], [175,CW-175])
h('JDBC and database migrations')
p('Spring JDBC\'s JdbcTemplate binds query parameters and maps rows to Java response records. Parameter binding separates values from SQL syntax. HikariCP manages the connection pool, configured with a maximum of 10 connections. Flyway applies ordered migrations: V1 creates the original schema; V2 adds revision history and seeds a baseline from each existing current draft. Previously overwritten versions cannot be reconstructed retroactively.')
p('Foreign keys tie projects to accounts and related records to projects. Deleting a project cascades to its revisions and publications, deliberately revoking its public links. Indexes support owner/update-time and project/publication-time queries. UUIDs avoid sequential public identifiers; their unpredictability is useful for links, but private resource protection still comes from ownership checks.')

# 07
page('Transactions and version history','07 / The advanced Java workflow','Safe restoration is an append, not a destructive rewrite of the past.')
h('Optimistic concurrency control')
p('Each draft has a version. A client saves the version it last loaded alongside the document. Java updates the row only when the project ID, owner and version all match. If another session saved first, the update affects no rows and returns 409. The frontend keeps the local document and offers Save as Separate Copy instead of silently overwriting a newer draft.')
code('''UPDATE projects
SET document=CAST(? AS jsonb), version=version+1,
    title=?, updated_at=now()
WHERE id=? AND owner_id=? AND version=?;
-- Illustrative ordering; parameter values are bound by JDBC.''')
h('Recording revisions atomically')
p('ProjectService.create and update execute inside @Transactional boundaries. A successful draft write is followed by an insert into project_revisions in the same transaction. If the revision insert fails, the draft change rolls back too. The composite primary key prevents two records for the same project version. The service exposes no endpoint for modifying historical revision content; deleting the parent project is the explicit removal path.')
h('Restoring an old version')
p('The restore endpoint accepts the expected current version and the historical revisionVersion. Java first verifies ownership of the project and reads the chosen revision. It then uses the normal optimistic update path to make that document the latest draft. Restoring version 1 while version 3 is current creates version 4 containing the old content. Versions 1, 2 and 3 remain available. A concurrent update still causes 409 rather than erasing someone else\'s edit.')
p('The UI lists the latest 100 saved versions, supports previewing node/scenario counts and scenario names, and requires confirmation before replacing local content. Revision history is durable in PostgreSQL; the browser\'s undo stack is temporary and serves a different purpose. Full snapshots simplify restoration at the cost of growing storage; delta compression and retention policies are future options.')
h('Publication consistency')
p('Publishing locks the owned draft row with SELECT FOR UPDATE, checks the requested version, and copies the document into a new publication inside one transaction. A save cannot interleave between that check and copy. Draft restoration never mutates a publication. Spring\'s transactional proxy surrounds the public service operation; internal helper calls run within that existing transaction.')

# 08
page('React and TypeScript','08 / Frontend architecture','Explicit document state, reusable components, and runtime parsing at data boundaries.')
h('React is the user-interface layer')
p('React renders the visible controls from state. Components receive typed props and report actions through callbacks. App coordinates the document, account, active online project, dialogs, selected scenario and save state. WorkspaceShell handles navigation and the workbench layout. Canvas draws the graph; Playback explains the current route; Editor changes nodes and scenarios; Dialog wraps native modal behavior; Icon supplies a consistent SVG vocabulary.')
h('TypeScript, TSX and the model')
p('TypeScript adds compile-time types for Diagram, DiagramNode, Scenario, Draft and API responses. TSX combines TypeScript with JSX syntax, which describes React elements. Types are erased when code is built, so a TypeScript interface does not validate a network response. parseDiagram therefore inspects unknown values from JSON, localStorage, old links and the server before they enter editor state. It also normalizes nullable backend fields into the client\'s optional values.')
h('State and history')
p('useState holds local view settings such as the inspector panel, selected node, theme and modal state. useReducer manages past, present and future diagram documents. Edits clone a document, apply one change and dispatch it; undo and redo move between snapshots. New edits clear the redo branch, and local history is bounded to roughly 50 document states. Opening a different online project resets local undo; importing a local file or example preserves an undoable replacement.')
p('useEffect handles effects such as reading a session, persisting the local draft, applying the theme and updating the page title. Effects that fetch initial data avoid applying a response after unmount. useRef holds the latest document for async saves, preventing a stale render from defining what Save Online captures. The captured JSON is recorded separately from the current editor document, so editing during a save does not falsely mark newer unsaved work as online.')
h('What is intentionally absent')
p('The application does not depend on Redux, Next.js, a React graph library or a frontend UI framework. React DOM mounts the application into the root element in index.html. Vite transforms modules for the browser. Custom CSS supplies the visual system. This keeps the current dependency surface small, while leaving room to extract more application state or API behavior if the codebase grows.')
source('src/App.tsx; src/components/*; src/lib/model.ts; src/lib/api.ts; src/main.tsx')

# 09
page('The custom diagram canvas','09 / HTML, SVG, geometry and pointer events','One set of nodes; multiple reusable ordered paths through those nodes.')
h('The graph representation')
p('A node contains an ID, label, x/y coordinates and optional explanatory notes. Coordinates are percentages of the board, so the layout remains proportional across sizes. A scenario contains a name and ordered node IDs, with an optional description and review notes. The same node can appear in several scenarios or multiple times in a retry path. A branch copies a chosen route prefix into a new independently editable scenario; it is not a runtime condition evaluator.')
h('SVG edges and HTML nodes')
p('Canvas uses an SVG layer for connector lines and ordinary HTML buttons for nodes. It builds the directed edge set from consecutive steps across every scenario and deduplicates identical pairs. Node coordinates are converted into pixels using the measured board size. The line endpoints are inset from node centers so arrows meet their borders. An SVG marker supplies arrowheads, while the currently traversed edge and node receive active styling.')
code('''pixelX = node.x * boardWidth / 100
pixelY = node.y * boardHeight / 100
edge = [scenario.steps[i - 1], scenario.steps[i]]
activeEdge = edge matches [previousStep, currentStep]''')
h('Dragging without flooding undo history')
p('Pointer events support mouse and touch input. A node captures its pointer so a drag continues beyond its original bounds. A movement threshold distinguishes selection from dragging. Temporary coordinates update the preview while the pointer moves; release commits a single document edit. Percentage bounds keep nodes within the useful area. ResizeObserver measures the board and recalculates edge geometry when its size changes.')
h('Playback and editing behavior')
p('The player selects one scenario and highlights its current node, explanation and progress. Previous, Next, restart and direct step selection navigate the route. Keyboard arrows and Home work outside text fields and dialogs. The editor can append, insert, replace, reorder or remove steps. Deleting a node removes all references and flags affected scenarios. Renaming a node or editing its notes also flags scenarios for author review.')
note('This is an explanatory diagram tool, not a production workflow executor. It does not call payment APIs or run a real refund. Automatic arrangement is a bounded grid, not a graph-layout optimizer. Consecutive repeated nodes remain valid steps, but self-loop connector arrows are not drawn.')

# 10
page('Local recovery and online saves','10 / Browser APIs and persistence boundaries','Fast local editing with explicit server persistence and predictable failure behavior.')
h('Local storage and migration')
p('The browser automatically saves the current local document under diagram-studio-v1, with a separate remix key to protect the original workspace. A theme preference and online-draft metadata use separate keys. Existing prototype documents are parsed on startup, and an incompatible original can be retained under a migration-backup key. Browser storage is tied to an origin: data from file:// or a different localhost port cannot be read automatically by the new application.')
p('localStorage is synchronous browser storage, not a database shared between devices. It can be blocked, cleared or run out of space. The UI reports a local save failure and warns before leaving when it cannot preserve work. For older file-based projects, export JSON from the old browser context and import it into the new React application. No migration reads another browser\'s private storage.')
h('The online save marker')
p('The active online project tracks its server ID, expected version, owning account and exact saved JSON. Saved Locally means the latest editing state is not yet confirmed online. Saved Online means the current document matches the last successful server save. Saves are explicit through Save Online; Publish & Share also saves before publishing. Opening My Projects loads the current owner\'s drafts from PostgreSQL.')
flow([('Local edit','Document changes<br/>Undo snapshot<br/>Browser recovery copy'),('Save Online','JSON + CSRF token<br/>Expected version<br/>Ownership validation'),('Confirmed save','New server version<br/>Durable revision<br/>Updated save marker')])
h('Files, links and network handling')
p('Exports use a versioned JSON envelope and the Blob/object-URL download APIs. Imports use the File API, validate size and structure, and ask before replacement. Clipboard API copying is attempted from a user action; the Share dialog still exposes a selectable link if copying is unavailable. Fetch requests use same-origin credentials and a 15-second timeout. Network or database failure leaves the local editor available, while 409 provides a separate-copy recovery path. These behaviors are recovery aids; they are not a full offline synchronization or merge engine.')

# 11
page('Publishing and independent remixes','11 / Public snapshots and private drafts','Stable explanations are separate records, not live views into an author\'s workspace.')
h('Publishing creates a value')
p('The author signs in, saves the draft and requests a publication of that saved version. Java makes a new random publication UUID and copies the validated document into publications. The copied scenarios exclude review flags, while public node notes and scenario descriptions remain part of the explanation. The resulting /p/{id} link loads the snapshot from a public API endpoint. It does not expose the owner UUID, email or newer private draft changes.')
flow([('Private draft','Owned and editable<br/>Revision checked<br/>Reviews included'),('Published snapshot','Fixed content copy<br/>Public UUID link<br/>Reviews excluded'),('Reader remix','Independent document<br/>Guest local workspace<br/>Or new owned project')])
h('A reader needs no account')
p('The public view removes editing and private project-file controls but keeps scenario selection, step playback, keyboard navigation and sharing. It can be opened in a fresh browser session. Failed or revoked links produce an error state instead of silently showing a different diagram. A published link is only reachable by other computers once the application is hosted at a public address; a localhost URL is a development address.')
h('Remix ownership')
p('A guest can remix the loaded snapshot into a separate browser workspace. That local copy can be edited without an account, then exported or saved after signing in. A signed-in reader can use the Java remix endpoint to create a new owned private draft. The service reads the public snapshot, copies its document and creates a new project identity. Editing that remix cannot mutate the original draft or publication.')
h('Publication lifetime and versioning')
p('Publishing again creates another snapshot with another link. It does not update an earlier link. Saved revision history is private recovery data, while publication history records public explanations. Deleting the source project deliberately cascades to publications and revokes those links; the UI confirms this irreversible project deletion. This policy makes content control explicit, but a future product could separate publication retention from draft deletion if users need archival permanence.')
note('An opaque public UUID is a share link, not an account permission system. Anyone holding that public link can read the published document. Private drafts and private revision endpoints still require the authenticated owner.')

# 12
page('Design as a product system','12 / Typography, interaction and accessibility','A focused workspace instead of a page filled with unrelated controls.')
screenshot=ROOT/'.runtime/desktop-light.png'
if screenshot.exists():
    from PIL import Image
    with Image.open(screenshot) as image:
        # The current workbench is viewport-sized; keep the explanatory screenshot readable.
        ratio=image.height/image.width
        image_height=min(305,CW*ratio)
        image_width=image_height/ratio
        c.drawImage(ImageReader(image),M+(CW-image_width)/2,y-image_height,width=image_width,height=image_height,mask='auto')
        y-=image_height+12
    p('Actual desktop view from the browser verification run.','small',after=10)
h('A deliberate hierarchy')
p('The interface uses a compact application header, a navigation rail, a large diagram workspace and a tabbed inspector. Playback, Editor and Project tools have separate views, so authors can focus on one task. Neutral surfaces, a restrained green accent, consistent spacing and a small radius scale replace decorative gradients and competing badges. Inter is the web font, with Segoe UI and system sans-serif fallbacks.')
h('Native controls and consistent feedback')
p('A shared SVG Icon component keeps line weight and sizing consistent. Form labels remain visible, focus states are explicit, and active steps use text and border treatment in addition to color. Tabs expose tab/tabpanel relationships and arrow-key navigation. Native dialog elements trap modal focus, support Escape and separate destructive confirmations from routine edits. Read-only nodes cannot be dragged.')
p('On smaller screens, the rail disappears, the canvas stacks above the inspector and controls reflow. Dark mode uses the same design tokens and hierarchy. Reduced-motion preferences disable transitions. Browser checks cover desktop behavior, mobile width and theme persistence; they do not constitute a complete accessibility audit or a claim of formal WCAG conformance.')

# 13
page('Build and delivery technologies','13 / Node, npm, Vite, Maven and containers','Each tool has a distinct job; the deployed application remains Java-centered.')
h('Node.js, npm and TypeScript')
p(f'Node.js runs frontend development and build tools, plus the HTTP test script. npm installs dependencies using package.json and the resolved package-lock.json. The lockfile records concrete versions: React {version("react")}, TypeScript {version("typescript")}, Vite {version("vite")}, Vitest {version("vitest")} and Playwright {version("@playwright/test")}. npm ci reproduces the locked dependency set. Node is not the application\'s API server.')
p('The build runs tsc -b to check TypeScript, followed by vite build. Vite supplies development module loading and hot updates, transforms TSX through its React plugin, and writes hashed production assets to dist/. The root index.html remains necessary: it defines the document, metadata, fonts, root mount element and source entry. legacy/index.html is an archived prototype and is not part of the React production entry.')
h('Maven and Spring Boot packaging')
p('pom.xml declares Java dependencies and the Java 21 release target. Maven resolves Spring Boot starters for MVC, security, JDBC, validation, Flyway and JDBC sessions, together with the PostgreSQL driver. The Maven wrapper pins the build distribution to 3.9.16. The Spring Boot plugin creates an executable JAR that includes dependencies. Resource configuration copies dist/ into its static resources. Java unit tests run in the native clean/package workflow.')
h('PowerShell and local PostgreSQL')
p('Windows scripts choose an installed JDK for the current process, locate Maven or its wrapper, initialize the isolated PostgreSQL cluster and start the application. They do not change system Java settings or use the CRUD application\'s database. npm start coordinates installation if needed, frontend build, Java packaging and server execution. Local database files are kept under .runtime/postgres; deleting that folder discards stored accounts and projects.')
h('Docker and Compose')
p('The Dockerfile has a Node frontend-build stage, a Maven/Java build stage and a non-root Java-runtime stage. Compose defines the application, PostgreSQL, a persistent volume and a database-readiness check. Environment variables supply database connectivity and secure-cookie settings. This configuration is prepared but has not been executed here because Docker is unavailable. No CI pipeline, Kubernetes cluster, cloud deployment, telemetry service or automatic scaling is represented as implemented.')

# 14
page('Verification and failure cases','14 / JUnit, Vitest, Playwright and real HTTP checks','Evidence is scoped to the executed checks, not generalized into production guarantees.')
verification_path=ROOT/'tmp/pdfs/verification.json'
verification=json.loads(verification_path.read_text())
table([['Layer','Tool and evidence'],['Java domain validation',f'JUnit: {verification["java"]} tests cover valid/empty/repeated routes, missing references, duplicate IDs, invalid coordinates and publication review stripping.'],['Frontend domain behavior',f'Vitest: {verification["frontend"]} tests cover legacy parsing, JSON round trips, validation, review propagation, arrangement and undo/redo branching.'],['Real API and PostgreSQL',f'Node fetch + assert: {verification["api"]} checks cover accounts, cookies/CSRF, ownership, versions, revisions, restoration, publishing, remix, logout and deletion/revocation.'],['Actual browser behavior',f'Playwright + Chrome: {verification["browser"]} scenarios cover migration/editing, online save/publish/remix and version recovery, mobile/dark layout, keyboard playback and real save conflicts.']], [145,CW-145])
h('What the integration checks establish')
p('The HTTP suite makes requests to a running Spring Boot server and writes to a real isolated PostgreSQL database. A second account attempts to load, update, publish, delete and inspect revisions belonging to the first account; those requests must fail. Stale update and restore requests must return 409. Publishing is checked before and after a draft change, and a restored version must not erase another historical revision.')
p('Browser tests exercise form interaction, fresh-session playback, guest remix, stored account sessions, JSON download/import, undo and mobile overflow. The conflict test changes a server draft through a real API request, then tries to save a stale browser version. The local title must survive and Save as Separate Copy must create a different project ID. Desktop and mobile screenshots are inspected separately from passing assertions.')
h('Reproducing the checks')
code('''npm test
npm run build
powershell -File scripts/backend.ps1 test
npm run test:api
npm run test:e2e''')
p('The backend and database must be running for HTTP and browser checks. The test harness can start Vite if needed. These results do not measure sustained load, production uptime, cross-browser compatibility, comprehensive accessibility or all security attacks. Docker behavior and Internet hosting remain unverified. Test accounts are disposable fixtures, not built-in application accounts.')

# 15
page('Running it and presenting it','15 / Operations, limitations and resume discussion','Explain what you can demonstrate, and distinguish implementation from future work.')
h('Local operation and deployment')
p('From the project folder, run npm install and npm start, then open http://localhost:8090 once Spring Boot is ready. Keep the server terminal running; Ctrl+C stops Java, and npm run db:stop stops the isolated database. For development, run the database, npm run backend and npm run dev in separate terminals. Rebuild the packaged app after source changes; do not delete runtime database data as a way to refresh the interface.')
p('An Internet deployment still needs a Java/container host and persistent PostgreSQL. Provide DB_URL, DB_USER and DB_PASSWORD securely; set COOKIE_SECURE=true behind HTTPS; serve UI and API on one origin. Add backups, authentication request limits, monitoring and recovery procedures. Email verification, forgotten-password recovery, live multi-user editing and administrative tooling remain outside this release.')
h('Resume-ready description')
p('<b>Diagram Studio - Java 21, Spring Boot, PostgreSQL, React and TypeScript.</b> Built an interactive technical-diagram application with authenticated private projects, reusable scenario playback, immutable public snapshots and independent remixes. Implemented transactional revision history, optimistic concurrency checks and safe restoration with PostgreSQL JSONB persistence. Verified domain behavior and owner isolation with automated Java, frontend, real-HTTP and Chrome tests.')
p('Use those statements only after you can demonstrate and explain the code. Do not add traffic, performance, revenue, uptime, independent authorship or production-scale claims without evidence. Good interview topics include why JDBC was chosen, how 409 prevents lost updates, how draft revisions differ from publications, why React still needs index.html, and which limits you would address before a public launch.')
h('Implementation and reference map')
p('Primary implementation sources: backend/src/main/java/com/diagramstudio; backend/src/main/resources/db/migration; src/components; src/lib; api/openapi.json; package-lock.json; Dockerfile; compose.yaml; README.md. Code paths in this guide are relative to diagram-studio.','small')
for title,url in [
 ('Java 21 language and platform','https://docs.oracle.com/en/java/javase/21/'),
 ('Spring Boot reference','https://docs.spring.io/spring-boot/reference/'),
 ('Spring transactions','https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html'),
 ('JDBC-backed sessions','https://docs.spring.io/spring-session/reference/guides/boot-jdbc.html'),
 ('PostgreSQL JSON types','https://www.postgresql.org/docs/18/datatype-json.html'),
 ('React state management','https://react.dev/learn/managing-state'),
 ('Vite guide','https://vite.dev/guide/'),
 ('TypeScript handbook','https://www.typescriptlang.org/docs/handbook/intro.html'),
]:
    p(f'<link href="{url}" color="#31654c">{title}</link>','small',after=4)
note('This PDF was produced with Python, ReportLab, embedded Segoe UI fonts, pypdf validation and PDF rendering tools. Those document-authoring tools are not application runtime dependencies.')

footer();c.save()
reader=PdfReader(str(OUT))
assert len(reader.pages)==15, f'Expected 15 pages, got {len(reader.pages)}'
for index,pdf_page in enumerate(reader.pages,1):
    text=pdf_page.extract_text() or ''
    assert len(text)>750, f'Page {index} has insufficient extractable text'
print(f'Created {len(reader.pages)} pages: {OUT}')
print('Text characters per page:',[len(p.extract_text() or '') for p in reader.pages])
