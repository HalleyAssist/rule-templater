const { expect } = require('chai');
const RuleTemplate = require('../src/RuleTemplater');

describe('RuleTemplate', function() {
    describe('parse() and extractVariables()', function() {
        it('should parse and extract variables from a template string', function() {
            const template = 'EventIs(${EVENT_TYPE}) && Value() > ${THRESHOLD}';
            const parsed = RuleTemplate.parse(template);
            const variables = parsed.extractVariables();
            
            expect(variables).to.be.an('array');
            expect(variables).to.have.length(2);
            
            const eventVar = variables.find(v => v.name === 'EVENT_TYPE');
            const thresholdVar = variables.find(v => v.name === 'THRESHOLD');
            
            expect(eventVar).to.exist;
            expect(eventVar.filters).to.be.an('array');
            expect(thresholdVar).to.exist;
            expect(thresholdVar.filters).to.be.an('array');
        });

        it('should handle templates without variables', function() {
            const template = 'EventIs("test") && Value() > 10';
            const parsed = RuleTemplate.parse(template);
            const variables = parsed.extractVariables();
            
            expect(variables).to.be.an('array');
            expect(variables).to.have.length(0);
        });

        it('should extract filters from template variables', function() {
            const template = 'EventIs(${EVENT_TYPE|upper}) && Value() > ${THRESHOLD}';
            const parsed = RuleTemplate.parse(template);
            const variables = parsed.extractVariables();
            
            const eventVar = variables.find(v => v.name === 'EVENT_TYPE');
            expect(eventVar).to.exist;
            expect(eventVar.filters).to.include('upper');
        });
    });

    describe('prepare()', function() {
        it('should replace string variables with quoted values', function() {
            const template = 'EventIs(${EVENT_TYPE})';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                EVENT_TYPE: { value: 'test-event', type: 'string' }
            });
            
            expect(result).to.equal('EventIs("test-event")');
        });

        it('should replace number variables with numeric values', function() {
            const template = 'Value() > ${THRESHOLD}';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                THRESHOLD: { value: 42, type: 'number' }
            });
            
            expect(result).to.equal('Value() > 42');
        });

        it('should replace boolean variables', function() {
            const template = 'IsActive() == ${ENABLED}';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                ENABLED: { value: true, type: 'boolean' }
            });
            
            expect(result).to.equal('IsActive() == true');
        });

        it('should handle multiple variables', function() {
            const template = 'EventIs(${EVENT}) && Value() > ${MIN} && Value() < ${MAX}';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                EVENT: { value: 'sensor-update', type: 'string' },
                MIN: { value: 10, type: 'number' },
                MAX: { value: 100, type: 'number' }
            });
            
            expect(result).to.equal('EventIs("sensor-update") && Value() > 10 && Value() < 100');
        });

        it('should throw error for missing variables', function() {
            const template = 'EventIs(${EVENT_TYPE})';
            const parsed = RuleTemplate.parse(template);
            
            expect(() => {
                parsed.prepare({});
            }).to.throw('Variable \'EVENT_TYPE\' not provided');
        });

        it('should throw error for invalid variable format', function() {
            const template = 'EventIs(${EVENT_TYPE})';
            const parsed = RuleTemplate.parse(template);
            
            expect(() => {
                parsed.prepare({
                    EVENT_TYPE: 'just-a-string'
                });
            }).to.throw('must be an object with \'value\' property');
        });

        it('should handle the complex example from the issue', function() {
            const template = '!(EventIs(StrConcat("DeviceEvent:measurement:", ${ACTION})) && TimeLastTrueSet("last_measurement") || TimeLastTrueCheck("last_measurement") < ${TIME})';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                ACTION: { value: 'temperature', type: 'string' },
                TIME: { value: 60, type: 'number' }
            });
            
            expect(result).to.equal('!(EventIs(StrConcat("DeviceEvent:measurement:", "temperature")) && TimeLastTrueSet("last_measurement") || TimeLastTrueCheck("last_measurement") < 60)');
        });

        it('should properly escape quotes and backslashes in string values', function() {
            const template = 'EventIs(${EVENT})';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                EVENT: { value: 'test"value\\with\\slashes', type: 'string' }
            });
            
            expect(result).to.equal('EventIs("test\\"value\\\\with\\\\slashes")');
        });
    });

    describe('validate()', function() {
        it('should validate provided variables', function() {
            const template = 'EventIs(${EVENT_TYPE}) && Value() > ${THRESHOLD}';
            const parsed = RuleTemplate.parse(template);
            
            const result = parsed.validate({
                EVENT_TYPE: { value: 'test', type: 'string' },
                THRESHOLD: { value: 42, type: 'number' }
            });
            
            expect(result.valid).to.be.true;
            expect(result.errors).to.be.an('array').that.is.empty;
        });

        it('should detect missing variables', function() {
            const template = 'EventIs(${EVENT_TYPE}) && Value() > ${THRESHOLD}';
            const parsed = RuleTemplate.parse(template);
            
            const result = parsed.validate({
                EVENT_TYPE: { value: 'test', type: 'string' }
            });
            
            expect(result.valid).to.be.false;
            expect(result.errors).to.have.length(1);
            expect(result.errors[0]).to.include('THRESHOLD');
        });

        it('should detect invalid variable types', function() {
            const template = 'EventIs(${EVENT_TYPE})';
            const parsed = RuleTemplate.parse(template);
            
            const result = parsed.validate({
                EVENT_TYPE: { value: 'test', type: 'invalid_type' }
            });
            
            expect(result.valid).to.be.false;
            expect(result.errors).to.have.length(1);
            expect(result.errors[0]).to.include('Invalid variable type');
        });

        it('should handle templates without variables', function() {
            const template = 'EventIs("test")';
            const parsed = RuleTemplate.parse(template);
            
            const result = parsed.validate({});
            
            expect(result.valid).to.be.true;
            expect(result.errors).to.be.an('array').that.is.empty;
        });
    });

    describe('parse() - instance methods', function() {
        it('should return a RuleTemplate instance', function() {
            const template = 'EventIs(${EVENT_TYPE})';
            const parsed = RuleTemplate.parse(template);
            
            expect(parsed).to.be.instanceOf(RuleTemplate);
            expect(parsed).to.have.property('ruleTemplateText');
            expect(parsed).to.have.property('ast');
            expect(parsed.ruleTemplateText).to.equal(template);
        });

        it('should parse simple rules without variables', function() {
            const rule = 'EventIs("test")';
            const parsed = RuleTemplate.parse(rule);
            
            expect(parsed).to.be.instanceOf(RuleTemplate);
            expect(parsed.ast).to.have.property('type');
            expect(parsed.ast.type).to.equal('statement_main');
        });
    });

    describe('validateVariableNode() - static helper', function() {
        it('should validate string types', function() {
            const validNode = { type: 'string_atom' };
            const result = RuleTemplate.validateVariableNode(validNode, 'string');
            expect(result).to.be.true;
        });

        it('should validate number types', function() {
            const validNode = { type: 'number_atom' };
            const result = RuleTemplate.validateVariableNode(validNode, 'number');
            expect(result).to.be.true;
        });

        it('should reject invalid type combinations', function() {
            const stringNode = { type: 'string_atom' };
            const result = RuleTemplate.validateVariableNode(stringNode, 'number');
            expect(result).to.be.false;
        });

        it('should return false for invalid variable type', function() {
            const node = { type: 'string_atom' };
            const result = RuleTemplate.validateVariableNode(node, 'invalid_type');
            expect(result).to.be.false;
        });

        it('should return false for null or undefined nodes', function() {
            expect(RuleTemplate.validateVariableNode(null, 'string')).to.be.false;
            expect(RuleTemplate.validateVariableNode(undefined, 'string')).to.be.false;
        });
    });

    describe('Template filters', function() {
        it('should apply string filter', function() {
            const template = 'EventIs(${EVENT|string})';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                EVENT: { value: 'test-event' }
            });
            
            expect(result).to.equal('EventIs("test-event")');
        });

        it('should apply upper filter', function() {
            const template = 'EventIs(${EVENT|upper})';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                EVENT: { value: 'test-event' }
            });
            
            expect(result).to.equal('EventIs(TEST-EVENT)');
        });

        it('should apply lower filter', function() {
            const template = 'EventIs(${EVENT|lower})';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                EVENT: { value: 'TEST-EVENT' }
            });
            
            expect(result).to.equal('EventIs(test-event)');
        });

        it('should apply capitalize filter', function() {
            const template = 'EventIs(${EVENT|capitalize})';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                EVENT: { value: 'test event' }
            });
            
            expect(result).to.equal('EventIs(Test event)');
        });

        it('should apply title filter', function() {
            const template = 'EventIs(${EVENT|title})';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                EVENT: { value: 'test event name' }
            });
            
            expect(result).to.equal('EventIs(Test Event Name)');
        });

        it('should apply trim filter', function() {
            const template = 'EventIs(${EVENT|trim})';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                EVENT: { value: '  test-event  ' }
            });
            
            expect(result).to.equal('EventIs(test-event)');
        });

        it('should apply number filter', function() {
            const template = 'Value() > ${THRESHOLD|number}';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                THRESHOLD: { value: '42' }
            });
            
            expect(result).to.equal('Value() > 42');
        });

        it('should apply abs filter', function() {
            const template = 'Value() > ${THRESHOLD|abs}';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                THRESHOLD: { value: -42 }
            });
            
            expect(result).to.equal('Value() > 42');
        });

        it('should apply round filter', function() {
            const template = 'Value() > ${THRESHOLD|round}';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                THRESHOLD: { value: 42.7 }
            });
            
            expect(result).to.equal('Value() > 43');
        });

        it('should apply floor filter', function() {
            const template = 'Value() > ${THRESHOLD|floor}';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                THRESHOLD: { value: 42.9 }
            });
            
            expect(result).to.equal('Value() > 42');
        });

        it('should apply ceil filter', function() {
            const template = 'Value() > ${THRESHOLD|ceil}';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                THRESHOLD: { value: 42.1 }
            });
            
            expect(result).to.equal('Value() > 43');
        });

        it('should apply multiple filters in sequence', function() {
            const template = 'EventIs(${EVENT|trim|upper})';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                EVENT: { value: '  test-event  ' }
            });
            
            expect(result).to.equal('EventIs(TEST-EVENT)');
        });

        it('should combine filters with type conversion', function() {
            const template = 'EventIs(${EVENT|upper|string})';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                EVENT: { value: 'test' }
            });
            
            expect(result).to.equal('EventIs("TEST")');
        });

        it('should throw error for unknown filter', function() {
            const template = 'EventIs(${EVENT|unknown_filter})';
            const parsed = RuleTemplate.parse(template);
            
            expect(() => {
                parsed.prepare({
                    EVENT: { value: 'test' }
                });
            }).to.throw('Unknown filter \'unknown_filter\'');
        });

        it('should work with filters in complex expressions', function() {
            const template = 'EventIs(StrConcat("prefix:", ${ACTION|upper})) && Value() > ${TIME|abs}';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                ACTION: { value: 'temperature' },
                TIME: { value: -60 }
            });
            
            expect(result).to.equal('EventIs(StrConcat("prefix:", TEMPERATURE)) && Value() > 60');
        });
    });
});
