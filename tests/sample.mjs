import fs from 'node:fs';
// The bundled example paper is not part of the public repository; checks that
// need a real PDF read it from here when present and otherwise report a skip.
export const SAMPLE='public/examples/manuscript.pdf';
export function requireSample(name){
 if(fs.existsSync(SAMPLE))return true;
 console.log(`SKIP: ${name} needs ${SAMPLE} (place any two-column paper there to run it).`);return false;
}
