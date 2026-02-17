const RuleParser = require('@halleyassist/rule-parser'),
      TemplateGrammar = require('./RuleTemplate.ebnf'),
        {Parser} = require('ebnf');

let ParserCache = null;

const VariableTypes = [
    'string',
    'number',
    'boolean',
    'object',
    'time period',
    'time value',
    'string array',
    'number array',
    'boolean array',
    'object array'
]

const extendedGrammar = [...RuleParser.ParserRules]
for(const rule of TemplateGrammar){
    const idx = extendedGrammar.findIndex(r => r.name === rule.name);
    if(idx !== -1){
        extendedGrammar[idx] = rule;
    } else {
        extendedGrammar.push(rule);
    }
}

class RuleTemplate {
    static parse(ruleTemplate){
        if(!ParserCache){
            ParserCache = new Parser(ParserRules, {debug: false})
        }

        const ast = ParserCache.getAST(ruleTemplate.trim(), 'statement_main');
        return ast;
    }

    prepare(ruleTemplate, variables){
        /*
        variables to be supplied as {variableName: {value:, type:}}
        */
        // return a rule string
    }

    extractVariables(ruleString){
        // return a variables object
    }
}
module.exports = RuleTemplate