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
//   { name: 'EVENT_TYPE', filters: [], positions: [{ start: 8, end: 21 }] },
//   { name: 'THRESHOLD', filters: [], positions: [{ start: 36, end: 48 }] }
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
//   { name: 'ACTION', filters: [], positions: [{ start: 48, end: 57 }] },
//   { name: 'TIME', filters: [], positions: [{ start: 142, end: 149 }] }
// ]

// Prepare with values
const prepared = parsed.prepare({
    ACTION: { value: 'temperature', type: 'string' },
    TIME: { value: 60, type: 'number' }
});

// Result: !(EventIs(StrConcat("DeviceEvent:measurement:", "temperature")) && TimeLastTrueSet("last_measurement") || TimeLastTrueCheck("last_measurement") < 60)
```

### Template Filters

Variables can have filters applied to transform their values. Filters are applied using the pipe (`|`) syntax:

```javascript
const template = 'EventIs(${EVENT_TYPE|upper})';

const parsed = RuleTemplate.parse(template);
const variables = parsed.extractVariables();
// [{ name: 'EVENT_TYPE', filters: ['upper'], positions: [{ start: 8, end: 27 }] }]

// Prepare with filters applied
const prepared = parsed.prepare({
    EVENT_TYPE: { value: 'sensor-update' }
});
// Result: EventIs(SENSOR-UPDATE)
```

#### Multiple Filters

Filters can be chained together and are applied in sequence:

```javascript
const template = 'EventIs(${EVENT|trim|upper|string})';

const parsed = RuleTemplate.parse(template);
const prepared = parsed.prepare({
    EVENT: { value: '  test  ' }
});
// Result: EventIs("TEST")
```

#### Available Filters

- **string**: Convert to JSON string representation (adds quotes and escapes)
- **upper**: Convert to uppercase
- **lower**: Convert to lowercase
- **capitalize**: Capitalize first letter
- **title**: Convert to title case (capitalize each word)
- **trim**: Remove leading/trailing whitespace
- **number**: Convert to number
- **boolean**: Convert to boolean
- **abs**: Absolute value (for numbers)
- **round**: Round number to nearest integer
- **floor**: Round number down
- **ceil**: Round number up

#### Filter Examples

```javascript
// String transformation
'${name|upper}' with name='john' → JOHN
'${name|capitalize}' with name='john doe' → John doe
'${name|title}' with name='john doe' → John Doe

// Number operations
'${value|abs}' with value=-42 → 42
'${value|round}' with value=3.7 → 4
'${value|floor}' with value=3.9 → 3

// Chaining filters
'${text|trim|upper}' with text='  hello  ' → HELLO
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
- `positions` (array): Array of position objects, each with:
  - `start` (number): Zero-based start index of the variable in the template string
  - `end` (number): Zero-based end index of the variable in the template string

Note: If a variable appears multiple times in the template, all occurrences will be recorded in the `positions` array.

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

Prepares the template by replacing variables with their values and applying any filters.

**Parameters:**
- `variables` (object): Object mapping variable names to their values and types
  - Each variable should be an object with:
    - `value`: The value to substitute (string, number, or boolean)
    - `type` (optional): The variable type ('string', 'number', 'boolean', etc.)

**Returns:** The prepared rule string with variables replaced and filters applied

### `RuleTemplate.validateVariableNode(astNode, variableType)` (Static)

Helper method to validate that an AST node matches the expected variable type.

**Parameters:**
- `astNode`: The AST node to validate
- `variableType` (string): The expected variable type

**Returns:** `true` if the node is valid for the given type, `false` otherwise

### `RuleTemplate.TemplateFilters` (Static)

Access to the filter functions used by the template engine. Can be extended with custom filters.

**Example:**
```javascript
const RuleTemplate = require('@halleyassist/rule-templater');

// Add a custom filter
RuleTemplate.TemplateFilters.reverse = (value) => {
    return String(value).split('').reverse().join('');
};

// Use the custom filter
const template = 'EventIs(${EVENT|reverse})';
const parsed = RuleTemplate.parse(template);
const result = parsed.prepare({ EVENT: { value: 'test' } });
// Result: EventIs(tset)
```

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
