'use strict';

let _ = require('lodash');

const config = {
  main: 'main',
  maxDepth: 100
};

function comp(tree, o) {
  //make options default to config when things aren't set
  //not allowed to use Proxy yet since it breaks debuggers
  /*opt = new Proxy(o || {}, {
    get: (target, key) => key in target ?
        target[key] :
        config[key],
  });*/
  let opt = Object.assign({}, config, o);
  let main = opt.main;
  //make a parse tree of modules
  function modRec(rules, parent) {
    let dict = {};
    for(let mod of rules) {
      if(mod.t !== 'module') continue;
      dict[mod.name] = {
        mod: mod,
        submods: modRec(mod.rules, dict),
        parent: parent
      };
    }
    return dict;
  }
  //used for looking up modules
  function lookup(key, dict) {
    if(!dict) return null;
    else if(key in dict.submods) return dict.submods[key];
    else return lookup(key, dict.parent);
  }
  //builds a particular module (concretely - it's given parameters for templates)
  function doComp(main, dict, tree, params, past) {
    let ret = {};//TODO
    
    let entry = lookup(main, dict);
    let mod = entry.mod;
    //console.log(entry);
    //basic error checking
    let modName = main+(params.length?`<${params.join(',')}>`:'');
    if(mod === null) throw new Error(`module ${modName} not found`);
    let templ = mod.template;
    if(params.length !== templ.length) throw new Error(`module ${main} passed ${params.length} params, expected ${templ.length}`);
    if(past.length >= opt.maxDepth) throw new Error(`module ${modName} reached max recursion depth (${config()})`)
    for(let p of past) {
      if(main === p.main && _.isEqual(params, p.params)) throw new Error(`cycle detected for module ${modName}`);
    }
    //end of error checking
    
    //evaluating numeric values - used for templates of modules
    let ctx = _.zipObject(templ, params);
    //build our dictionary of integer operators
    let iOpsStrs = [].concat(
      '+-*/><'.split(''),
      '<= >= == !='.split(' ')
    );
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
    function build(rules, cond) {
      
      let exportVar = (name, rule) => {
        if(cond) throw new Error(`${name} can't be inside if statement`);
      };
      //rules for each type of statement
      let ops = {
        var: rule => {
          
        },
        module: rule => {
          if(cond) throw new Error(`module can't be inside if statement`);
        },
        'if': rule => {
          
        },
        join: rule => {
          
        },
        modref: rule => {
        },
        input: exportVar.bind(null, 'input'),
        output: exportVar.bind(null, 'output')
      };
      //scan through each rule
      for(let rule of rules) {
        console.log(rule);
        let fn = ops[rule.t];
        fn(rule);
      }
    }
    build(mod.rules);
  }
  let dict = modRec(tree, null);
  //uses submods at the top to cooperate with the lookup function
  return doComp(main, {submods:dict}, tree, [], []);
}

module.exports = comp;