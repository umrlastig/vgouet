// The MIT License (MIT)

// hal.js | Copyright (c) 2019-2020 IGN

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

// documentation on HAL API: https://api.archives-ouvertes.fr/docs/search/?schema=fields#fields

// sample usage :
// fetchHal('mathieu-bredif',{producedDateY_i:"[2015 TO 2019]"},'ACL').then(console.log) // ACL entries between 2015 and 2019
// fetchHal('mathieu-bredif',{producedDateY_i:2019},'ACTI').then(console.log) // ACTI entries of 2019
// fetchHal('mathieu-bredif').then(console.log) // everything

// Papers may be blacklisted (ie: ignored) by adding their hal-id as a string to this array
var halIdBlacklist = halIdBlacklist || [];

const pubKeyQueries = {
  PV:  '&fq=popularLevel_s:1',
  ASCL:'&fq=popularLevel_s:0&fq=docType_s:"ART"&fq=peerReviewing_s:0',
  ACL: '&fq=popularLevel_s:0&fq=docType_s:"ART"&fq=peerReviewing_s:1&fq=audience_s:2',
  ACLN:'&fq=popularLevel_s:0&fq=docType_s:"ART"&fq=peerReviewing_s:1&fq=audience_s:3',
  INV: '&fq=popularLevel_s:0&fq=docType_s:"COMM"&fq=invitedCommunication_s:1',
  COM: '&fq=popularLevel_s:0&fq=docType_s:"COMM"&fq=invitedCommunication_s:0&fq=proceedings_s:0',
  ACTI:'&fq=popularLevel_s:0&fq=docType_s:"COMM"&fq=invitedCommunication_s:0&fq=proceedings_s:1&fq=audience_s:2',
  ACTN:'&fq=popularLevel_s:0&fq=docType_s:"COMM"&fq=invitedCommunication_s:0&fq=proceedings_s:1&fq=audience_s:3',
  OS:  '&fq=popularLevel_s:0&fq=docType_s:"COUV"',
  DO:  '&fq=popularLevel_s:0&fq=docType_s:"DOUV"',
  AFF: '&fq=popularLevel_s:0&fq=docType_s:"POSTER"',
  AP:  '&fq=docType_s:("REPORT" OR "UNDEFINED" OR "OTHER" OR "LECTURE")', // no popularLevel_s for REPORT and UNDEFINED
  TH:  '&fq=docType_s:("THESE" OR "HDR")',        // no popularLevel_s for THESE and HDR
};
const pubKeys = Object.keys(pubKeyQueries);
const noPubKeyInCommentQuery = '&fq=-comment_s:(' + pubKeys.join(' OR ') + ')';

const halFields = 'fileAnnexesFigure_s,invitedCommunication_s,proceedings_s,peerReviewing_s,audience_s,comment_s,popularLevel_s,halId_s,authIdHalFullName_fs,producedDateY_i,docType_s,files_s,fileMain_s,fileMainAnnex_s,linkExtUrl_s,title_s,en_title_s,fr_title_s,label_bibtex,citationRef_s';

// private function
function _fetchHal(authIdHal, pubKey, queries = {}){
  var q = authIdHal ? "authIdHal_s:%22"+authIdHal+"%22" : "*";
  if (pubKey) {
	  if (!(pubKey in pubKeyQueries)) return Promise.reject(Error(pubKey + ' is not valid'));
	  q += pubKeyQueries[pubKey] + noPubKeyInCommentQuery;
  } 
  Object.keys(queries).forEach(key => q += '&fq='+key+':'+queries[key]);
  const url = "https://api.archives-ouvertes.fr/search/?q="+q+"&wt=json&rows=10000&fl="+halFields;
  return fetch(url).then(x=>x.json()).then(x=>x.response.docs.sort((a, b) => b.producedDateY_i - a.producedDateY_i));
}

function fetchHal(authIdHal, pubKey = '*', queries = {}) {
	if (pubKey == '*') pubKey = undefined;
	const q1 = _fetchHal(authIdHal, pubKey, queries);
	if (!pubKey) return q1;
	queries.comment_s = pubKey;
	const q2 = _fetchHal(authIdHal, undefined, queries);
	return Promise.all([q1,q2]).then(x=>x.flat());
}

// based on http://production-scientifique.bnf.fr/Annexe/cadre-de-classement
function getPubKey(doc) 
{
  if (pubKeys.includes(doc.comment_s)) return doc.comment_s;
  if (doc.popularLevel_s == 1) return 'PV';
  if (doc.docType_s == 'COUV') return 'OS';
  if (doc.docType_s == 'DOUV') return 'DO';
  if (doc.docType_s == 'POSTER') return 'AFF';
  if (doc.docType_s == 'THESE') return 'TH';
  if (doc.docType_s == 'HDR') return 'TH';
  if (doc.docType_s == 'MEM') return 'AP';
  if (doc.docType_s == 'REPORT') return 'AP';
  if (doc.docType_s == 'UNDEFINED') return 'AP';
  if (doc.docType_s == 'OTHER') return 'AP';
  if (doc.docType_s == 'LECTURE') return 'AP';
  if (doc.docType_s == 'COMM')
  {
    if (doc.invitedCommunication_s == 1) return 'INV';
    if (doc.proceedings_s == 0) return 'COM';
    if (doc.audience_s == 2) return 'ACTI';
    return 'ACTN';
  }
  if (doc.docType_s == 'ART')
  {
    if (doc.peerReviewing_s == 0) return 'ASCL';
    if (doc.audience_s == 2) return 'ACL';
    return 'ACLN';
  }
  throw new Error('unable to classify this document : ' + JSON.stringify(doc));
}

var getPublications = function(authIdHal, pubKey, queries){
  var ols = {};
  pubKeys.forEach(function (key) {
	  var parent = document.getElementById('pub'+key);
	  if(!parent) return;
      parent.hidden = true;
	  while (parent.lastChild.tagName == 'OL') parent.removeChild(parent.lastChild);
      const ol = document.createElement('ol');
      ol.setAttribute("class","sub");
      parent.appendChild(ol);
	  ols[key] = ol;
  });
  fetchHal(authIdHal, pubKey, queries).then(function (docs) {
    docs.forEach(function (doc) {
      var key = getPubKey(doc, pubKeys);
	  var ol = ols[key];
	  if (!ol) return;
      createPub(doc, ol, pubKeys)
	  ol.parentElement.hidden = false;
	});
  });
}

function parseCitation(doc, citationElement, linksElement)
{
  var regex = /. <a[^>]*href="(https?:\/\/([^"\/]*)\/[^"]*)"[^>]*>&#x27E8;([^<]*)&#x27E9;<\/a>/;
  var citation = doc.citationRef_s;
  while((matches = regex.exec(citation)) !== null) {
    const url = matches[1];
    var host = matches[2];
    const text = matches[3];
    citation = citation.replace(matches[0],'');
    var icons = {
      'dx.doi.org': 'doi.svg',
      'www.mdpi.com': 'mdpi.jpg'
    }
    const img = "img/icons/"+(icons[host] || "link.svg")

    const aElement = document.createElement('a');
    aElement.setAttribute("href",url);
    aElement.setAttribute("class","imgLink");
    imgElement = document.createElement('img');
    imgElement.setAttribute("title",text);
    imgElement.setAttribute("src", img);
    imgElement.setAttribute("height","20");
    imgElement.setAttribute("alt",text);
    aElement.appendChild(imgElement);
    linksElement.appendChild(aElement);
  }
  citationElement.innerHTML = citation;
}

var clickBibtex = function(label_bibtex){
  const input = document.createElement("input");
  document.body.appendChild(input);
  input.value = label_bibtex;
  input.select();
  document.execCommand("copy"); 
  document.body.removeChild(input);
  alert("This bibtex entry should be copied to the clipboard:\n"+label_bibtex);
}

function createBibtex(label_bibtex, parent)
{
  // create a span element inside the new div
  const spanElement = document.createElement('span');
  spanElement.setAttribute("class","bibtex");
  // create an input element inside the span
  const inputElement = document.createElement('input');
  inputElement.setAttribute("type","image");
  inputElement.setAttribute("class","imgLink");
  inputElement.setAttribute("src","img/icons/bibtex.jpg");
  inputElement.setAttribute("alt","Copy BibTeX to clipboard");
  inputElement.setAttribute("title","Copy BibTeX to clipboard");
  inputElement.onclick = function() {clickBibtex(label_bibtex);}
  spanElement.appendChild(inputElement);
  return spanElement;
}

var createPub = function(doc, parent, pubKeys){
  if (!parent) return;
  if (halIdBlacklist.includes(doc.halId_s)) return;

  const listElement = document.createElement('li');
  listElement.setAttribute("class", "bib");
  listElement.setAttribute("id", doc.halId_s);
  const linksElement = document.createElement('span');
  // listElement.innerHTML = '<b>'+doc.comment_s + getPubKey(doc, pubKeys)+'</b>';

  const authors = document.createElement('span');
  for(var i = 0; i < doc.authIdHalFullName_fs.length; ++i)
  {
    const [_idHal, _fullName] = doc.authIdHalFullName_fs[i].split('_FacetSep_');
    const author = document.createElement(_idHal ? 'a' : 'span');
    if(_idHal) author.setAttribute("href",'https://cv.archives-ouvertes.fr/'+_idHal);
    author.setAttribute("id",_idHal);
    author.setAttribute("class","author");
    const span = document.createElement('span');
    span.innerHTML = _fullName;
    author.appendChild(span);
    authors.appendChild(author);
  }
  listElement.appendChild(authors);

  const title = document.createElement('a');
  
  title.setAttribute("href",'https://hal.archives-ouvertes.fr/'+doc.halId_s);
  title.setAttribute("class","title");
  if (doc.en_title_s && doc.fr_title_s) {
    const title_en = document.createElement('span');
    const title_fr = document.createElement('span');
    title_en.setAttribute("class","lang-en");
    title_fr.setAttribute("class","lang-fr");
    title_en.innerHTML = doc.en_title_s;
    title_fr.innerHTML = doc.fr_title_s;
    title.appendChild(title_en);
    title.appendChild(title_fr);
  } else {
    title.innerHTML = (doc.en_title_s || doc.fr_title_s || doc.title_s);
  }
  listElement.appendChild(title);

  const ref = document.createElement('span');
  parseCitation(doc, ref, linksElement);
  listElement.appendChild(ref);

  // create an a element with the url of the pdf
  const file = doc.linkExtUrl_s || doc.fileMain_s || doc.fileMainAnnex_s;
  const files = doc.files_s || (file ? [file] : []);
  for(var i = 0; i < files.length; ++i)
  {
    const file = files[i];
    pdfElement = document.createElement('a');
    pdfElement.setAttribute("href",file);
    pdfElement.setAttribute("class","imgLink");
    imgPdfElement = document.createElement('img');
    imgPdfElement.setAttribute("title","pdf");
    imgPdfElement.setAttribute("src","img/icons/pdf_icon.gif");
    imgPdfElement.setAttribute("height","20");
    imgPdfElement.setAttribute("alt","pdf");
    pdfElement.appendChild(imgPdfElement);
    linksElement.appendChild(pdfElement);
  }
  linksElement.insertBefore(createBibtex(doc.label_bibtex), linksElement.firstChild);
  listElement.insertBefore(linksElement, listElement.firstChild);
  parent.appendChild(listElement);
  jQuery('lang-en').hide();
}

