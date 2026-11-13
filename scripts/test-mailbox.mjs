// Development/test SMTP sink. Never deploy this process or expose its ports publicly.
// It stores mail in memory, accepts only loopback connections and never forwards mail.
import net from 'node:net';
import http from 'node:http';
const messages=[];
const smtp=net.createServer(socket=>{
  socket.setEncoding('utf8');socket.setTimeout(15000,()=>socket.destroy());
  socket.write('220 localhost test mailbox\r\n');
  let buffer='',data=false,lines=[],recipient='';
  socket.on('data',chunk=>{
    buffer+=chunk;
    if(buffer.length>100000){socket.destroy();return;}
    let end;
    while((end=buffer.indexOf('\r\n'))>=0){
      const line=buffer.slice(0,end);buffer=buffer.slice(end+2);
      if(data){
        if(line==='.'){
          const body=lines.join('\n');messages.push({to:recipient,body,code:body.match(/code is: (\d{6})/)?.[1]});
          if(messages.length>1000)messages.shift();
          data=false;lines=[];socket.write('250 Stored locally\r\n');
        }else lines.push(line.replace(/^\.\./,'.'));
      }else if(/^(EHLO|HELO)/i.test(line))socket.write('250 localhost\r\n');
      else if(/^MAIL FROM:/i.test(line)){recipient='';socket.write('250 OK\r\n');}
      else if(/^RCPT TO:/i.test(line)){recipient=line.match(/<([^>]+)>/)?.[1]||'';socket.write('250 OK\r\n');}
      else if(/^DATA$/i.test(line)){data=true;socket.write('354 End with dot\r\n');}
      else if(/^QUIT$/i.test(line)){socket.end('221 Goodbye\r\n');}
      else if(/^(RSET|NOOP)/i.test(line))socket.write('250 OK\r\n');
      else socket.write('502 Unsupported\r\n');
    }
  });socket.on('error',()=>{});
});
const web=http.createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&url.pathname==='/messages'){
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify(messages.filter(m=>m.to===url.searchParams.get('to'))));
  }else if(req.method==='GET'&&url.pathname==='/'){
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.end('<!doctype html><title>Local Test Mailbox</title><h1>Local Test Mailbox</h1><p>Development only. Enter the recipient email to inspect captured mail.</p><form action="/messages"><input name="to" type="email" required><button>Open Mail</button></form>');
  }else {res.statusCode=404;res.end();}
});
smtp.listen(1025,'127.0.0.1');web.listen(8025,'127.0.0.1',()=>console.log('Local test mailbox: http://127.0.0.1:8025 (SMTP 1025). No messages leave this computer.'));
for(const server of [smtp,web])server.on('error',error=>{console.error(error.code);process.exit(1);});
