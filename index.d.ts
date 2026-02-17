export interface VariableInfo {
    name: string;
    filters: string[];
}

export interface VariableValue {
    value: string | number | boolean;
    type?: 'string' | 'number' | 'boolean' | 'object' | 'time period' | 'time value' | 'string array' | 'number array' | 'boolean array' | 'object array';
}

export interface Variables {
    [key: string]: VariableValue;
}

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

export interface ASTNode {
    type: string;
    text?: string;
    children?: ASTNode[];
    [key: string]: any;
}

export type FilterFunction = (value: any) => any;

export interface TemplateFiltersType {
    string: FilterFunction;
    upper: FilterFunction;
    lower: FilterFunction;
    capitalize: FilterFunction;
    title: FilterFunction;
    trim: FilterFunction;
    number: FilterFunction;
    boolean: FilterFunction;
    abs: FilterFunction;
    round: FilterFunction;
    floor: FilterFunction;
    ceil: FilterFunction;
    default: FilterFunction;
    [key: string]: FilterFunction;
}

export default class RuleTemplate {
    ruleTemplateText: string;
    ast: ASTNode;

    constructor(ruleTemplateText: string, ast: ASTNode);

    /**
     * Parse a rule template string and return a RuleTemplate instance
     * @param ruleTemplate The template string to parse
     * @returns Instance with AST and template text
     */
    static parse(ruleTemplate: string): RuleTemplate;

    /**
     * Extract variables from the template using the AST
     * @returns Array of {name, filters} objects
     */
    extractVariables(): VariableInfo[];

    /**
     * Validate variable types against the AST
     * @param variables Object mapping variable names to {value, type} objects
     * @returns Object with validation results: {valid, errors}
     */
    validate(variables: Variables): ValidationResult;

    /**
     * Prepare the template by replacing variables with their values
     * Applies any filters specified in the template (e.g., ${var|upper|trim})
     * @param variables Object mapping variable names to {value, type} objects
     * @returns The prepared rule string
     */
    prepare(variables: Variables): string;

    /**
     * Helper method to validate if an AST node matches a variable type
     * @param astNode The AST node to validate
     * @param variableType The expected variable type
     * @returns True if valid, false otherwise
     */
    static validateVariableNode(astNode: ASTNode | null | undefined, variableType: string): boolean;
}

export const ParserRules: any[];
export const VariableTypes: string[];
export const TemplateFilters: TemplateFiltersType;
