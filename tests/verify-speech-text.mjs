import assert from 'node:assert/strict';
import {spokenText,isFigureResidue} from '../lib/speech-text.ts';
import {detectFurniture} from '../lib/furniture.ts';
// The cases mirror what the text layer of a two-column AASTeX paper carries:
// TeX glyphs (˚A, M⊙, ≃), split accents, and inline scripts marked by the reflow.
const say=(text,scripts)=>spokenText({text,scripts});
const script=(text,piece,kind,from=0)=>{const start=text.indexOf(piece,from);return {start,end:start+piece.length,kind};};

// Units, symbols and ranges.
assert.equal(say('A weak band near ∼ 8000 ˚A is common in cool stars.'),'A weak band near 8000 angstroms is common in cool stars.');
assert.equal(say('Such stars have masses of 8–20 M⊙ and ages of ≃ 15 Myr.'),'Such stars have masses of 8 to 20 solar masses and ages of approximately 15 million years.');
assert.equal(say('a cool star with Teff ≃ 3500–3900 K.'),'a cool star with T eff approximately equal to 3500 to 3900 kelvin.');
assert.equal(say('at log g ≃ 1.5 (Section 2)'),'at log g approximately equal to 1.5 (Section 2)');
assert.equal(say('The clusters have [Fe/H] = −1.2, −0.7, and 0.'),'The clusters have Fe over H equals minus 1.2, minus 0.7, and 0.');
assert.equal(say('an atmosphere with C/O< 1'),'an atmosphere with C over O less than 1');
assert.equal(say('the sum ∆[Mg/H] + ∆[Si/H] changes by 0.1 dex'),'the sum Delta Mg over H plus Delta Si over H changes by 0.1 dex');
assert.equal(say('A shift of ±0.5 ˚A in the line centre.'),'A shift of plus or minus 0.5 angstroms in the line centre.');
assert.equal(say('The 2 × 4 panels show each field.'),'The 2 by 4 panels show each field.');
assert.equal(say('the Ca ii 8662 ˚A line is weak'),'the Ca two 8662 angstroms line is weak');
assert.equal(say('The spectra cover 3600–10 000 ˚A.'),'The spectra cover 3600 to 10000 angstroms.');
assert.equal(say('Institut f¨ur Astrophysik, G¨ottingen (Mu˜noz et al. 2021; Fran¸cois 2007)'),'Institut für Astrophysik, Göttingen (Muñoz et al. 2021; François 2007)');
assert.equal(say('(e.g., Smith et al. 2019) and Fig. 2'),'(for example, Smith et al. 2019) and Figure 2');
assert.equal(say('stars of ≳ 25 M⊙ lose mass; deviations of ≲ 3%.'),'stars of more than about 25 solar masses lose mass; deviations of less than about 3%.');
assert.equal(say('stars: abundances — stars: atmospheres'),'stars: abundances, stars: atmospheres');

// Scripts: squared, per-units, isotopes, subscripts, markers and the LaTeX logo.
let t='A joint χ2 over all lines';assert.equal(say(t,[script(t,'2','sup')]),'A joint chi squared over all lines');
t='within ∆χ2 ≤ 2.3, and';assert.equal(say(t,[script(t,'2','sup')]),'within Delta chi squared less than or equal to 2.3, and');
t='a microturbulence of ξ = 1.5 km s−1. It spans';assert.equal(say(t,[script(t,'−','sup'),script(t,'1','sup',t.indexOf('−'))]),'a microturbulence of xi equals 1.5 kilometers per second. It spans');
t='molecules such as 12C14N and 13C16O';
assert.equal(say(t,[script(t,'12','sup'),script(t,'14','sup'),script(t,'13','sup'),script(t,'16','sup')]),'molecules such as 12 C 14 N and 13 C 16 O');
t='within 0.5 σEW, where σEW is the floor';assert.equal(say(t,[script(t,'EW','sub'),script(t,'EW','sub',t.indexOf('where'))]),'within 0.5 sigma EW, where sigma EW is the floor');
t='stars brighter than MV ≈ −5.0 dominate';assert.equal(say(t,[script(t,'V','sub')]),'stars brighter than M V approximately equal to minus 5.0 dominate');
t='strong C2 Swan bands';assert.equal(say(t,[script(t,'2','sub')]),'strong C 2 Swan bands');
t='Jane Doe,1, 2, 3 John Roe,4 and Alex Poe5 1Department of Physics';
assert.equal(say(t,[script(t,'1, 2, 3','sup'),script(t,'4','sup'),script(t,'5','sup'),script(t,'1','sup',t.indexOf('Poe'))]),'Jane Doe, John Roe, and Alex Poe Department of Physics');
t='an age of ≃ 12 Gyr.1 Later work';assert.equal(say(t,[script(t,'1','sup',t.indexOf('Gyr'))]),'an age of approximately 12 billion years. Later work');
t='3 With σsys at 5–10%, or split';assert.equal(say(t,[script(t,'3','sup'),script(t,'sys','sub')]),'With sigma sys at 5 to 10%, or split');
t='Typeset using LATEX twocolumn style';assert.equal(say(t,[script(t,'A','sup')]),'Typeset using LaTeX twocolumn style');
t='a gradient of 10−3 per pixel';assert.equal(say(t,[script(t,'−3','sup')]),'a gradient of 10 to the minus 3 per pixel');
t='a mass-loss rate of 10−6 M⊙ yr−1 here';assert.equal(say(t,[script(t,'−6','sup'),script(t,'−1','sup',t.indexOf('yr'))]),'a mass-loss rate of 10 to the minus 6 solar masses per year here');

// Figure residue is skipped; references and equation cues are not.
for(const residue of ['4000 5000 6000 7000 8000 9000 10000','Wavelength [Å]','Field A · · · · · · 8.8 3.4 28.7 7.8 Field B · · · 38.8 16.4 102.2 14.6 Field C 15.4 9.9 5.5 14.7 5.0 22.6 8.1'])assert.equal(spokenText({text:residue}),'',residue);
for(const prose of ['Equation 4.','Equations 2 and 3.','2020, ApJ, 900, 12, doi: 10.0000/example','The values were 12, 15 and 18.'])assert(!isFigureResidue(prose),prose);
assert.equal(say('2020, ApJ, 900, 12, doi: 10.0000/example'),'2020, ApJ, 900, 12');

// Running heads repeat as words; a decimal point on many pages' last line is not a running head.
const item=(str,y)=>({str,transform:[10,0,0,10,50,y],width:10,height:10});
const pages=new Map([1,2,3,4].map(n=>[n,{items:[item('Doe et al.',760),item('Body text that fills the page',400),item('0',80),item('.',80),item('16 more',80),item(String(n),40)]}]));
const furniture=detectFurniture(pages);
for(const [n,{items}] of pages){const silenced=[...(furniture.get(n)||[])].map(i=>items[i].str);assert.deepEqual(silenced.sort(),['Doe et al.',String(n)].sort(),`page ${n}: ${silenced}`);}
console.log('PASS: units, symbols, ranges and accents spoken; scripts read as squared, per-unit, isotope or subscript; footnote and affiliation markers dropped; figure residue skipped; running heads but not decimal points silenced.');
