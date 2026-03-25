const { expect } = require('chai');
const { VariableTemplate } = require('../index');

describe('VariableTemplate', function() {
    describe('parse()', function() {
        it('should parse a raw template_expr and extract the variable and filters', function() {
            const parsed = VariableTemplate.parse('ALERT_PERIOD|time_start|upper');
            const variable = parsed.extractVariable();

            expect(variable).to.deep.equal({
                name: 'ALERT_PERIOD',
                filters: ['time_start', 'upper']
            });
        });

        it('should parse a wrapped template expression', function() {
            const parsed = VariableTemplate.parse('${ NAME | trim }');
            const variable = parsed.extractVariable();

            expect(variable).to.deep.equal({
                name: 'NAME',
                filters: ['trim']
            });
        });
    });

    describe('format()', function() {
        it('should return variable data with filters applied', function() {
            const parsed = VariableTemplate.parse('ALERT_PERIOD|time_start|upper');
            const result = parsed.format({
                ALERT_PERIOD: {
                    value: { from: '08:00', to: '12:00' },
                    type: 'time period'
                }
            });

            expect(result).to.deep.equal({
                value: '08:00',
                type: 'string'
            });
        });

        it('should support direct varData objects', function() {
            const parsed = VariableTemplate.parse('NAME|trim|upper');
            const result = parsed.format({
                value: '  alice  ',
                type: 'string'
            });

            expect(result).to.deep.equal({
                value: 'ALICE',
                type: 'string'
            });
        });

        it('should throw for unknown filters', function() {
            const parsed = VariableTemplate.parse('NAME|unknown_filter');

            expect(() => {
                parsed.format({ value: 'ok', type: 'string' });
            }).to.throw('Unknown filter');
        });
    });
});
