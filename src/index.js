'use strict';

let fs = require('fs'),
  path = require('path'),
  PEG = require('pegjs');

//TODO cache parser
let lang = fs.readFileSync(path.resolve(__dirname, 'lang.peg'), 'utf8');
let parser = PEG.buildParser(lang);

//doesn't do any processing past the parser right now
function comp(str, opt) {
  return parser.parse(str);
};

//read file and send it over to comp
function compfile(path, opt) {
  if(typeof opt === 'function') opt = {cb:opt};
  fs.readFile(path, 'utf8', (err, data) => {
    if(err) throw err;
    opt.cb(comp(data, opt));
  });
};

//the finished product will cache the parser
let api = {
  parser: parser,
  comp: comp,
  compfile: compfile
};

module.exports = api;