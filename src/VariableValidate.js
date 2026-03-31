const { Parser } = require('ebnf');
const TemplateGrammar = require('./RuleTemplate.ebnf');
const TemplateFilters = require('./TemplateFilters');
const RuleParser = require('@halleyassist/rule-parser');
const RuleParserRules = RuleParser.ParserRules;

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
];

let ParserCache = null;

const ValidationRules = [...RuleParserRules];
for (const rule of TemplateGrammar) {
    const idx = ValidationRules.findIndex(existingRule => existingRule.name === rule.name);
    if (idx !== -1) {
        ValidationRules[idx] = rule;
    } else {
        ValidationRules.push(rule);
    }
}

class VariableValidate {
    static validate(variableData) {
        if (!variableData || typeof variableData !== 'object' || Array.isArray(variableData)) {
            return {
                valid: false,
                error: 'Variable data must be an object with value and type properties'
            };
        }

        if (!Object.prototype.hasOwnProperty.call(variableData, 'type')) {
            return {
                valid: false,
                error: 'Variable data must include a type property'
            };
        }

        let normalizedVarData;
        try {
            normalizedVarData = VariableValidate._normalizeVarData(variableData);
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }

        return VariableValidate.validateValue(normalizedVarData.type, normalizedVarData.value);
    }

    static validateValue(type, value) {
        const validator = VariableValidate.validators[type];
        if (!validator) {
            return {
                valid: false,
                error: `Unsupported variable type '${type}'`
            };
        }

        try {
            return validator(value);
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }

    static isValid(type, value) {
        return VariableValidate.validateValue(type, value).valid;
    }

    static _validateWithRule(value, startRule, options = {}) {
        const parser = VariableValidate._getParser();
        const normalized = options.normalize ? options.normalize(value) : value;

        if (typeof normalized !== 'string' || !normalized.length) {
            return {
                valid: false,
                error: options.emptyMessage || `Expected ${startRule} input`
            };
        }

        try {
            parser.getAST(normalized, startRule);
        } catch (error) {
            return {
                valid: false,
                error: options.parseMessage || error.message
            };
        }

        if (options.semanticCheck) {
            const semanticError = options.semanticCheck(value, normalized);
            if (semanticError) {
                return {
                    valid: false,
                    error: semanticError
                };
            }
        }

        return { valid: true };
    }

    static _getParser() {
        if (!ParserCache) {
            ParserCache = new Parser(ValidationRules, { debug: false });
        }

        return ParserCache;
    }

    static _normalizeVarData(variableData) {
        const normalizedVarData = VariableValidate._cloneVarData(variableData);

        if (!Object.prototype.hasOwnProperty.call(normalizedVarData, 'value')) {
            throw new Error('Variable data must include a value property');
        }

        if (!Object.prototype.hasOwnProperty.call(normalizedVarData, 'filters')) {
            return normalizedVarData;
        }

        if (!Array.isArray(normalizedVarData.filters)) {
            throw new Error('Variable data filters must be an array');
        }

        for (const filter of normalizedVarData.filters) {
            const filterName = typeof filter === 'string' ? filter : filter?.name;
            const filterArgs = typeof filter === 'string' ? [] : (Array.isArray(filter?.args) ? filter.args : []);

            if (!filterName || !TemplateFilters[filterName]) {
                throw new Error(`Unknown filter '${filterName || filter}'`);
            }

            TemplateFilters[filterName](normalizedVarData, ...filterArgs);
        }

        return normalizedVarData;
    }

    static _cloneVarData(variableData) {
        const cloned = Object.assign({}, variableData);
        if (Array.isArray(cloned.filters)) {
            cloned.filters = cloned.filters.slice();
        }

        if (cloned.value && typeof cloned.value === 'object') {
            if (Array.isArray(cloned.value)) {
                cloned.value = cloned.value.slice();
            } else {
                cloned.value = Object.assign({}, cloned.value);
            }
        }

        return cloned;
    }

    static _serializeString(value) {
        if (typeof value !== 'string') {
            return null;
        }

        return JSON.stringify(value);
    }

    static _serializeNumber(value) {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            return null;
        }

        return String(value);
    }

    static _serializeBoolean(value) {
        if (typeof value !== 'boolean') {
            return null;
        }

        return value ? 'true' : 'false';
    }

    static _serializeTimeValue(value) {
        if (typeof value !== 'string') {
            return null;
        }

        return value.trim();
    }

    static _serializeTimePeriod(value) {
        if (!VariableValidate._isPlainObject(value) || typeof value.from !== 'string' || typeof value.to !== 'string') {
            return null;
        }

        return `BETWEEN ${value.from.trim()} AND ${value.to.trim()}`;
    }

    static _serializeTimePeriodAgo(value) {
        if (!VariableValidate._isPlainObject(value) || typeof value.from !== 'string' || typeof value.to !== 'string') {
            return null;
        }

        if (!Array.isArray(value.ago) || value.ago.length !== 2) {
            return null;
        }

        const [amount, unit] = value.ago;
        if (typeof amount !== 'number' || !Number.isFinite(amount) || typeof unit !== 'string') {
            return null;
        }

        return `${amount} ${unit.trim()} AGO BETWEEN ${value.from.trim()} AND ${value.to.trim()}`;
    }

    static _serializeNumberTime(value) {
        if (typeof value !== 'string') {
            return null;
        }

        return value.trim();
    }

    static _serializeJsonObject(value) {
        if (!VariableValidate._isJsonObject(value)) {
            return null;
        }

        return JSON.stringify(value);
    }

    static _serializeTypedArray(value, predicate) {
        if (!Array.isArray(value) || !value.every(predicate)) {
            return null;
        }

        return JSON.stringify(value);
    }

    static _serializeObjectArray(value) {
        if (!Array.isArray(value) || !value.every(item => VariableValidate._isJsonObject(item))) {
            return null;
        }

        return JSON.stringify(value);
    }

    static _isPlainObject(value) {
        return !!value && typeof value === 'object' && !Array.isArray(value);
    }

    static _isJsonObject(value) {
        if (!VariableValidate._isPlainObject(value)) {
            return false;
        }

        return Object.values(value).every(entry => VariableValidate._isJsonValue(entry));
    }

    static _isJsonValue(value) {
        if (value === null) {
            return true;
        }

        if (typeof value === 'string' || typeof value === 'boolean') {
            return true;
        }

        if (typeof value === 'number') {
            return Number.isFinite(value);
        }

        if (Array.isArray(value)) {
            return value.every(entry => VariableValidate._isJsonValue(entry));
        }

        if (VariableValidate._isPlainObject(value)) {
            return Object.values(value).every(entry => VariableValidate._isJsonValue(entry));
        }

        return false;
    }

    static _validateTimeOfDay(value) {
        if (typeof value !== 'string') {
            return 'Time value must be a string in HH:MM format';
        }

        const match = value.trim().match(/^(\d{1,2}):(\d{1,2})$/);
        if (!match) {
            return 'Time value must be a string in HH:MM format';
        }

        const hours = Number(match[1]);
        const minutes = Number(match[2]);

        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            return 'Time value must contain hours 0-23 and minutes 0-59';
        }

        return null;
    }
}

VariableValidate.VariableTypes = VariableTypes.slice();
VariableValidate.validators = Object.freeze({
    'string': (value) => VariableValidate._validateWithRule(value, 'string_atom', {
        normalize: VariableValidate._serializeString,
        emptyMessage: 'String variables must be JavaScript strings',
        parseMessage: 'String variables must serialize to a valid quoted string literal'
    }),
    'number': (value) => VariableValidate._validateWithRule(value, 'number', {
        normalize: VariableValidate._serializeNumber,
        emptyMessage: 'Number variables must be finite numbers',
        parseMessage: 'Number variables must serialize to a valid numeric literal'
    }),
    'boolean': (value) => VariableValidate._validateWithRule(value, 'boolean_atom', {
        normalize: VariableValidate._serializeBoolean,
        emptyMessage: 'Boolean variables must be JavaScript booleans',
        parseMessage: 'Boolean variables must serialize to a valid boolean literal'
    }),
    'object': (value) => VariableValidate._validateWithRule(value, 'object_atom', {
        normalize: VariableValidate._serializeJsonObject,
        emptyMessage: 'Object variables must be plain JSON-compatible objects',
        parseMessage: 'Object variables must serialize to valid JSON object syntax'
    }),
    'time period': (value) => VariableValidate._validateWithRule(value, 'time_period_atom', {
        normalize: VariableValidate._serializeTimePeriod,
        emptyMessage: 'Time period variables must be objects with string from/to properties',
        parseMessage: 'Time period variables must serialize to BETWEEN FROM AND TO syntax',
        semanticCheck: (rawValue) => {
            const fromError = VariableValidate._validateTimeOfDay(rawValue?.from);
            if (fromError) return `Invalid time period from value: ${fromError}`;

            const toError = VariableValidate._validateTimeOfDay(rawValue?.to);
            if (toError) return `Invalid time period to value: ${toError}`;

            return null;
        }
    }),
    'time period ago': (value) => VariableValidate._validateWithRule(value, 'time_period_ago_atom', {
        normalize: VariableValidate._serializeTimePeriodAgo,
        emptyMessage: 'Time period ago variables must be objects with from, to, and ago properties',
        parseMessage: 'Time period ago variables must serialize to AMOUNT UNIT AGO BETWEEN FROM AND TO syntax',
        semanticCheck: (rawValue) => {
            const fromError = VariableValidate._validateTimeOfDay(rawValue?.from);
            if (fromError) return `Invalid time period ago from value: ${fromError}`;

            const toError = VariableValidate._validateTimeOfDay(rawValue?.to);
            if (toError) return `Invalid time period ago to value: ${toError}`;

            return null;
        }
    }),
    'time value': (value) => VariableValidate._validateWithRule(value, 'time_value_atom', {
        normalize: VariableValidate._serializeTimeValue,
        emptyMessage: 'Time value variables must be strings in HH:MM format',
        parseMessage: 'Time value variables must serialize to HH:MM syntax',
        semanticCheck: (rawValue) => VariableValidate._validateTimeOfDay(rawValue)
    }),
    'number time': (value) => VariableValidate._validateWithRule(value, 'number_time', {
        normalize: VariableValidate._serializeNumberTime,
        emptyMessage: 'Number time variables must be strings like "2 hours"',
        parseMessage: 'Number time variables must serialize to NUMBER UNIT syntax'
    }),
    'string array': (value) => VariableValidate._validateWithRule(value, 'string_array', {
        normalize: (rawValue) => VariableValidate._serializeTypedArray(rawValue, item => typeof item === 'string'),
        emptyMessage: 'String array variables must be arrays of strings',
        parseMessage: 'String array variables must serialize to a valid string array literal'
    }),
    'number array': (value) => VariableValidate._validateWithRule(value, 'number_array', {
        normalize: (rawValue) => VariableValidate._serializeTypedArray(rawValue, item => typeof item === 'number' && Number.isFinite(item)),
        emptyMessage: 'Number array variables must be arrays of finite numbers',
        parseMessage: 'Number array variables must serialize to a valid number array literal'
    }),
    'boolean array': (value) => VariableValidate._validateWithRule(value, 'boolean_array', {
        normalize: (rawValue) => VariableValidate._serializeTypedArray(rawValue, item => typeof item === 'boolean'),
        emptyMessage: 'Boolean array variables must be arrays of booleans',
        parseMessage: 'Boolean array variables must serialize to a valid boolean array literal'
    }),
    'object array': (value) => VariableValidate._validateWithRule(value, 'object_array', {
        normalize: VariableValidate._serializeObjectArray,
        emptyMessage: 'Object array variables must be arrays of plain JSON-compatible objects',
        parseMessage: 'Object array variables must serialize to a valid object array literal'
    })
});

module.exports = VariableValidate;