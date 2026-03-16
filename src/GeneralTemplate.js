const TemplateFilters = require('./TemplateFilters');

class GeneralTemplate {
    constructor(templateText) {
        this.templateText = templateText;
    }

    static parse(templateText) {
        return new GeneralTemplate(templateText);
    }

    static getVariables(templateText) {
        return GeneralTemplate.parse(templateText).getVariables();
    }

    getVariables() {
        const variables = [];
        const variableMap = new Map();
        const pattern = /\$\{([^}]*)\}/g;
        
        for (const match of this.templateText.matchAll(pattern)) {
            const parsedExpression = this._parseTemplateExpression(match[1]);
            if (parsedExpression) {
                if (variableMap.has(parsedExpression.name)) {
                    const existing = variableMap.get(parsedExpression.name);
                    existing.positions.push({
                        start: match.index,
                        end: match.index + match[0].length
                    });
                    existing.filters = Array.from(new Set(existing.filters.concat(parsedExpression.filters)));
                } else {
                    variableMap.set(parsedExpression.name, {
                        name: parsedExpression.name,
                        filters: parsedExpression.filters,
                        positions: [{
                            start: match.index,
                            end: match.index + match[0].length
                        }]
                    });
                }
            }
        }

        for (const variable of variableMap.values()) {
            variables.push(variable);
        }

        return variables;
    }

    extractVariables() {
        return this.getVariables();
    }

    prepare(variables) {
        if (!variables || typeof variables !== 'object') {
            throw new Error('Variables must be provided as an object');
        }

        return this.templateText.replace(/\$\{([^}]*)\}/g, (matchText, expression) => {
            const parsedExpression = this._parseTemplateExpression(expression);
            if (!parsedExpression) {
                return matchText;
            }

            const varName = parsedExpression.name;
            if (!Object.prototype.hasOwnProperty.call(variables, varName)) {
                throw new Error(`Variable '${varName}' not provided in variables object`);
            }

            let varData = variables[varName];
            if (typeof varData !== 'object' || !Object.prototype.hasOwnProperty.call(varData, 'value')) {
                throw new Error(`Variable '${varName}' must be an object with 'value' property`);
            }

            varData = Object.assign({}, varData);

            if (parsedExpression.filters && parsedExpression.filters.length > 0) {
                for (const filterName of parsedExpression.filters) {
                    if (!TemplateFilters[filterName]) {
                        throw new Error(`Unknown filter '${filterName}'`);
                    }

                    TemplateFilters[filterName](varData);
                }
            }

            return this._serializeVariable(varData);
        });
    }

    _parseTemplateExpression(expression) {
        if (!expression) {
            return null;
        }

        const segments = expression.split('|').map(s => s.trim()).filter(Boolean);
        if (segments.length === 0) {
            return null;
        }

        return {
            name: segments[0],
            filters: segments.slice(1)
        };
    }

    _serializeVariable(varData) {
        if (varData.value === null || varData.value === undefined) {
            return '';
        }

        if (varData.type === 'time period' || varData.type === 'time period ago') {
            let ret = `${varData.value.from} TO ${varData.value.to}`;
            if (varData.value.ago) {
                ret += ` AGO ${varData.value.ago[0]} ${varData.value.ago[1]}`;
            }
            return ret;
        }

        return String(varData.value);
    }
}

module.exports = GeneralTemplate;
