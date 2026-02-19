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
        
        // Extract position information from the node
        const start = node.start;
        const end = node.end;
        
        return { name, filters, start, end };
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
        
        const varData = variables[varName];
        if (typeof varData !== 'object' || !varData.hasOwnProperty('value')) {
            throw new Error(`Variable '${varName}' must be an object with 'value' property`);
        }
        
        let { value, type } = varData;
        
        // Require type property for all variables
        if (!varData.hasOwnProperty('type')) {
            throw new Error(`Variable '${varName}' must have a 'type' property`);
        }
        
        // Validate type
        if (!VariableTypes.includes(type)) {
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
            return String(value);
        }
        
        // Convert value to string representation based on type
        if (type === 'string') {
            // Escape backslashes first, then quotes in string values.
            // Order is critical: escaping backslashes first prevents double-escaping.
            // E.g., "test\" becomes "test\\" then "test\\\"" (correct)
            // If reversed, "test\" would become "test\\"" then "test\\\\"" (incorrect)
            return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
        } else if (type === 'number') {
            return String(value);
        } else if (type === 'boolean') {
            return value ? 'true' : 'false';
        } else {
            // Default behavior - just insert the value as-is
            return String(value);
        }
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