export interface VariablePosition {
    start: number;
    end: number;
}

export interface VariableInfo {
    name: string;
    filters: string[];
    positions: VariablePosition[];
}

export interface VariableValue {
    value: string | number | boolean | {
        from: string;
        to: string;
        ago?: [number, string];
    } | Record<string, any> | string[] | number[] | boolean[] | Record<string, any>[];
    filters?: string[];
    type?: 'string' | 'number' | 'boolean' | 'object' | 'time period' | 'time period ago' | 'time value' | 'number time' | 'string array' | 'number array' | 'boolean array' | 'object array';
}

export interface Variables {
    [key: string]: VariableValue;
}

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

export interface VariableValidationResult {
    valid: boolean;
    error?: string;
}

export interface ASTNode {
    type: string;
    text?: string;
    children?: ASTNode[];
    [key: string]: any;
}

export type FilterFunction = (varData: VariableValue, ...args: any[]) => VariableValue | any;

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
    time_start: FilterFunction;
    [key: string]: FilterFunction;
}

export interface HalleyFunctionDefinition {
    name: string;
    arguments: string[];
}

export interface HalleyFunctionBlobData {
    _schema?: number;
    version?: string;
    functions?: HalleyFunctionDefinition[];
}

export class RuleTemplate {
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
     * Extract function calls from the template using the AST
     * @returns Array of unique function names used in the template
     */
    extractFunctions(): string[];

    /**
     * Validate variable types against the AST
     * @param variables Object mapping variable names to {value, type} objects
     * @returns Object with validation results: {valid, errors}
     */
    validate(variables: Variables, functionBlob?: HalleyFunctionBlob): ValidationResult;

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

export class GeneralTemplate {
    templateText: string;

    constructor(templateText: string);

    static parse(templateText: string): GeneralTemplate;

    static getVariables(templateText: string): VariableInfo[];

    getVariables(): VariableInfo[];

    extractVariables(): VariableInfo[];

    prepare(variables: Variables): string;
}

export class HalleyFunctionBlob {
    _schema?: number;
    version?: string;
    functions: HalleyFunctionDefinition[];

    constructor(jsonData: HalleyFunctionBlobData);

    static fromURL(url: string): Promise<HalleyFunctionBlob>;

    validate(functionName: string, variables?: any[]): string[];
}

export class VariableTemplate {
    templateText: string;
    ast: ASTNode;
    variable: {
        name: string;
        filters: string[];
    };

    constructor(templateText: string, ast: ASTNode, variableInfo: { name: string; filters: string[] });

    static parse(templateText: string): VariableTemplate;

    extractVariable(): {
        name: string;
        filters: string[];
    };

    format(variableData: VariableValue | Variables): VariableValue;
}

export class VariableValidate {
    static VariableTypes: string[];
    static validators: Record<string, (value: any) => VariableValidationResult>;
    static validate(variableData: VariableValue): VariableValidationResult;
    static validateValue(type: string, value: any): VariableValidationResult;
    static isValid(type: string, value: any): boolean;
}

export const ParserRules: any[];
export const VariableTypes: string[];
export const TemplateFilters: TemplateFiltersType;

export interface IParsingErrorPosition {
    offset: number;
    line: number;
    column: number;
}

export interface IFailureTreeNode {
    name: string;
    expected?: string | RegExp;
    children?: IFailureTreeNode[];
}

export class ParsingError extends Error {
    readonly position: IParsingErrorPosition;
    readonly expected: string[];
    readonly found: string;
    readonly failureTree?: IFailureTreeNode[];
    constructor(message: string, position: IParsingErrorPosition, expected: string[], found: string, failureTree?: IFailureTreeNode[]);
    toString(): string;
}
