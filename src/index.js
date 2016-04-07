'use strict';
//use bluebird only internally (don't want to force it on others)
let Promise = require('bluebird');
let fs = Promise.promisifyAll(require('fs')),
  path = require('path'),
  PEG = require('pegjs');

//TODO cache parser
let lang = fs.readFileSync(path.resolve(__dirname, 'lang.peg'), 'utf8');
let parser = PEG.buildParser(lang);

//doesn't do any processing past the parser right now
function comp(tree, opt) {
  return tree;
};

//read file and send it over to comp
function compfiles(paths, opt) {
  if(typeof opt === 'function') opt = {cb:opt};
  Promise.map(paths, path => fs.readFileAsync(path, 'utf8').then(
    data => parser.parse(data)
  )).then(parses => {
    let tree = [].concat.apply([], parses);
    opt.cb(comp(tree));
  });
};

//the finished product will cache the parser
let api = {
  parser: parser,
  comp: comp,
  compfiles: compfiles
};

module.exports = api;