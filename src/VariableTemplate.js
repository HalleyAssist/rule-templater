const { Parser } = require('ebnf');
const RuleTemplate = require('./RuleTemplate');
const TemplateFilters = require('./TemplateFilters');

let ParserCache = null;

class VariableTemplate {
    constructor(templateText, ast, variableInfo) {
        this.templateText = templateText;
        this.ast = ast;
        this.variable = variableInfo;
    }

    static parse(templateText) {
        if (typeof templateText !== 'string') {
            throw new Error('Variable template must be a string');
        }

        const expressionText = VariableTemplate._normalizeExpression(templateText);
        if (!expressionText) {
            throw new Error('Variable template cannot be empty');
        }

        if (!ParserCache) {
            ParserCache = new Parser(RuleTemplate.ParserRules, { debug: false });
        }

        const ast = ParserCache.getAST(expressionText, 'template_expr');
        const variableInfo = VariableTemplate._extractVariableFromAst(ast);
        if (!variableInfo) {
            throw new Error('Invalid variable template expression');
        }

        return new VariableTemplate(templateText, ast, variableInfo);
    }

    extractVariable() {
        return {
            name: this.variable.name,
            filters: this.variable.filters.map(filter => filter.name)
        };
    }

    format(variableData) {
        let varData = variableData;

        if (!varData || typeof varData !== 'object') {
            throw new Error('Variable data must be provided as an object');
        }

        if (!Object.prototype.hasOwnProperty.call(varData, 'value')) {
            if (!Object.prototype.hasOwnProperty.call(varData, this.variable.name)) {
                throw new Error(`Variable '${this.variable.name}' not provided`);
            }

            varData = varData[this.variable.name];
        }

        if (!varData || typeof varData !== 'object' || !Object.prototype.hasOwnProperty.call(varData, 'value')) {
            throw new Error(`Variable '${this.variable.name}' must be an object with 'value' property`);
        }

        varData = VariableTemplate._cloneVarData(varData);

        for (const filter of this.variable.filters) {
            const filterName = typeof filter === 'string' ? filter : filter?.name;
            const filterArgs = typeof filter === 'string' ? [] : (Array.isArray(filter?.args) ? filter.args : []);

            if (!filterName || !TemplateFilters[filterName]) {
                throw new Error(`Unknown filter '${filterName || filter}'`);
            }

            TemplateFilters[filterName](varData, ...filterArgs);
        }

        return varData;
    }

    static _normalizeExpression(templateText) {
        const trimmed = templateText.trim();
        if (trimmed.startsWith('${') && trimmed.endsWith('}')) {
            return trimmed.slice(2, -1).trim();
        }

        return trimmed;
    }

    static _extractVariableFromAst(ast) {
        if (!ast || ast.type !== 'template_expr') {
            return null;
        }

        const templatePath = ast.children?.find(c => c.type === 'template_path');
        if (!templatePath || !templatePath.text) {
            return null;
        }

        const filters = [];
        for (const child of ast.children || []) {
            if (child.type === 'template_filter_call') {
                const filterNameNode = child.children?.find(c => c.type === 'template_filter_name');
                const filterName = filterNameNode?.text?.trim();
                if (filterName) {
                    const argsNode = child.children?.find(c => c.type === 'template_filter_args');
                    filters.push({
                        name: filterName,
                        args: VariableTemplate._extractFilterArgs(argsNode)
                    });
                }
            }
        }

        return {
            name: templatePath.text.trim(),
            filters
        };
    }

    static _cloneVarData(varData) {
        const cloned = Object.assign({}, varData);
        if (cloned.value && typeof cloned.value === 'object') {
            if (Array.isArray(cloned.value)) {
                cloned.value = cloned.value.slice();
            } else {
                cloned.value = Object.assign({}, cloned.value);
            }
        }

        return cloned;
    }

    static _extractFilterArgs(node) {
        if (!node || !Array.isArray(node.children)) {
            return [];
        }

        return node.children
            .filter(child => child.type === 'template_filter_arg')
            .map(child => VariableTemplate._extractFilterArgValue(child));
    }

    static _extractFilterArgValue(node) {
        if (!node || !Array.isArray(node.children) || node.children.length === 0) {
            return VariableTemplate._normalizeFilterArgText(node?.text?.trim() || '');
        }

        const child = node.children[0];
        if (!child) {
            return VariableTemplate._normalizeFilterArgText(node.text?.trim() || '');
        }

        if (child.type === 'value' && Array.isArray(child.children) && child.children.length > 0) {
            return VariableTemplate._extractFilterArgValue(child);
        }

        if (child.type === 'string') {
            try {
                return JSON.parse(child.text);
            } catch (error) {
                return VariableTemplate._normalizeFilterArgText(child.text);
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

        return VariableTemplate._normalizeFilterArgText(child.text?.trim() || node.text?.trim() || '');
    }

    static _normalizeFilterArgText(text) {
        const normalizedText = String(text).trim();

        if ((normalizedText.startsWith('"') && normalizedText.endsWith('"')) || (normalizedText.startsWith("'") && normalizedText.endsWith("'"))) {
            return normalizedText.slice(1, -1);
        }

        return normalizedText;
    }
}

module.exports = VariableTemplate;
