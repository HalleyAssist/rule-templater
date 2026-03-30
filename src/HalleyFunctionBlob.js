class HalleyFunctionBlob {
    constructor(jsonData) {
        const blobData = jsonData && typeof jsonData === 'object' ? jsonData : {};

        this._schema = blobData._schema;
        this.version = blobData.version;
        this.functions = [];
        this.functionMap = new Map();

        const functions = Array.isArray(blobData.functions) ? blobData.functions : [];
        for (const definition of functions) {
            if (!definition || typeof definition.name !== 'string') {
                continue;
            }

            const normalizedDefinition = {
                name: definition.name,
                arguments: Array.isArray(definition.arguments) ? definition.arguments.slice() : []
            };

            this.functions.push(normalizedDefinition);
            this.functionMap.set(normalizedDefinition.name, normalizedDefinition);
        }
    }

    static async fromURL(url) {
        if (typeof url !== 'string' || !url.trim()) {
            throw new Error('A function blob URL must be provided');
        }

        if (typeof globalThis.fetch !== 'function') {
            throw new Error('Fetch API is not available');
        }

        const response = await globalThis.fetch(url);
        if (!response || !response.ok) {
            throw new Error(`Failed to fetch function blob from '${url}'`);
        }

        return new HalleyFunctionBlob(await response.json());
    }

    validate(functionName, variables = []) {
        const warnings = [];
        const functionDefinition = this.functionMap.get(functionName);

        if (!functionDefinition) {
            return [`function '${functionName}' does not exist`];
        }

        const providedVariables = Array.isArray(variables) ? variables : [];
        const providedCount = providedVariables.length;
        const parameterRange = this._getParameterRange(functionDefinition.arguments);

        for (let idx = 0; idx < functionDefinition.arguments.length; idx++) {
            const argumentName = functionDefinition.arguments[idx];
            if (argumentName === '...') {
                break;
            }

            if (providedCount > idx || argumentName.endsWith('?')) {
                continue;
            }

            warnings.push(
                `parameter ${idx + 1} of ${functionName} '${argumentName}' is missing, function expects ${parameterRange}`
            );
        }

        if (this._hasTooManyArguments(functionDefinition.arguments, providedCount)) {
            warnings.push(
                `${functionName} received ${providedCount} parameters, function expects ${parameterRange}`
            );
        }

        return warnings;
    }

    _hasTooManyArguments(argumentList, providedCount) {
        const { max } = this._getArgumentBounds(argumentList);
        return max !== Infinity && providedCount > max;
    }

    _getParameterRange(argumentList) {
        const { min, max } = this._getArgumentBounds(argumentList);

        if (max === Infinity) {
            if (min === 0) {
                return 'any number of parameters';
            }

            return `at least ${min} ${min === 1 ? 'parameter' : 'parameters'}`;
        }

        if (min === max) {
            return `${min} ${min === 1 ? 'parameter' : 'parameters'}`;
        }

        return `${min} to ${max} parameters`;
    }

    _getArgumentBounds(argumentList) {
        let min = 0;
        let max = 0;
        let variadic = false;

        for (const argumentName of argumentList) {
            if (argumentName === '...') {
                variadic = true;
                continue;
            }

            max++;
            if (!argumentName.endsWith('?')) {
                min++;
            }
        }

        return {
            min,
            max: variadic ? Infinity : max
        };
    }
}

module.exports = HalleyFunctionBlob;
