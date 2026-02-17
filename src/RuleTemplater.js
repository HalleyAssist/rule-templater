// Note: We import the internal RuleParser.ebnf to extend the grammar with template rules.
// This creates coupling to the internal structure of @halleyassist/rule-parser.
const RuleParserRules = require('@halleyassist/rule-parser/src/RuleParser.ebnf'),
      TemplateGrammar = require('./RuleTemplate.ebnf'),
      TemplateFilters = require('./TemplateFilters'),
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

const AllowedTypeMapping = {
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

// Add template_value as an alternative to value_atom so templates can be parsed
const valueAtomIdx = extendedGrammar.findIndex(r => r.name === 'value_atom');
if (valueAtomIdx !== -1) {
    extendedGrammar[valueAtomIdx].bnf.push(['template_value']);
}

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

        const ast = ParserCache.getAST(ruleTemplate.trim(), 'statement_main');
        return new RuleTemplate(ruleTemplate, ast);
    }

    /**
     * Extract variables from the template using the AST
     * @returns {Array} Array of {name, filters: []} objects
     */
    extractVariables(){
        const variables = [];
        const seen = new Set();
        
        const traverse = (node) => {
            if (!node) return;
            
            // Check if this is a template_value node
            if (node.type === 'template_value') {
                // Extract the variable information
                const varInfo = this._extractVariableFromNode(node);
                if (varInfo && !seen.has(varInfo.name)) {
                    seen.add(varInfo.name);
                    variables.push(varInfo);
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
        return variables;
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
        for (const child of templateExpr.children || []) {
            if (child.type === 'template_filter_call') {
                const filterName = this._extractFilterName(child);
                if (filterName) {
                    filters.push(filterName);
                }
            }
        }
        
        return { name, filters };
    }

    /**
     * Extract filter name from template_filter_call node
     * @private
     */
    _extractFilterName(node) {
        const filterNameNode = node.children?.find(c => c.type === 'template_filter_name');
        if (!filterNameNode || !filterNameNode.text) return null;
        
        return filterNameNode.text.trim();
    }

    /**
     * Validate variable types against the AST
     * @param {Object} variables - Object mapping variable names to {type} objects
     * @returns {Object} Object with validation results: {valid: boolean, errors: []}
     */
    validate(variables) {
        if (!variables || typeof variables !== 'object') {
            return {
                valid: false,
                errors: ['Variables must be provided as an object']
            };
        }

        const errors = [];
        const extractedVars = this.extractVariables();
        
        for (const varInfo of extractedVars) {
            const varName = varInfo.name;
            
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
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Prepare the template by replacing variables with their values
     * Uses AST traversal for more robust replacement
     * @param {Object} variables - Object mapping variable names to {value, type} objects
     * @returns {string} The prepared rule string
     */
    prepare(variables){
        if (!variables || typeof variables !== 'object') {
            throw new Error('Variables must be provided as an object');
        }

        // Collect all template_value nodes from the AST with their replacement values
        const replacements = this._collectTemplateReplacements(variables);
        
        // Replace templates in the AST's text
        // Note: this is safe because the parser ensures templates only appear in valid
        // positions (value_atom). Templates inside string literals are not parsed as
        // template_value nodes, so they won't be replaced.
        let result = this.ast.text;
        
        // Do replacements - sort by length (longest first) to handle edge cases
        // where one template might be a substring of another
        // Note: Using Map means same template text only stored once, but replaceAll()
        // will replace all occurrences
        const sortedReplacements = Array.from(replacements.entries())
            .sort((a, b) => b[0].length - a[0].length);
        
        for (const [templateText, replacement] of sortedReplacements) {
            // Use replaceAll to handle multiple occurrences of the same template
            result = result.replaceAll(templateText, replacement);
        }
        
        return result;
    }

    /**
     * Collect all template_value nodes and compute their replacement strings
     * @private
     * @param {Object} variables - Object mapping variable names to {value, type} objects
     * @returns {Map} Map from template node text to replacement string
     */
    _collectTemplateReplacements(variables) {
        const replacements = new Map();
        
        const traverse = (node) => {
            if (!node) return;
            
            if (node.type === 'template_value') {
                const templateInfo = this._extractVariableFromNode(node);
                if (!templateInfo) {
                    throw new Error(`Failed to extract variable information from template node`);
                }
                
                const varName = templateInfo.name;
                
                // Validate variable is provided
                if (!variables.hasOwnProperty(varName)) {
                    throw new Error(`Variable '${varName}' not provided in variables object`);
                }
                
                const varData = variables[varName];
                if (typeof varData !== 'object' || !varData.hasOwnProperty('value')) {
                    throw new Error(`Variable '${varName}' must be an object with 'value' property`);
                }
                
                let { value, type } = varData;
                
                // Validate type if provided
                if (type && !VariableTypes.includes(type)) {
                    throw new Error(`Invalid variable type '${type}' for variable '${varName}'`);
                }
                
                // Apply filters if present
                if (templateInfo.filters && templateInfo.filters.length > 0) {
                    for (const filterName of templateInfo.filters) {
                        if (!TemplateFilters[filterName]) {
                            throw new Error(`Unknown filter '${filterName}'`);
                        }
                        value = TemplateFilters[filterName](value);
                    }
                    // After applying filters, the result is already a string representation
                    replacements.set(node.text, String(value));
                    return;
                }
                
                // Convert value to string representation based on type
                let replacement;
                if (type === 'string') {
                    // Escape backslashes first, then quotes in string values.
                    // Order is critical: escaping backslashes first prevents double-escaping.
                    // E.g., "test\" becomes "test\\" then "test\\\"" (correct)
                    // If reversed, "test\" would become "test\\"" then "test\\\\"" (incorrect)
                    replacement = `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
                } else if (type === 'number') {
                    replacement = String(value);
                } else if (type === 'boolean') {
                    replacement = value ? 'true' : 'false';
                } else {
                    // Default behavior - just insert the value as-is
                    replacement = String(value);
                }
                
                replacements.set(node.text, replacement);
            }
            
            // Traverse children
            if (node.children) {
                for (const child of node.children) {
                    traverse(child);
                }
            }
        };
        
        traverse(this.ast);
        return replacements;
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

// Export the class and parser rules
module.exports = RuleTemplate;
module.exports.ParserRules = ParserRules;
module.exports.VariableTypes = VariableTypes;
module.exports.TemplateFilters = TemplateFilters;