const { expect } = require('chai');
const RuleTemplate = require('../src/RuleTemplater');

describe('RuleTemplate', function() {
    describe('extractVariables()', function() {
        it('should extract variables from a template string', function() {
            const template = 'EventIs(${EVENT_TYPE}) && Value() > ${THRESHOLD}';
            const variables = RuleTemplate.extractVariables(template);
            
            expect(variables).to.have.property('EVENT_TYPE');
            expect(variables).to.have.property('THRESHOLD');
            expect(variables.EVENT_TYPE.name).to.equal('EVENT_TYPE');
            expect(variables.THRESHOLD.name).to.equal('THRESHOLD');
        });

        it('should handle multiple occurrences of the same variable', function() {
            const template = '${VALUE} > 10 && ${VALUE} < 20';
            const variables = RuleTemplate.extractVariables(template);
            
            expect(variables.VALUE.positions).to.have.length(2);
        });

        it('should return empty object for templates without variables', function() {
            const template = 'EventIs("test") && Value() > 10';
            const variables = RuleTemplate.extractVariables(template);
            
            expect(Object.keys(variables)).to.have.length(0);
        });
    });

    describe('prepare()', function() {
        it('should replace string variables with quoted values', function() {
            const template = 'EventIs(${EVENT_TYPE})';
            const result = RuleTemplate.prepare(template, {
                EVENT_TYPE: { value: 'test-event', type: 'string' }
            });
            
            expect(result).to.equal('EventIs("test-event")');
        });

        it('should replace number variables with numeric values', function() {
            const template = 'Value() > ${THRESHOLD}';
            const result = RuleTemplate.prepare(template, {
                THRESHOLD: { value: 42, type: 'number' }
            });
            
            expect(result).to.equal('Value() > 42');
        });

        it('should replace boolean variables', function() {
            const template = 'IsActive() == ${ENABLED}';
            const result = RuleTemplate.prepare(template, {
                ENABLED: { value: true, type: 'boolean' }
            });
            
            expect(result).to.equal('IsActive() == true');
        });

        it('should handle multiple variables', function() {
            const template = 'EventIs(${EVENT}) && Value() > ${MIN} && Value() < ${MAX}';
            const result = RuleTemplate.prepare(template, {
                EVENT: { value: 'sensor-update', type: 'string' },
                MIN: { value: 10, type: 'number' },
                MAX: { value: 100, type: 'number' }
            });
            
            expect(result).to.equal('EventIs("sensor-update") && Value() > 10 && Value() < 100');
        });

        it('should throw error for missing variables', function() {
            const template = 'EventIs(${EVENT_TYPE})';
            
            expect(() => {
                RuleTemplate.prepare(template, {});
            }).to.throw('Variable \'EVENT_TYPE\' not provided');
        });

        it('should throw error for invalid variable format', function() {
            const template = 'EventIs(${EVENT_TYPE})';
            
            expect(() => {
                RuleTemplate.prepare(template, {
                    EVENT_TYPE: 'just-a-string'
                });
            }).to.throw('must be an object with \'value\' property');
        });

        it('should handle the complex example from the issue', function() {
            const template = '!(EventIs(StrConcat("DeviceEvent:measurement:", ${ACTION})) && TimeLastTrueSet("last_measurement") || TimeLastTrueCheck("last_measurement") < ${TIME})';
            const result = RuleTemplate.prepare(template, {
                ACTION: { value: 'temperature', type: 'string' },
                TIME: { value: 60, type: 'number' }
            });
            
            expect(result).to.equal('!(EventIs(StrConcat("DeviceEvent:measurement:", "temperature")) && TimeLastTrueSet("last_measurement") || TimeLastTrueCheck("last_measurement") < 60)');
        });

        it('should properly escape quotes and backslashes in string values', function() {
            const template = 'EventIs(${EVENT})';
            const result = RuleTemplate.prepare(template, {
                EVENT: { value: 'test"value\\with\\slashes', type: 'string' }
            });
            
            expect(result).to.equal('EventIs("test\\"value\\\\with\\\\slashes")');
        });
    });

    describe('parse()', function() {
        it('should parse a prepared template successfully', function() {
            const template = '!(EventIs(StrConcat("DeviceEvent:measurement:", ${ACTION})) && TimeLastTrueSet("last_measurement") || TimeLastTrueCheck("last_measurement") < ${TIME})';
            const prepared = RuleTemplate.prepare(template, {
                ACTION: { value: 'temperature', type: 'string' },
                TIME: { value: 60, type: 'number' }
            });
            
            const ast = RuleTemplate.parse(prepared);
            expect(ast).to.have.property('type');
            expect(ast.type).to.equal('statement_main');
        });

        it('should parse simple rules', function() {
            const rule = 'EventIs("test")';
            const ast = RuleTemplate.parse(rule);
            
            expect(ast).to.have.property('type');
            expect(ast.type).to.equal('statement_main');
        });
    });

    describe('validateVariableNode()', function() {
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
});
