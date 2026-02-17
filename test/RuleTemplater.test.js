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

        it('should throw error when type property is missing', function() {
            const template = 'EventIs(${EVENT_TYPE})';
            const parsed = RuleTemplate.parse(template);
            
            expect(() => {
                parsed.prepare({
                    EVENT_TYPE: { value: 'test' }
                });
            }).to.throw('must have a \'type\' property');
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

        it('should handle multiple occurrences of the same variable', function() {
            const template = 'EventIs(${ACTION}) && OtherEvent(${ACTION})';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                ACTION: { value: 'test', type: 'string' }
            });
            
            expect(result).to.equal('EventIs("test") && OtherEvent("test")');
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
                EVENT: { value: 'test-event', type: 'string' }
            });
            
            expect(result).to.equal('EventIs("test-event")');
        });

        it('should apply upper filter', function() {
            const template = 'EventIs(${EVENT|upper})';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                EVENT: { value: 'test-event', type: 'string' }
            });
            
            expect(result).to.equal('EventIs(TEST-EVENT)');
        });

        it('should apply lower filter', function() {
            const template = 'EventIs(${EVENT|lower})';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                EVENT: { value: 'TEST-EVENT', type: 'string' }
            });
            
            expect(result).to.equal('EventIs(test-event)');
        });

        it('should apply capitalize filter', function() {
            const template = 'EventIs(${EVENT|capitalize})';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                EVENT: { value: 'test event', type: 'string' }
            });
            
            expect(result).to.equal('EventIs(Test event)');
        });

        it('should apply title filter', function() {
            const template = 'EventIs(${EVENT|title})';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                EVENT: { value: 'test event name', type: 'string' }
            });
            
            expect(result).to.equal('EventIs(Test Event Name)');
        });

        it('should apply trim filter', function() {
            const template = 'EventIs(${EVENT|trim})';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                EVENT: { value: '  test-event  ', type: 'string' }
            });
            
            expect(result).to.equal('EventIs(test-event)');
        });

        it('should apply number filter', function() {
            const template = 'Value() > ${THRESHOLD|number}';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                THRESHOLD: { value: '42', type: 'string' }
            });
            
            expect(result).to.equal('Value() > 42');
        });

        it('should apply abs filter', function() {
            const template = 'Value() > ${THRESHOLD|abs}';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                THRESHOLD: { value: -42, type: 'number' }
            });
            
            expect(result).to.equal('Value() > 42');
        });

        it('should apply round filter', function() {
            const template = 'Value() > ${THRESHOLD|round}';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                THRESHOLD: { value: 42.7, type: 'number' }
            });
            
            expect(result).to.equal('Value() > 43');
        });

        it('should apply floor filter', function() {
            const template = 'Value() > ${THRESHOLD|floor}';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                THRESHOLD: { value: 42.9, type: 'number' }
            });
            
            expect(result).to.equal('Value() > 42');
        });

        it('should apply ceil filter', function() {
            const template = 'Value() > ${THRESHOLD|ceil}';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                THRESHOLD: { value: 42.1, type: 'number' }
            });
            
            expect(result).to.equal('Value() > 43');
        });

        it('should apply multiple filters in sequence', function() {
            const template = 'EventIs(${EVENT|trim|upper})';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                EVENT: { value: '  test-event  ', type: 'string' }
            });
            
            expect(result).to.equal('EventIs(TEST-EVENT)');
        });

        it('should combine filters with type conversion', function() {
            const template = 'EventIs(${EVENT|upper|string})';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                EVENT: { value: 'test', type: 'string' }
            });
            
            expect(result).to.equal('EventIs("TEST")');
        });

        it('should throw error for unknown filter', function() {
            const template = 'EventIs(${EVENT|unknown_filter})';
            const parsed = RuleTemplate.parse(template);
            
            expect(() => {
                parsed.prepare({
                    EVENT: { value: 'test', type: 'string' }
                });
            }).to.throw('Unknown filter \'unknown_filter\'');
        });

        it('should work with filters in complex expressions', function() {
            const template = 'EventIs(StrConcat("prefix:", ${ACTION|upper})) && Value() > ${TIME|abs}';
            const parsed = RuleTemplate.parse(template);
            const result = parsed.prepare({
                ACTION: { value: 'temperature', type: 'string' },
                TIME: { value: -60, type: 'number' }
            });
            
            expect(result).to.equal('EventIs(StrConcat("prefix:", TEMPERATURE)) && Value() > 60');
        });

        it('should apply default filter to empty values', function() {
            const template = 'EventIs(${EVENT|default})';
            const parsed = RuleTemplate.parse(template);
            
            // Test with empty string
            let result = parsed.prepare({
                EVENT: { value: '', type: 'string' }
            });
            expect(result).to.equal('EventIs()');
            
            // Test with null
            result = parsed.prepare({
                EVENT: { value: null, type: 'string' }
            });
            expect(result).to.equal('EventIs()');
            
            // Test with undefined
            result = parsed.prepare({
                EVENT: { value: undefined, type: 'string' }
            });
            expect(result).to.equal('EventIs()');
            
            // Test with actual value
            result = parsed.prepare({
                EVENT: { value: 'test', type: 'string' }
            });
            expect(result).to.equal('EventIs(test)');
        });
    });

    describe('Template locations - comprehensive testing', function() {
        describe('Templates in BETWEEN expressions', function() {
            it('should handle templates in BETWEEN with numbers', function() {
                const template = 'Value() BETWEEN ${MIN} AND ${MAX}';
                const parsed = RuleTemplate.parse(template);
                const result = parsed.prepare({
                    MIN: { value: 10, type: 'number' },
                    MAX: { value: 100, type: 'number' }
                });
                
                expect(result).to.equal('Value() BETWEEN 10 AND 100');
            });

            it('should handle templates in BETWEEN with dash separator', function() {
                const template = 'Value() BETWEEN ${MIN}-${MAX}';
                const parsed = RuleTemplate.parse(template);
                const result = parsed.prepare({
                    MIN: { value: 5, type: 'number' },
                    MAX: { value: 50, type: 'number' }
                });
                
                expect(result).to.equal('Value() BETWEEN 5-50');
            });

            it('should handle templates in BETWEEN with time-of-day', function() {
                const template = 'BETWEEN ${START} AND ${END}';
                const parsed = RuleTemplate.parse(template);
                const result = parsed.prepare({
                    START: { value: '10:00', type: 'string' },
                    END: { value: '18:00', type: 'string' }
                });
                
                expect(result).to.equal('BETWEEN "10:00" AND "18:00"');
            });
        });

        describe('Templates in IN expressions', function() {
            it('should handle templates in IN clause with single value', function() {
                const template = 'Value() IN (${VAL})';
                const parsed = RuleTemplate.parse(template);
                const result = parsed.prepare({
                    VAL: { value: 'test', type: 'string' }
                });
                
                expect(result).to.equal('Value() IN ("test")');
            });

            it('should handle templates in IN clause with multiple values', function() {
                const template = 'Value() IN (${VAL1}, ${VAL2}, ${VAL3})';
                const parsed = RuleTemplate.parse(template);
                const result = parsed.prepare({
                    VAL1: { value: 'first', type: 'string' },
                    VAL2: { value: 'second', type: 'string' },
                    VAL3: { value: 'third', type: 'string' }
                });
                
                expect(result).to.equal('Value() IN ("first", "second", "third")');
            });

            it('should handle numeric templates in IN clause', function() {
                const template = 'Value() IN (${NUM1}, ${NUM2}, ${NUM3})';
                const parsed = RuleTemplate.parse(template);
                const result = parsed.prepare({
                    NUM1: { value: 1, type: 'number' },
                    NUM2: { value: 2, type: 'number' },
                    NUM3: { value: 3, type: 'number' }
                });
                
                expect(result).to.equal('Value() IN (1, 2, 3)');
            });
        });

        describe('Templates in function arguments', function() {
            it('should handle templates as function arguments', function() {
                const template = 'EventIs(${EVENT})';
                const parsed = RuleTemplate.parse(template);
                const result = parsed.prepare({
                    EVENT: { value: 'sensor-update', type: 'string' }
                });
                
                expect(result).to.equal('EventIs("sensor-update")');
            });

            it('should handle multiple template arguments', function() {
                const template = 'StrConcat(${PREFIX}, ${MIDDLE}, ${SUFFIX})';
                const parsed = RuleTemplate.parse(template);
                const result = parsed.prepare({
                    PREFIX: { value: 'start', type: 'string' },
                    MIDDLE: { value: 'middle', type: 'string' },
                    SUFFIX: { value: 'end', type: 'string' }
                });
                
                expect(result).to.equal('StrConcat("start", "middle", "end")');
            });

            it('should handle mixed types in function arguments', function() {
                const template = 'SomeFunc(${STR}, ${NUM}, ${BOOL})';
                const parsed = RuleTemplate.parse(template);
                const result = parsed.prepare({
                    STR: { value: 'text', type: 'string' },
                    NUM: { value: 42, type: 'number' },
                    BOOL: { value: true, type: 'boolean' }
                });
                
                expect(result).to.equal('SomeFunc("text", 42, true)');
            });

            it('should handle nested function calls with templates', function() {
                const template = 'EventIs(StrConcat(${PREFIX}, ${SUFFIX}))';
                const parsed = RuleTemplate.parse(template);
                const result = parsed.prepare({
                    PREFIX: { value: 'Device:', type: 'string' },
                    SUFFIX: { value: 'Update', type: 'string' }
                });
                
                expect(result).to.equal('EventIs(StrConcat("Device:", "Update"))');
            });
        });

        describe('Templates in array contexts', function() {
            it('should handle templates in string arrays', function() {
                const template = 'Value() IN ([${VAL1}, ${VAL2}])';
                const parsed = RuleTemplate.parse(template);
                const result = parsed.prepare({
                    VAL1: { value: 'option1', type: 'string' },
                    VAL2: { value: 'option2', type: 'string' }
                });
                
                expect(result).to.equal('Value() IN (["option1", "option2"])');
            });

            it('should handle templates in number arrays', function() {
                const template = 'Value() IN ([${NUM1}, ${NUM2}, ${NUM3}])';
                const parsed = RuleTemplate.parse(template);
                const result = parsed.prepare({
                    NUM1: { value: 10, type: 'number' },
                    NUM2: { value: 20, type: 'number' },
                    NUM3: { value: 30, type: 'number' }
                });
                
                expect(result).to.equal('Value() IN ([10, 20, 30])');
            });
        });

        describe('Templates in comparison operators', function() {
            it('should handle templates with greater than operator', function() {
                const template = 'Value() > ${THRESHOLD}';
                const parsed = RuleTemplate.parse(template);
                const result = parsed.prepare({
                    THRESHOLD: { value: 50, type: 'number' }
                });
                
                expect(result).to.equal('Value() > 50');
            });

            it('should handle templates with less than operator', function() {
                const template = 'Value() < ${LIMIT}';
                const parsed = RuleTemplate.parse(template);
                const result = parsed.prepare({
                    LIMIT: { value: 100, type: 'number' }
                });
                
                expect(result).to.equal('Value() < 100');
            });

            it('should handle templates with equality operator', function() {
                const template = 'Value() == ${EXPECTED}';
                const parsed = RuleTemplate.parse(template);
                const result = parsed.prepare({
                    EXPECTED: { value: 'target', type: 'string' }
                });
                
                expect(result).to.equal('Value() == "target"');
            });

            it('should handle templates with not equal operator', function() {
                const template = 'Value() != ${EXCLUDED}';
                const parsed = RuleTemplate.parse(template);
                const result = parsed.prepare({
                    EXCLUDED: { value: 'unwanted', type: 'string' }
                });
                
                expect(result).to.equal('Value() != "unwanted"');
            });
        });

        describe('Templates in logical expressions', function() {
            it('should handle templates in AND expressions', function() {
                const template = 'EventIs(${EVENT1}) && EventIs(${EVENT2})';
                const parsed = RuleTemplate.parse(template);
                const result = parsed.prepare({
                    EVENT1: { value: 'first', type: 'string' },
                    EVENT2: { value: 'second', type: 'string' }
                });
                
                expect(result).to.equal('EventIs("first") && EventIs("second")');
            });

            it('should handle templates in OR expressions', function() {
                const template = 'EventIs(${EVENT1}) || EventIs(${EVENT2})';
                const parsed = RuleTemplate.parse(template);
                const result = parsed.prepare({
                    EVENT1: { value: 'first', type: 'string' },
                    EVENT2: { value: 'second', type: 'string' }
                });
                
                expect(result).to.equal('EventIs("first") || EventIs("second")');
            });

            it('should handle templates in NOT expressions', function() {
                const template = '!EventIs(${EVENT})';
                const parsed = RuleTemplate.parse(template);
                const result = parsed.prepare({
                    EVENT: { value: 'unwanted', type: 'string' }
                });
                
                expect(result).to.equal('!EventIs("unwanted")');
            });

            it('should handle complex logical expressions with templates', function() {
                const template = '(EventIs(${E1}) || EventIs(${E2})) && Value() > ${MIN}';
                const parsed = RuleTemplate.parse(template);
                const result = parsed.prepare({
                    E1: { value: 'type1', type: 'string' },
                    E2: { value: 'type2', type: 'string' },
                    MIN: { value: 10, type: 'number' }
                });
                
                expect(result).to.equal('(EventIs("type1") || EventIs("type2")) && Value() > 10');
            });
        });

        describe('Templates with string concatenation', function() {
            it('should handle templates in StrConcat function', function() {
                const template = 'EventIs(StrConcat("prefix:", ${SUFFIX}))';
                const parsed = RuleTemplate.parse(template);
                const result = parsed.prepare({
                    SUFFIX: { value: 'event', type: 'string' }
                });
                
                expect(result).to.equal('EventIs(StrConcat("prefix:", "event"))');
            });

            it('should handle multiple templates in StrConcat', function() {
                const template = 'EventIs(StrConcat(${PREFIX}, ":", ${SUFFIX}))';
                const parsed = RuleTemplate.parse(template);
                const result = parsed.prepare({
                    PREFIX: { value: 'Device', type: 'string' },
                    SUFFIX: { value: 'Update', type: 'string' }
                });
                
                expect(result).to.equal('EventIs(StrConcat("Device", ":", "Update"))');
            });
        });

        describe('Type validation for template locations', function() {
            it('should enforce type requirement in BETWEEN expressions', function() {
                const template = 'Value() BETWEEN ${MIN} AND ${MAX}';
                const parsed = RuleTemplate.parse(template);
                
                expect(() => {
                    parsed.prepare({
                        MIN: { value: 10 },  // Missing type
                        MAX: { value: 100, type: 'number' }
                    });
                }).to.throw('must have a \'type\' property');
            });

            it('should enforce type requirement in IN expressions', function() {
                const template = 'Value() IN (${VAL1}, ${VAL2})';
                const parsed = RuleTemplate.parse(template);
                
                expect(() => {
                    parsed.prepare({
                        VAL1: { value: 'first', type: 'string' },
                        VAL2: { value: 'second' }  // Missing type
                    });
                }).to.throw('must have a \'type\' property');
            });

            it('should enforce type requirement in function arguments', function() {
                const template = 'EventIs(${EVENT})';
                const parsed = RuleTemplate.parse(template);
                
                expect(() => {
                    parsed.prepare({
                        EVENT: { value: 'test' }  // Missing type
                    });
                }).to.throw('must have a \'type\' property');
            });

            it('should enforce type requirement in nested contexts', function() {
                const template = 'EventIs(StrConcat(${PREFIX}, ${SUFFIX}))';
                const parsed = RuleTemplate.parse(template);
                
                expect(() => {
                    parsed.prepare({
                        PREFIX: { value: 'start', type: 'string' },
                        SUFFIX: { value: 'end' }  // Missing type
                    });
                }).to.throw('must have a \'type\' property');
            });
        });
    });
});
