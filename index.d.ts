export interface VariablePosition {
    start: number;
    end: number;
}

export interface ExtractedVariable {
    name: string;
    positions: VariablePosition[];
}

export interface VariableValue {
    value: string | number | boolean;
    type?: 'string' | 'number' | 'boolean' | 'object' | 'time period' | 'time value' | 'string array' | 'number array' | 'boolean array' | 'object array';
}

export interface Variables {
    [key: string]: VariableValue;
}

export interface ExtractedVariables {
    [key: string]: ExtractedVariable;
}

export interface ASTNode {
    type: string;
    [key: string]: any;
}

export default class RuleTemplate {
    /**
     * Parse a rule template string into an AST
     * @param ruleTemplate The rule template string to parse
     * @returns The parsed AST
     */
    static parse(ruleTemplate: string): ASTNode;

    /**
     * Validate that an AST node matches the expected variable type
     * @param astNode The AST node to validate
     * @param variableType The expected variable type
     * @returns True if the node is valid for the given type
     */
    static validateVariableNode(astNode: ASTNode | null | undefined, variableType: string): boolean;

    /**
     * Prepare a rule template by replacing variables with their values
     * @param ruleTemplate The template string containing ${VARIABLE} placeholders
     * @param variables Object mapping variable names to their values and types
     * @returns The prepared rule string with variables replaced
     */
    static prepare(ruleTemplate: string, variables: Variables): string;

    /**
     * Extract all variables from a rule template string
     * @param ruleString The template string to extract variables from
     * @returns Object containing all extracted variables with their positions
     */
    static extractVariables(ruleString: string): ExtractedVariables;
}
