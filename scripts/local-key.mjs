import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
const source=join(homedir(),'.env');
if(existsSync(source)){
 const vars=parseEnv(readFileSync(source,'utf8'));
 const existing=existsSync('.dev.vars')?parseEnv(readFileSync('.dev.vars','utf8')):{};
 // Drop keys of retired engines (Cartesia, then ElevenLabs) and copy the current ones.
 let changed=false;for(const name of ['SONIC','ELEVENLABS'])if(Object.hasOwn(existing,name)){delete existing[name];changed=true;}
 for(const name of ['SPEECHIFY','GOOGLE_API_KEY','OPENAI'])if(vars[name]){existing[name]=vars[name];changed=true;}
 if(changed){writeFileSync('.dev.vars',Object.entries(existing).map(([k,v])=>k+'='+JSON.stringify(v)).join('\n')+'\n',{mode:0o600});chmodSync('.dev.vars',0o600);}
}
