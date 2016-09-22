'use strict';

let _ = require('lodash');

const config = {
  main: 'main',
  maxDepth: 100
};

function comp(parseTree, o) {
  //make options default to config when things aren't set
  //not allowed to use Proxy yet since it breaks debuggers
  /*opt = new Proxy(o || {}, {
    get: (target, key) => key in target ?
        target[key] :
        config[key],
  });*/
  let opt = Object.assign({}, config, o);
  let main = opt.main;
  //make a tree of modules based on the parse tree
  function modRec(rules, parent) {
    let dict = {};
    for(let mod of rules) {
      if(mod.t !== 'module') continue;
      let entry = dict[mod.name] = {
        mod: mod,
        parent: parent
      };
      entry.submods = modRec(mod.rules, entry);
    }
    return dict;
  }
  //used for looking up modules
  function lookup(key, modDict) {
    if(!modDict) return null;
    else if(key in modDict.submods) return modDict.submods[key];
    else return lookup(key, modDict.parent);
  }
  //builds a particular module (concretely - it's given parameters for templates)
  function doComp(main, modDict, params, past) {
    let result = {
      nodes: new Set()
    };//TODO
    
    let modEntry = lookup(main, modDict);
    let modData = modEntry.mod;
    //console.log(modEntry);
    //basic error checking
    let modName = main+(params.length?`<${params.join(',')}>`:'');
    console.log('building '+modName);
    if(modData === null) throw new Error(`module ${modName} not found`);
    let templ = modData.template;
    if(params.length !== templ.length) throw new Error(`module ${main} passed ${params.length} params, expected ${templ.length}`);
    if(past.length >= opt.maxDepth) throw new Error(`module ${modName} reached max recursion depth (${opt.maxDepth})`)
    let state = {
      main: main,
      params: params
    };
    for(let p of past) {
      if(_.isEqual(state, p)) throw new Error(`cycle detected for module ${modName}`);
    }
    //end of error checking
    
    past = _.clone(past);
    past.push(state);
    
    //evaluating numeric values - used for templates of modules
    let ctx = _.zipObject(templ, params);
    //build our dictionary of integer operators
    let iOpsStrs = '+ - * / > < <= >= == !='.split(' ');
    let iOps = _.zipObject(iOpsStrs, iOpsStrs.map(
      c => eval(`(function(a,b) { return (a ${c} b) | 0; })`)
    ));
    //operator expressions inside the tree have their own 'custom' parse tree
    //example for a+2 would be ['+','a',2].  it's recursive ofc
    function evalIntExpr(expr) {
      if(Array.isArray(expr)) {
        return iOps[expr[0]](
          evalIntExpr(expr[1]),
          evalIntExpr(expr[2]));
      } else if(typeof expr === 'string') {
        return ctx[expr];
      }
      return expr;
    }

    //builds a particular set of rules within a particular module context
    function build(rules, inCond) {
      let exportVar = (name, rule) => {
        if(inCond) throw new Error(`${name} can't be inside conditional`);
      };
      //rules for each type of statement
      let ops = {
        'var': rule => {
          //console.log('var',rule);
        },
        module: rule => {
          if(inCond) throw new Error(`module can't be inside conditional`);
          //otherwise ignored because modRec and the dictionary it produces are
          //what actually is used to recognize modules
        },
        'if': rule => {
          let cond = evalIntExpr(rule.cond);
          if(cond) build(rule.rules, true);
          else build(rule.elstmt, true);
        },
        join: rule => {
          
        },
        modref: rule => {
          //find entry in our scope tree
          //let newMod = lookup(rule.name, dict);
          //console.log('MOD '+main);
          //console.log(require('util').inspect(newMod, false, null));
          //this subscope becomes our new dictionary
          let result = doComp(rule.name, modEntry,
            rule.template.map(evalIntExpr), past);
        },
        input: exportVar.bind(null, 'input'),
        output: exportVar.bind(null, 'output')
      };
      //scan through each rule
      for(let i=0; i<rules.length; i++) {
        let rule = rules[i];
        //console.log(rule);
        let fn = ops[rule.t];
        fn(rule);
      }
    }
    build(modData.rules, false);
    return result;
  }
  let root = {parent: null};
  root.submods = modRec(parseTree, root);
  
  //uses submods at the top to cooperate with the lookup function
  return doComp(main, root, [], []);
}

module.exports = comp;