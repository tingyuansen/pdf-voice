import type {Passage,Script} from './passages';
// What a listener should hear for a passage, the same text for every speech
// engine. The page text keeps the PDF's glyphs (˚A, χ2, M⊙, km s−1, ≃) which
// engines read inconsistently or skip, so they are rewritten as a reader of the
// paper would say them. The inline scripts found by the reflow decide whether a
// raised 2 is "squared", a footnote or affiliation marker (dropped) or an isotope.

const GREEK:Record<string,string>={α:'alpha',β:'beta',γ:'gamma',δ:'delta',ε:'epsilon',ϵ:'epsilon',ζ:'zeta',η:'eta',θ:'theta',ϑ:'theta',ι:'iota',κ:'kappa',λ:'lambda',μ:'mu',µ:'mu',ν:'nu',ξ:'xi',π:'pi',ρ:'rho',σ:'sigma',ς:'sigma',τ:'tau',υ:'upsilon',φ:'phi',ϕ:'phi',χ:'chi',ψ:'psi',ω:'omega',Γ:'Gamma',Δ:'Delta','∆':'Delta',Θ:'Theta',Λ:'Lambda',Ξ:'Xi',Π:'Pi',Σ:'Sigma',Φ:'Phi',Ψ:'Psi',Ω:'Omega'};
// TeX output often sets an accent as its own spacing glyph before the letter: f¨ur, Fran¸cois, 8000 ˚A.
const ACCENT:Record<string,string>={'¨':'̈','´':'́','ˆ':'̂','˜':'̃','¸':'̧','˚':'̊','ˇ':'̌','˘':'̆','¯':'̄','˙':'̇'};
const UNITS='s|yr|Myr|Gyr|cm|m|km|pc|kpc|Mpc|K|Hz|g|erg|sr|arcsec|deg';
const ELEMENT=/^[A-Z][a-z]?(?![a-z])/;
const power=(n:string)=>n==='2'?' squared':n==='3'?' cubed':` to the ${n.replace(/^[−-]/,'minus ')}`;

// Rewrite each sub- or superscript in context; touching scripts of one kind
// (the "−" and "1" of s−1 arrive as separate items) are read as one.
function readScripts(text:string,scripts:readonly Script[]=[]):string{
 const runs:Script[]=[];
 for(const s of [...scripts].sort((a,b)=>a.start-b.start)){const last=runs.at(-1);if(last&&last.kind===s.kind&&s.start<=last.end)last.end=Math.max(last.end,s.end);else runs.push({...s});}
 let out='',at=0;
 for(const s of runs){
  out+=text.slice(at,s.start);at=s.end;
  const value=text.slice(s.start,s.end).trim(),after=text.slice(s.end);if(!value)continue;
  const glue=/^[A-Za-z0-9(]/.test(after)?' ':'';
  if(s.kind==='sub'){out+=value==='⊙'?value:` ${value}${glue}`;continue;}
  // The LaTeX logo is typeset as L, a raised A, then TEX.
  if(value==='A'&&/L$/.test(out)&&/^\s?TE?X/i.test(after)){out+='A';continue;}
  // Isotopes: a raised mass number before an element symbol (12C, 13C, 14N).
  if(/^\d{1,3}$/.test(value)&&ELEMENT.test(after)){out+=`${out&&!/[\s(/]$/.test(out)?' ':''}${value} `;continue;}
  // Footnote and affiliation markers after a word or punctuation (Doe,1, 2; Gyr.1),
  // or before the affiliation they number (2Center for …), are not read.
  if(/^(?:[\d,\s]+|[*†‡§¶∗]|[a-z])$/.test(value)&&(/(?:[A-Za-z]{2,}|[,.;:)])$/.test(out)||/(?:^|\s)$/.test(out)))continue;
  // A negative power of a unit is "per": km s−1 → km per s.
  const unit=out.match(new RegExp(`(?:^|\\s)(${UNITS})$`));
  if(unit&&/^[−-]\d$/.test(value)){out=out.slice(0,out.length-unit[1].length)+`per ${unit[1]}`+(value.slice(1)==='1'?'':power(value.slice(1)));continue;}
  if(/^[−-]?\d+$/.test(value)&&/\S$/.test(out)){out+=power(value);continue;}
  out+=` ${value}${glue}`;
 }
 return out+text.slice(at);
}

const RULES:[RegExp,string|((...match:string[])=>string)][]=[
 [/([¨´ˆ˜¸˚ˇ˘¯˙])\s?([A-Za-zı])/g,(_,accent,letter)=>((letter==='ı'?'i':letter)+ACCENT[accent]).normalize('NFC')],
 [/[ﬀﬁﬂﬃﬄ]/g,c=>({'ﬀ':'ff','ﬁ':'fi','ﬂ':'fl','ﬃ':'ffi','ﬄ':'ffl'}[c]!)],
 [/(?:\s*[·…]){2,}\s*/g,' '],[/\s[·|]\s/g,' '],[/\|/g,' '],
 [/\bLA\s?TEX\b/g,'LaTeX'],
 // Identifiers in reference lists are not worth hearing.
 [/,?\s*\bdoi:\s?\S+/gi,''],[/\s*\bhttps?:\/\/\S+/g,''],[/\s*\barXiv:\s?\S+/g,''],
 // Abbreviations and cross-references.
 [/\be\.g\.,?/g,'for example,'],[/\bi\.e\.,?/g,'that is,'],[/\bcf\.\s/g,'compare '],[/\bvs\.\s/g,'versus '],
 [/\bFigs?\.\s?(?=\d)/g,'Figure '],[/\bEqs?\.\s?\(?(\d+[a-z]?)\)?/g,'Equation $1'],[/\bSects?\.\s?(?=\d)/g,'Section '],
 // Units.
 [/\[Å\]/g,'in angstroms'],[/Å/g,' angstroms '],
 // Ionisation stages set in small capitals: Ca ii, H i, Fe iii.
 [/\b([A-Z][a-z]?) (i{1,3}|iv|vi{0,3})\b(?![a-z])/g,(_,element,stage)=>`${element} ${['one','two','three','four','five','six','seven','eight'][['i','ii','iii','iv','v','vi','vii','viii'].indexOf(stage)]}`],
 // A thin space groups thousands: 10 000 is ten thousand, not ten and zero.
 [/\b(\d{1,3})[ \u2009\u202F](\d{3})(?![\d.,])/g,'$1$2'],
 [/\bkm per s\b/g,'kilometers per second'],[/\bper s\b/g,'per second'],[/\bper yr\b/g,'per year'],[/\bper cm\b/g,'per centimeter'],
 [/(\d)\s?Myr\b/g,'$1 million years'],[/(\d)\s?Gyr\b/g,'$1 billion years'],[/(\d)\s?kyr\b/g,'$1 thousand years'],
 [/(\d)\s?kpc\b/g,'$1 kiloparsecs'],[/(\d)\s?Mpc\b/g,'$1 megaparsecs'],[/(\d)\s?pc\b/g,'$1 parsecs'],
 [/(\d)\s?K\b(?!-)/g,'$1 kelvin'],[/(\d)\s?[μµ]m\b/g,'$1 microns'],[/\b[μµ]m\b/g,'microns'],[/(\d)\s?nm\b/g,'$1 nanometers'],[/(\d)\s?°/g,'$1 degrees'],
 [/M⊙/g,'solar masses'],[/L⊙/g,'solar luminosities'],[/R⊙/g,'solar radii'],[/Z⊙/g,'solar metallicity'],[/⊙/g,'solar'],
 // Abundance ratios and element ratios: [Fe/H], [α/Fe], C/O, 12C/13C.
 [/\[([A-Z][a-z]?|[α-ω]|M|X)\/([A-Z][a-z]?)\]/g,'$1 over $2'],
 [/\bS\/N\b/g,'signal-to-noise'],[/\b([A-Z])\/([A-Z])\b/g,'$1 over $2'],[/(\d+ [A-Z][a-z]?)\/(\d+ [A-Z])/g,'$1 to $2'],
 // Ranges, signs and dashes.
 [/(\d)\s?–\s?(?=[−+-]?\d)/g,'$1 to '],[/\s*—\s*/g,', '],[/–/g,'-'],
 [/(^|[\s(,[])\+(?=\d)/g,'$1plus '],[/\s\+\s/g,' plus '],[/(?<=[A-Za-z0-9])\+(?=[A-Za-z])/g,' plus '],[/−\s?/g,' minus '],[/±\s?/g,' plus or minus '],
 [/\b(\d{1,2})\s?×\s?(\d{1,2})\b(?!\s?(?:to the|\d))/g,'$1 by $2'],[/\s?×\s?/g,' times '],
 // Relations. After a word "ages of ≃ 40" is "approximately 40"; after a variable "log g ≃ 0" is "approximately equal to 0".
 [/\b(?!eff\b)([a-z]{3,}|of|at|to|by|is|be|or|as|in|on)\s+[≃≈]\s?/g,'$1 approximately '],[/\s?[≃≈]\s?/g,' approximately equal to '],
 [/\b(near|about|around|approximately)\s+[∼~]\s?/gi,'$1 '],[/[∼~]\s?/g,'about '],
 [/\s?≳\s?/g,' more than about '],[/\s?≲\s?/g,' less than about '],[/\s?≤\s?/g,' less than or equal to '],[/\s?≥\s?/g,' greater than or equal to '],
 [/\s?≡\s?/g,' defined as '],[/\s?∝\s?/g,' proportional to '],[/\s?≠\s?/g,' not equal to '],[/\s?→\s?/g,' to '],
 [/\s<\s?|(?<=\w)<(?=\s?[\d−+])/g,' less than '],[/\s>\s?|(?<=\w)>(?=\s?[\d−+])/g,' greater than '],[/\s?=\s?/g,' equals '],
 [/⟨\s?/g,'mean '],[/\s?⟩/g,''],[/√\s?/g,'square root of '],[/∞/g,'infinity'],
 [/[α-ωΓΔΘΛΞΠΣΦΨΩ∆ϵϑϕµς]/g,c=>` ${GREEK[c]||c} `],
 // Text read without its scripts (a dragged phrase) still gets the common forms.
 [/\bTeff\b/g,'T eff'],[/\bchi\s?2\b/g,'chi squared'],
 [/\s+([,.;:!?)\]])/g,'$1'],[/\s+-(?=[a-z])/g,'-'],[/([([])\s+/g,'$1'],[/\s{2,}/g,' '],
];

// Axis ticks, table rows and axis labels that the layout analysis left as text
// have nothing to say; playback skips them.
export function isFigureResidue(text:string):boolean{
 const tokens=text.trim().split(/\s+/).filter(Boolean);if(!tokens.length)return true;
 // Bare values only: "2021," and "253," in a reference are prose, tick values and cells are not.
 const numeric=tokens.filter(t=>/^[−+-]?\d[\d.]*%?$|^[·…]+$/.test(t)).length,words=(text.match(/[A-Za-z]{3,}/g)||[]).length;
 return numeric>=3&&numeric/tokens.length>=.5&&(words<=3||words/tokens.length<.2)||/^[A-Z][a-z]+(?: [a-z]+){0,2} \[[^\]]{1,12}\]$/.test(text.trim());
}

const memo=new WeakMap<object,string>();
export function spokenText(passage:Pick<Passage,'text'|'scripts'>):string{
 const known=memo.get(passage);if(known!==undefined)return known;
 let text='';
 if(!isFigureResidue(passage.text)){text=readScripts(passage.text,passage.scripts);for(const [pattern,replacement] of RULES)text=text.replace(pattern,replacement as string);text=text.trim();}
 memo.set(passage,text);return text;
}
