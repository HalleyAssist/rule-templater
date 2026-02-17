# rule-templater

Parsing and preparation of rule templates for HalleyAssist rules.

## Installation

```bash
npm install @halleyassist/rule-templater
```

## Usage

The `rule-templater` package provides utilities for working with rule templates that contain variable placeholders.

### Basic Example

```javascript
const RuleTemplate = require('@halleyassist/rule-templater');

// Define a template with variables
const template = 'EventIs(${EVENT_TYPE}) && Value() > ${THRESHOLD}';

// Extract variables from the template
const variables = RuleTemplate.extractVariables(template);
console.log(variables);
// {
//   EVENT_TYPE: { name: 'EVENT_TYPE', positions: [...] },
//   THRESHOLD: { name: 'THRESHOLD', positions: [...] }
// }

// Prepare the template with actual values
const prepared = RuleTemplate.prepare(template, {
    EVENT_TYPE: { value: 'sensor-update', type: 'string' },
    THRESHOLD: { value: 42, type: 'number' }
});
console.log(prepared);
// 'EventIs("sensor-update") && Value() > 42'

// Parse the prepared rule into an AST
const ast = RuleTemplate.parse(prepared);
```

### Complex Example

```javascript
const template = '!(EventIs(StrConcat("DeviceEvent:measurement:", ${ACTION})) && TimeLastTrueSet("last_measurement") || TimeLastTrueCheck("last_measurement") < ${TIME})';

const prepared = RuleTemplate.prepare(template, {
    ACTION: { value: 'temperature', type: 'string' },
    TIME: { value: 60, type: 'number' }
});

// Result: !(EventIs(StrConcat("DeviceEvent:measurement:", "temperature")) && TimeLastTrueSet("last_measurement") || TimeLastTrueCheck("last_measurement") < 60)
```

## API

### `RuleTemplate.extractVariables(ruleString)`

Extracts all variables from a rule template string.

**Parameters:**
- `ruleString` (string): The template string containing `${VARIABLE}` placeholders

**Returns:** Object containing all extracted variables with their positions

### `RuleTemplate.prepare(ruleTemplate, variables)`

Prepares a rule template by replacing variables with their values.

**Parameters:**
- `ruleTemplate` (string): The template string containing `${VARIABLE}` placeholders
- `variables` (object): Object mapping variable names to their values and types
  - Each variable should be an object with:
    - `value`: The value to substitute (string, number, or boolean)
    - `type` (optional): The variable type ('string', 'number', 'boolean', etc.)

**Returns:** The prepared rule string with variables replaced

### `RuleTemplate.parse(ruleTemplate)`

Parses a rule template string into an AST.

**Parameters:**
- `ruleTemplate` (string): The rule string to parse

**Returns:** The parsed AST

### `RuleTemplate.validateVariableNode(astNode, variableType)`

Validates that an AST node matches the expected variable type.

**Parameters:**
- `astNode`: The AST node to validate
- `variableType` (string): The expected variable type

**Returns:** `true` if the node is valid for the given type, `false` otherwise

## Variable Types

The following variable types are supported:

- `string`
- `number`
- `boolean`
- `object`
- `time period`
- `time value`
- `string array`
- `number array`
- `boolean array`
- `object array`

## License

ISC
