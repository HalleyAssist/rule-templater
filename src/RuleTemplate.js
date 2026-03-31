// Note: We are coupled closely with the ebnf grammar structure of rule-parser
const TemplateGrammar = require('./RuleTemplate.ebnf'),
      TemplateFilters = require('./TemplateFilters'),
    VariableValidate = require('./VariableValidate'),
      RuleParser = require('@halleyassist/rule-parser'),
      RuleParserRules = RuleParser.ParserRules,
      {Parser} = require('ebnf');

let ParserCache = null;

const VariableTypes = [
    'string',
    'number',
    'boolean',
    'object',
    'time period',
    'time period ago',
    'time value',
    'number time',
    'string array',
    'number array',
    'boolean array',
    'object array'
]

const AllowedTypeMapping = {
    'string': ['string_atom', 'string_concat'],
    'number': ['number_atom', 'math_expr'],
    'boolean': ['boolean_atom', 'boolean_expr'],
    'time period': ['time_period_atom'],
    'time period ago': ['time_period_ago_atom'],
    'time value': ['time_value_atom', 'tod_atom'],
    'number time': ['number_atom'],
    'string array': ['string_array'],
    'number array': ['number_array'],
    'boolean array': ['boolean_array'],
    'object': ['object_atom'],
    'object array': ['object_array']
};

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

const cloneRule = (ruleName) => {
    const idx = extendedGrammar.findIndex(rule => rule.name === ruleName);
    if (idx === -1) {
        return null;
    }

    extendedGrammar[idx] = Object.assign({}, extendedGrammar[idx], {
        bnf: extendedGrammar[idx].bnf.map(alt => Array.isArray(alt) ? alt.slice() : alt)
    });

    return extendedGrammar[idx];
};

const appendAlternative = (ruleName, alternative) => {
    const rule = cloneRule(ruleName);
    if (!rule) {
        return;
    }

    const exists = rule.bnf.some(existing => JSON.stringify(existing) === JSON.stringify(alternative));
    if (!exists) {
        rule.bnf.push(alternative);
    }
};

const replaceRule = (ruleName, bnf) => {
    const idx = extendedGrammar.findIndex(rule => rule.name === ruleName);
    if (idx === -1) {
        extendedGrammar.push({name: ruleName, bnf});
        return;
    }

    extendedGrammar[idx] = Object.assign({}, extendedGrammar[idx], {
        bnf: bnf.map(alt => alt.slice())
    });
};

appendAlternative('number_atom', ['template_value']);
appendAlternative('number_time_atom', ['template_value', 'WS+', 'unit']);
appendAlternative('number_time_atom', ['template_value']);
appendAlternative('tod_atom', ['template_value']);
appendAlternative('dow_atom', ['template_value']);
appendAlternative('between_time_only_atom', ['template_value']);
appendAlternative('between_tod_only_atom', ['template_value']);
appendAlternative('string_atom', ['template_value']);
appendAlternative('boolean_atom', ['template_value']);
appendAlternative('time_value_atom', ['template_value']);
appendAlternative('time_period_atom', ['template_value']);
appendAlternative('time_period_ago_atom', ['template_value']);
appendAlternative('object_atom', ['template_value']);
appendAlternative('string_array', ['template_value']);
appendAlternative('number_array', ['template_value']);
appendAlternative('boolean_array', ['template_value']);
appendAlternative('object_array', ['template_value']);

replaceRule('argument', [
    ['number_time_atom', 'WS*'],
    ['statement', 'WS*']
]);

replaceRule('simple_result', [
    ['fcall'],
    ['number_time_atom'],
    ['value']
]);

// Export the parser rules for potential external use
const ParserRules = extendedGrammar;

class RuleTemplate {
    constructor(ruleTemplateText, ast) {
        this.ruleTemplateText = ruleTemplateText;
        this.ast = ast;
    }

    /**
     * Parse a rule template string and return a RuleTemplate instance
     * @param {string} ruleTemplate - The template string to parse
     * @returns {RuleTemplate} Instance with AST and template text
     */
    static parse(ruleTemplate){
        if(!ParserCache){
            ParserCache = new Parser(ParserRules, {debug: false})
        }

        const ast = RuleParser.toAst(ruleTemplate.trim(), ParserCache);
        return new RuleTemplate(ruleTemplate, ast);
    }

    /**
     * Extract variables from the template using the AST
     * @returns {Array} Array of {name, filters: [], positions: [{start, end}]} objects
     */
    extractVariables(){
        const variables = [];
        const variableMap = new Map();
        
        const traverse = (node) => {
            if (!node) return;
            
            // Check if this is a template_value node
            if (node.type === 'template_value') {
                // Extract the variable information
                const varInfo = this._extractVariableFromNode(node);
                if (varInfo) {
                    // Add position to existing variable or create new entry
                    if (variableMap.has(varInfo.name)) {
                        const existing = variableMap.get(varInfo.name);
                        existing.positions.push({
                            start: varInfo.start,
                            end: varInfo.end
                        });
                    } else {
                        variableMap.set(varInfo.name, {
                            name: varInfo.name,
                            filters: varInfo.filters,
                            positions: [{
                                start: varInfo.start,
                                end: varInfo.end
                            }]
                        });
                    }
                }
            }
            
            // Traverse children
            if (node.children) {
                for (const child of node.children) {
                    traverse(child);
                }
            }
        };
        
        traverse(this.ast);
        
        // Convert map to array
        for (const variable of variableMap.values()) {
            variables.push(variable);
        }
        
        return variables;
    }

    /**
     * Extract function calls from the template using the AST
     * @returns {Array} Array of unique function names used in the template
     */
    extractFunctions(){
        const functions = new Set();
        
        const traverse = (node) => {
            if (!node) return;
            
            // Check if this is a function call node
            if (node.type === 'fcall') {
                // Find the function name in children
                const fnameNode = node.children?.find(c => c.type === 'fname');
                if (fnameNode && fnameNode.text) {
                    functions.add(fnameNode.text.trim());
                }
            }
            
            // Traverse children
            if (node.children) {
                for (const child of node.children) {
                    traverse(child);
                }
            }
        };
        
        traverse(this.ast);
        
        // Convert set to sorted array for consistent output
        return Array.from(functions).sort();
    }

    /**
     * Extract variable name and filters from a template_value AST node
     * @private
     */
    _extractVariableFromNode(node) {
        if (node.type !== 'template_value') return null;
        
        // Find the template_expr child
        const templateExpr = node.children?.find(c => c.type === 'template_expr');
        if (!templateExpr) return null;
        
        // Extract the path (variable name)
        const templatePath = templateExpr.children?.find(c => c.type === 'template_path');
        if (!templatePath || !templatePath.text) return null;
        
        const name = templatePath.text.trim();
        
        // Extract filters
        const filters = [];
        const filterCalls = [];
        for (const child of templateExpr.children || []) {
            if (child.type === 'template_filter_call') {
                const filterCall = this._extractFilterCall(child);
                if (filterCall) {
                    filters.push(filterCall.name);
                    filterCalls.push(filterCall);
                }
            }
        }
        
        // Extract position information from the node
        const start = node.start;
        const end = node.end;
        
        return { name, filters, filterCalls, start, end };
    }

    /**
     * Extract filter call from template_filter_call node
     * @private
     */
    _extractFilterCall(node) {
        const filterNameNode = node.children?.find(c => c.type === 'template_filter_name');
        if (!filterNameNode || !filterNameNode.text) return null;

        const argsNode = node.children?.find(c => c.type === 'template_filter_args');

        return {
            name: filterNameNode.text.trim(),
            args: this._extractFilterArgs(argsNode)
        };
    }

    _extractFilterArgs(node) {
        if (!node || !Array.isArray(node.children)) {
            return [];
        }

        return node.children
            .filter(child => child.type === 'template_filter_arg')
            .map(child => this._extractFilterArgValue(child));
    }

    _extractFilterArgValue(node) {
        if (!node || !Array.isArray(node.children) || node.children.length === 0) {
            return this._normalizeFilterArgText(node?.text?.trim() || '');
        }

        const child = node.children[0];
        if (!child) {
            return this._normalizeFilterArgText(node.text?.trim() || '');
        }

        if (child.type === 'value' && Array.isArray(child.children) && child.children.length > 0) {
            return this._extractFilterArgValue(child);
        }

        if (child.type === 'string') {
            try {
                return JSON.parse(child.text);
            } catch (error) {
                return this._normalizeFilterArgText(child.text);
            }
        }

        if (child.type === 'number') {
            return Number(child.text);
        }

        if (child.type === 'true') {
            return true;
        }

        if (child.type === 'false') {
            return false;
        }

        if (child.type === 'null') {
            return null;
        }

        return this._normalizeFilterArgText(child.text?.trim() || node.text?.trim() || '');
    }

    _normalizeFilterArgText(text) {
        const normalizedText = String(text).trim();

        if ((normalizedText.startsWith('"') && normalizedText.endsWith('"')) || (normalizedText.startsWith("'") && normalizedText.endsWith("'"))) {
            return normalizedText.slice(1, -1);
        }

        return normalizedText;
    }

    /**
     * Validate variable types against the AST
     * @param {Object} variables - Object mapping variable names to {type} objects
     * @param {Object} [functionBlob] - Optional HalleyFunctionBlob used for non-fatal function warnings
     * @returns {Object} Object with validation results: {valid: boolean, errors: [], warnings: []}
     */
    validate(variables, functionBlob) {
        if (!variables || typeof variables !== 'object') {
            return {
                valid: false,
                errors: ['Variables must be provided as an object'],
                warnings: []
            };
        }

        const errors = [];
        const warnings = [];
        const extractedVars = this._extractTemplateVariables();
        const seenVariables = new Set();
        const seenFilterErrors = new Set();
        
        for (const varInfo of extractedVars) {
            const varName = varInfo.name;

            for (const filter of (varInfo.filterCalls || varInfo.filters || [])) {
                const filterName = typeof filter === 'string' ? filter : filter?.name;
                if (filterName && TemplateFilters[filterName]) {
                    continue;
                }

                const errorMessage = `Unknown filter '${filterName || filter}' for variable '${varName}'`;
                if (!seenFilterErrors.has(errorMessage)) {
                    errors.push(errorMessage);
                    seenFilterErrors.add(errorMessage);
                }
            }

            if (seenVariables.has(varName)) {
                continue;
            }

            seenVariables.add(varName);
            
            // Check if variable is provided
            if (!variables.hasOwnProperty(varName)) {
                errors.push(`Variable '${varName}' not provided in variables object`);
                continue;
            }
            
            const varData = variables[varName];
            if (typeof varData !== 'object') {
                errors.push(`Variable '${varName}' must be an object`);
                continue;
            }
            
            const { type } = varData;
            
            // Validate type if provided
            if (type && !VariableTypes.includes(type)) {
                errors.push(`Invalid variable type '${type}' for variable '${varName}'`);
                continue;
            }

            if (type) {
                const validation = VariableValidate.validate(varData);
                if (!validation.valid) {
                    errors.push(`Invalid value for variable '${varName}': ${validation.error}`);
                }
            }
        }

        if (errors.length === 0) {
            try {
                RuleParser.toAst(this.prepare(variables));
            } catch (error) {
                errors.push(`Prepared rule is invalid: ${error.message}`);
            }
        }

        if (functionBlob && typeof functionBlob.validate === 'function') {
            for (const functionCall of this._extractFunctionCalls()) {
                warnings.push(...functionBlob.validate(functionCall.name, functionCall.arguments));
            }
        }
        
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    _extractFunctionCalls() {
        const functionCalls = [];

        const traverse = (node) => {
            if (!node) return;

            if (node.type === 'fcall') {
                const functionName = node.children?.find(c => c.type === 'fname')?.text?.trim();
                const argumentsNode = node.children?.find(c => c.type === 'arguments');
                if (functionName) {
                    functionCalls.push({
                        name: functionName,
                        arguments: argumentsNode?.children
                            ?.filter(c => c.type === 'argument')
                            .map(c => c.text) || []
                    });
                }
            }

            if (node.children) {
                for (const child of node.children) {
                    traverse(child);
                }
            }
        };

        traverse(this.ast);
        return functionCalls;
    }

    _extractTemplateVariables() {
        const variables = [];

        const traverse = (node) => {
            if (!node) return;

            if (node.type === 'template_value') {
                const variableInfo = this._extractVariableFromNode(node);
                if (variableInfo) {
                    variables.push(variableInfo);
                }
            }

            if (node.children) {
                for (const child of node.children) {
                    traverse(child);
                }
            }
        };

        traverse(this.ast);
        return variables;
    }

    /**
     * Prepare the template by replacing variables with their values
     * Rebuilds from AST by iterating through children
     * @param {Object} variables - Object mapping variable names to {value, type} objects
     * @returns {string} The prepared rule string
     */
    prepare(variables){
        if (!variables || typeof variables !== 'object') {
            throw new Error('Variables must be provided as an object');
        }

        // Rebuild the rule string from AST
        return this._rebuildFromAST(this.ast, variables);
    }

    /**
     * Rebuild rule string from AST node, replacing template_value nodes with variable values
     * @private
     * @param {Object} node - AST node
     * @param {Object} variables - Object mapping variable names to {value, type} objects
     * @returns {string} Rebuilt string
     */
    _rebuildFromAST(node, variables) {
        if (!node) return '';
        
        // If this is a template_value node, replace it with the computed value
        if (node.type === 'template_value') {
            return this._computeTemplateReplacement(node, variables);
        }
        
        // If node has no children, it's a leaf - return its text
        if (!node.children || node.children.length === 0) {
            return node.text || '';
        }
        
        // Node has children - rebuild by iterating through children and preserving gaps
        let result = '';
        const originalText = node.text || '';
        let lastEnd = node.start || 0;
        
        for (const child of node.children) {
            // Add any text between the last child's end and this child's start (gaps/syntax)
            if (child.start !== undefined && child.start > lastEnd) {
                result += originalText.substring(lastEnd - (node.start || 0), child.start - (node.start || 0));
            }
            
            // Add the child's rebuilt text
            result += this._rebuildFromAST(child, variables);
            
            // Update lastEnd to this child's end position
            if (child.end !== undefined) {
                lastEnd = child.end;
            }
        }
        
        // Add any remaining text after the last child
        if (node.end !== undefined && lastEnd < node.end) {
            result += originalText.substring(lastEnd - (node.start || 0), node.end - (node.start || 0));
        }
        
        return result;
    }

    /**
     * Compute the replacement value for a template_value node
     * @private
     * @param {Object} node - template_value AST node
     * @param {Object} variables - Object mapping variable names to {value, type} objects
     * @returns {string} Replacement string
     */
    _computeTemplateReplacement(node, variables) {
        const templateInfo = this._extractVariableFromNode(node);
        if (!templateInfo) {
            throw new Error(`Failed to extract variable information from template node`);
        }
        
        const varName = templateInfo.name;
        
        // Validate variable is provided
        if (!variables.hasOwnProperty(varName)) {
            throw new Error(`Variable '${varName}' not provided in variables object`);
        }
        
        let varData = variables[varName];
        if (typeof varData !== 'object' || !varData.hasOwnProperty('value')) {
            throw new Error(`Variable '${varName}' must be an object with 'value' property`);
        }

        varData = Object.assign({}, varData);
        
        // Require type property for all variables
        if (!varData.hasOwnProperty('type')) {
            throw new Error(`Variable '${varName}' must have a 'type' property`);
        }
        
        // Validate type
        if (!VariableTypes.includes(varData.type)) {
            throw new Error(`Invalid variable type '${varData.type}' for variable '${varName}'`);
        }
        
        // Apply filters if present
        if (templateInfo.filters && templateInfo.filters.length > 0) {
            for (const filter of (templateInfo.filterCalls || templateInfo.filters)) {
                const filterName = typeof filter === 'string' ? filter : filter?.name;
                const filterArgs = typeof filter === 'string' ? [] : (Array.isArray(filter?.args) ? filter.args : []);

                if (!filterName || !TemplateFilters[filterName]) {
                    throw new Error(`Unknown filter '${filterName || filter}'`);
                }

                TemplateFilters[filterName](varData, ...filterArgs);
            }
        }

        const validation = VariableValidate.validate(varData);
        if (!validation.valid) {
            throw new Error(`Invalid value for variable '${varName}': ${validation.error}`);
        }

        return this._serializeVarData(varData, varName);
    }

    _serializeVarData(varData, varName) {
        const { value, type } = varData;

        if (!VariableTypes.includes(type)) {
            throw new Error(`Invalid variable type '${type}' for variable '${varName}'`);
        }

        if (type === 'string') {
            return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
        }

        if (type === 'number') {
            return String(value);
        }

        if (type === 'boolean') {
            return value ? 'true' : 'false';
        }

        if (type === 'time period') {
            return `BETWEEN ${value.from} AND ${value.to}`;
        }

        if (type === 'time period ago') {
            return `${value.ago[0]} ${value.ago[1]} AGO BETWEEN ${value.from} AND ${value.to}`;
        }

        if (type === 'object' || type === 'string array' || type === 'number array' || type === 'boolean array' || type === 'object array') {
            return JSON.stringify(value);
        }

        return String(value);
    }

    /**
     * Helper method to validate if an AST node matches a variable type
     * @param {Object} astNode - The AST node to validate
     * @param {string} variableType - The expected variable type
     * @returns {boolean} True if valid, false otherwise
     */
    static validateVariableNode(astNode, variableType) {
        if (!astNode || !astNode.type) {
            return false;
        }

        const allowedTypes = AllowedTypeMapping[variableType];
        if (!allowedTypes) {
            return false;
        }

        return allowedTypes.includes(astNode.type);
    }
}

RuleTemplate.ParserRules = ParserRules;
RuleTemplate.VariableTypes = VariableTypes;
RuleTemplate.TemplateFilters = TemplateFilters;
RuleTemplate.VariableValidate = VariableValidate;

module.exports = RuleTemplate;
