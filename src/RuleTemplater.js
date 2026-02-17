// Note: We import the internal RuleParser.ebnf to extend the grammar with template rules.
// This creates coupling to the internal structure of @halleyassist/rule-parser.
// TODO: Consider requesting that the parser package exports ParserRules in its public API.
const RuleParserRules = require('@halleyassist/rule-parser/src/RuleParser.ebnf'),
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

// Merge the base grammar with template-specific grammar rules
const extendedGrammar = [...RuleParserRules]
for(const rule of TemplateGrammar){
    const idx = extendedGrammar.findIndex(r => r.name === rule.name);
    if(idx !== -1){
        extendedGrammar[idx] = rule;
    } else {
        extendedGrammar.push(rule);
    }
}

// Export the parser rules for potential external use
const ParserRules = extendedGrammar;

class RuleTemplate {
    static parse(ruleTemplate){
        if(!ParserCache){
            ParserCache = new Parser(ParserRules, {debug: false})
        }

        const ast = ParserCache.getAST(ruleTemplate.trim(), 'statement_main');
        return ast;
    }

    static validateVariableNode(astNode, variableType) {
        // check if the astNode is valid for the variableType
        // e.g if tod_atom, check if it's a valid time of day value
        
        if (!astNode || !astNode.type) {
            return false;
        }

        // Map variable types to expected AST node types
        const typeMapping = {
            'string': ['string_atom', 'string_concat'],
            'number': ['number_atom', 'math_expr'],
            'boolean': ['boolean_atom', 'boolean_expr'],
            'time period': ['time_period_atom'],
            'time value': ['time_value_atom', 'tod_atom'],
            'string array': ['string_array'],
            'number array': ['number_array'],
            'boolean array': ['boolean_array'],
            'object': ['object_atom'],
            'object array': ['object_array']
        };

        const allowedTypes = typeMapping[variableType];
        if (!allowedTypes) {
            return false;
        }

        return allowedTypes.includes(astNode.type);
    }

    static prepare(ruleTemplate, variables){
        /*
        variables to be supplied as {variableName: {value:, type:}}
        */
        
        if (!variables || typeof variables !== 'object') {
            throw new Error('Variables must be provided as an object');
        }

        // Replace template variables in the format ${VARIABLE_NAME}
        let result = ruleTemplate;
        
        // Match template variables like ${ACTION} or ${TIME}
        const templateRegex = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
        
        result = result.replace(templateRegex, (match, varName) => {
            if (!variables.hasOwnProperty(varName)) {
                throw new Error(`Variable '${varName}' not provided in variables object`);
            }
            
            const varData = variables[varName];
            if (typeof varData !== 'object' || !varData.hasOwnProperty('value')) {
                throw new Error(`Variable '${varName}' must be an object with 'value' property`);
            }
            
            const { value, type } = varData;
            
            // Validate type if provided
            if (type && !VariableTypes.includes(type)) {
                throw new Error(`Invalid variable type '${type}' for variable '${varName}'`);
            }
            
            // Convert value to string representation based on type
            if (type === 'string') {
                // Escape backslashes first, then quotes in string values
                return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
            } else if (type === 'number') {
                return String(value);
            } else if (type === 'boolean') {
                return value ? 'true' : 'false';
            } else {
                // Default behavior - just insert the value as-is
                return String(value);
            }
        });
        
        return result;
    }

    static extractVariables(ruleString){
        // return a variables object
        const variables = {};
        
        // Match template variables like ${ACTION} or ${TIME}
        const templateRegex = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
        
        let match;
        while ((match = templateRegex.exec(ruleString)) !== null) {
            const varName = match[1];
            if (!variables[varName]) {
                variables[varName] = {
                    name: varName,
                    positions: []
                };
            }
            variables[varName].positions.push({
                start: match.index,
                end: match.index + match[0].length
            });
        }
        
        return variables;
    }
}

// Export the class and parser rules
module.exports = RuleTemplate;
module.exports.ParserRules = ParserRules;
module.exports.VariableTypes = VariableTypes;