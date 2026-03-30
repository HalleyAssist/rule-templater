const { expect } = require('chai');
const { VariableValidate, RuleTemplate } = require('../index');

describe('VariableValidate', function() {
    const validCases = [
        ['string', 'hello'],
        ['number', 42],
        ['boolean', true],
        ['object', { source: 'sensor', count: 2, active: false }],
        ['time value', '08:30'],
        ['time period', { from: '08:00', to: '12:00' }],
        ['time period ago', { from: '08:00', to: '12:00', ago: [2, 'HOURS'] }],
        ['number time', '15 minutes'],
        ['string array', ['alpha', 'beta']],
        ['number array', [1, 2, 3]],
        ['boolean array', [true, false]],
        ['object array', [{ id: 1 }, { id: 2, tags: ['a'] }]]
    ];

    for (const [type, value] of validCases) {
        it(`accepts valid ${type} values`, function() {
            const result = VariableValidate.validateValue(type, value);
            expect(result).to.deep.equal({ valid: true });
        });
    }

    it('rejects unsupported variable types', function() {
        const result = VariableValidate.validateValue('made up', 'x');
        expect(result.valid).to.equal(false);
        expect(result.error).to.include('Unsupported variable type');
    });

    it('rejects invalid time values', function() {
        const result = VariableValidate.validateValue('time value', '25:61');
        expect(result.valid).to.equal(false);
        expect(result.error).to.include('hours 0-23');
    });

    it('rejects malformed time period ago values', function() {
        const result = VariableValidate.validateValue('time period ago', {
            from: '08:00',
            to: '12:00',
            ago: ['two', 'HOURS']
        });

        expect(result.valid).to.equal(false);
        expect(result.error).to.include('from, to, and ago');
    });

    it('rejects non-json object values', function() {
        const result = VariableValidate.validateValue('object', {
            nested: undefined
        });

        expect(result.valid).to.equal(false);
        expect(result.error).to.include('JSON-compatible');
    });

    it('validates complete variable data objects', function() {
        const result = VariableValidate.validate({
            value: ['alpha', 'beta'],
            type: 'string array'
        });

        expect(result).to.deep.equal({ valid: true });
    });

    it('applies filters from variable data before validation', function() {
        const result = VariableValidate.validate({
            value: { from: '08:00', to: '12:00' },
            type: 'time period',
            filters: ['time_start']
        });

        expect(result).to.deep.equal({ valid: true });
    });

    it('supports type-changing filters from variable data', function() {
        const result = VariableValidate.validate({
            value: '42',
            type: 'string',
            filters: ['number']
        });

        expect(result).to.deep.equal({ valid: true });
    });

    it('rejects unknown filters from variable data', function() {
        const result = VariableValidate.validate({
            value: 'hello',
            type: 'string',
            filters: ['missing_filter']
        });

        expect(result.valid).to.equal(false);
        expect(result.error).to.include('Unknown filter');
    });

    it('rejects non-array filter lists', function() {
        const result = VariableValidate.validate({
            value: 'hello',
            type: 'string',
            filters: 'upper'
        });

        expect(result.valid).to.equal(false);
        expect(result.error).to.include('filters must be an array');
    });

    it('does not mutate original variable data when filters are applied', function() {
        const variableData = {
            value: '  hello  ',
            type: 'string',
            filters: ['trim', 'upper']
        };

        const result = VariableValidate.validate(variableData);

        expect(result).to.deep.equal({ valid: true });
        expect(variableData).to.deep.equal({
            value: '  hello  ',
            type: 'string',
            filters: ['trim', 'upper']
        });
    });

    it('rejects missing type metadata', function() {
        const result = VariableValidate.validate({ value: 'hello' });
        expect(result.valid).to.equal(false);
        expect(result.error).to.include('type property');
    });
});

describe('RuleTemplate with VariableValidate', function() {
    it('reports invalid typed values during validate()', function() {
        const parsed = RuleTemplate.parse('Between(${WINDOW})');
        const result = parsed.validate({
            WINDOW: { value: { from: '99:00', to: '12:00' }, type: 'time period' }
        });

        expect(result.valid).to.equal(false);
        expect(result.errors[0]).to.include('Invalid value for variable');
    });

    it('serializes direct array and object variable values', function() {
        const parsed = RuleTemplate.parse('Value() IN (${VALUES}) && Context() == ${META}');
        const result = parsed.prepare({
            VALUES: { value: ['one', 'two'], type: 'string array' },
            META: { value: { source: 'sensor' }, type: 'object' }
        });

        expect(result).to.equal('Value() IN (["one","two"]) && Context() == {"source":"sensor"}');
    });
});