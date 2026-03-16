const { expect } = require('chai');
const RuleTemplate = require('../src/RuleTemplater');
const { GeneralTemplate } = RuleTemplate;

describe('GeneralTemplate', function() {
    describe('getVariables()', function() {
        it('should extract variables and filters from a general template string', function() {
            const template = 'If a door is opened between ${ALERT_PERIOD | time_start} AND ${ALERT_PERIOD | time_end}';
            const variables = GeneralTemplate.getVariables(template);

            expect(variables).to.be.an('array');
            expect(variables).to.have.length(1);
            expect(variables[0].name).to.equal('ALERT_PERIOD');
            expect(variables[0].filters).to.deep.equal(['time_start', 'time_end']);
            expect(variables[0].positions).to.have.length(2);
        });

        it('should extract multiple variables and preserve first-seen order', function() {
            const template = 'Hello ${NAME|trim}, count ${COUNT} and status ${ACTIVE|boolean}';
            const variables = GeneralTemplate.getVariables(template);

            expect(variables.map(v => v.name)).to.deep.equal(['NAME', 'COUNT', 'ACTIVE']);
            expect(variables.find(v => v.name === 'NAME').filters).to.deep.equal(['trim']);
            expect(variables.find(v => v.name === 'COUNT').filters).to.deep.equal([]);
            expect(variables.find(v => v.name === 'ACTIVE').filters).to.deep.equal(['boolean']);
        });
    });

    describe('extractVariables()', function() {
        it('should provide alias behavior matching getVariables', function() {
            const template = 'Value: ${VALUE|number}';
            const parsed = GeneralTemplate.parse(template);

            expect(parsed.extractVariables()).to.deep.equal(parsed.getVariables());
        });
    });

    describe('prepare()', function() {
        it('should prepare a general template string with filters', function() {
            const template = 'If a door is opened between ${ALERT_PERIOD | time_start} AND ${ALERT_PERIOD | time_end}';
            const parsed = GeneralTemplate.parse(template);
            const result = parsed.prepare({
                ALERT_PERIOD: {
                    value: { from: '08:00', to: '12:00' },
                    type: 'time period'
                }
            });

            expect(result).to.equal('If a door is opened between 08:00 AND 12:00');
        });

        it('should throw for unknown filters', function() {
            const template = 'Status: ${STATUS|nope}';
            const parsed = GeneralTemplate.parse(template);

            expect(() => {
                parsed.prepare({ STATUS: { value: 'ok', type: 'string' } });
            }).to.throw('Unknown filter');
        });
    });
});
