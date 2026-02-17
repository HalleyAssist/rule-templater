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

// Parse the template to get a RuleTemplate instance
const parsed = RuleTemplate.parse(template);

// Extract variables from the template (uses AST)
const variables = parsed.extractVariables();
console.log(variables);
// [
//   { name: 'EVENT_TYPE', filters: [] },
//   { name: 'THRESHOLD', filters: [] }
// ]

// Validate that variables are provided correctly
const validation = parsed.validate({
    EVENT_TYPE: { value: 'sensor-update', type: 'string' },
    THRESHOLD: { value: 42, type: 'number' }
});
console.log(validation.valid); // true

// Prepare the template with actual values
const prepared = parsed.prepare({
    EVENT_TYPE: { value: 'sensor-update', type: 'string' },
    THRESHOLD: { value: 42, type: 'number' }
});
console.log(prepared);
// 'EventIs("sensor-update") && Value() > 42'
```

### Complex Example

```javascript
const template = '!(EventIs(StrConcat("DeviceEvent:measurement:", ${ACTION})) && TimeLastTrueSet("last_measurement") || TimeLastTrueCheck("last_measurement") < ${TIME})';

const parsed = RuleTemplate.parse(template);

// Extract variables
const variables = parsed.extractVariables();
// [
//   { name: 'ACTION', filters: [] },
//   { name: 'TIME', filters: [] }
// ]

// Prepare with values
const prepared = parsed.prepare({
    ACTION: { value: 'temperature', type: 'string' },
    TIME: { value: 60, type: 'number' }
});

// Result: !(EventIs(StrConcat("DeviceEvent:measurement:", "temperature")) && TimeLastTrueSet("last_measurement") || TimeLastTrueCheck("last_measurement") < 60)
```

### Template Filters

Variables can have filters applied to them:

```javascript
const template = 'EventIs(${EVENT_TYPE|upper})';

const parsed = RuleTemplate.parse(template);
const variables = parsed.extractVariables();
// [{ name: 'EVENT_TYPE', filters: ['upper'] }]
```

## API

### `RuleTemplate.parse(ruleTemplate)`

Parses a rule template string and returns a RuleTemplate instance.

**Parameters:**
- `ruleTemplate` (string): The template string containing `${VARIABLE}` placeholders

**Returns:** A `RuleTemplate` instance with:
- `ruleTemplateText`: The original template string
- `ast`: The parsed Abstract Syntax Tree

### `ruleTemplate.extractVariables()`

Extracts all variables from the template using the AST.

**Returns:** Array of objects with:
- `name` (string): The variable name
- `filters` (array): Array of filter names applied to the variable

### `ruleTemplate.validate(variables)`

Validates that all required variables are provided and have valid types.

**Parameters:**
- `variables` (object): Object mapping variable names to their values and types
  - Each variable should be an object with:
    - `value`: The value to substitute (string, number, or boolean)
    - `type` (optional): The variable type ('string', 'number', 'boolean', etc.)

**Returns:** Object with:
- `valid` (boolean): Whether validation passed
- `errors` (array): Array of error messages (empty if valid)

### `ruleTemplate.prepare(variables)`

Prepares the template by replacing variables with their values.

**Parameters:**
- `variables` (object): Object mapping variable names to their values and types
  - Each variable should be an object with:
    - `value`: The value to substitute (string, number, or boolean)
    - `type` (optional): The variable type ('string', 'number', 'boolean', etc.)

**Returns:** The prepared rule string with variables replaced

### `RuleTemplate.validateVariableNode(astNode, variableType)` (Static)

Helper method to validate that an AST node matches the expected variable type.

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
