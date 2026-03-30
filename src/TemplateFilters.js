/*
Template filters are functions that transform variable values.
They are applied in the template syntax as ${variable|filter} or ${variable|filter1|filter2}
*/
const TemplateFilters = {
    // Convert value to JSON string representation
    string: varData => {
        varData.value = String(varData.value);
        varData.type = 'string';

    },

    // Convert to uppercase
    upper: varData => {
        varData.value = String(varData.value).toUpperCase();
        varData.type = 'string';

    },

    // Convert to lowercase
    lower: varData => {
        varData.value = String(varData.value).toLowerCase();
        varData.type = 'string';

    },

    // Capitalize first letter
    capitalize: varData => {
        const str = String(varData.value);
        varData.value = str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
        varData.type = 'string';

    },

    // Convert to title case
    title: varData => {
        varData.value = String(varData.value).split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
        varData.type = 'string';

    },

    // Trim whitespace
    trim: varData => {
        varData.value = String(varData.value).trim();
        varData.type = 'string';

    },

    // Convert to number
    number: varData => {
        varData.value = Number(varData.value);
        varData.type = 'number';
        if(isNaN(varData.value)){
            throw new Error(`Value "${varData.value}" cannot be converted to a number`);
        }
    },

    // Convert to boolean
    boolean: varData => {
        const value = varData.value;
        if (typeof value === 'boolean') {
            varData.type = 'boolean';

        }

        if (typeof value === 'string') {
            const lower = value.toLowerCase();
            if (lower === 'true' || lower === '1' || lower === 'yes') {
                varData.value = true;
                varData.type = 'boolean';

            }
            if (lower === 'false' || lower === '0' || lower === 'no') {
                varData.value = false;
                varData.type = 'boolean';

            }
        }

        varData.value = Boolean(value);
        varData.type = 'boolean';

    },

    // Convert to absolute value (for numbers)
    abs: varData => {
        varData.value = Math.abs(Number(varData.value));
        varData.type = 'number';

    },

    // Round number
    round: varData => {
        varData.value = Math.round(Number(varData.value));
        varData.type = 'number';

    },

    // Floor number
    floor: varData => {
        varData.value = Math.floor(Number(varData.value));
        varData.type = 'number';

    },

    // Ceil number
    ceil: varData => {
        varData.value = Math.ceil(Number(varData.value));
        varData.type = 'number';

    },

    // Default value if empty/null/undefined
    default: (varData, defaultValue = '') => {
        varData.value = (varData.value === null || varData.value === undefined || varData.value === '') ? defaultValue : varData.value;
        if (typeof varData.value === 'string') {
            varData.type = 'string';
        } else if (typeof varData.value === 'number') {
            varData.type = 'number';
        } else if (typeof varData.value === 'boolean') {
            varData.type = 'boolean';
        }

    },

    // Extract start time from time period/time period ago as time value
    time_start: varData => {
        if (varData.type === 'time period' || varData.type === 'time period ago') {
            if (!varData.value || typeof varData.value !== 'object' || !Object.prototype.hasOwnProperty.call(varData.value, 'from')) {
                throw new Error('time_start filter requires value.from for time period types');
            }

            varData.value = varData.value.from;
            varData.type = 'time value';
            return;
        }

        throw new Error('time_start filter requires variable type to be \"time period\" or \"time period ago\"');
    },

    // Extract end time from time period/time period ago as time value
    time_end: varData => {
        if (varData.type === 'time period' || varData.type === 'time period ago') {
            if (!varData.value || typeof varData.value !== 'object' || !Object.prototype.hasOwnProperty.call(varData.value, 'to')) {
                throw new Error('time_end filter requires value.from for time period types');
            }

            varData.value = varData.value.to;
            varData.type = 'time value';
            return;
        }

        throw new Error('time_end filter requires variable type to be \"time period\" or \"time period ago\"');
    }
}

module.exports = TemplateFilters;