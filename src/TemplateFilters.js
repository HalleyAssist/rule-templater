/*
Template filters are functions that transform variable values.
They are applied in the template syntax as ${variable|filter} or ${variable|filter1|filter2}
*/
const TemplateFilters = {
    // Convert value to JSON string representation
    string: value => JSON.stringify(String(value)),
    
    // Convert to uppercase
    upper: value => String(value).toUpperCase(),
    
    // Convert to lowercase
    lower: value => String(value).toLowerCase(),
    
    // Capitalize first letter
    capitalize: value => {
        const str = String(value);
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    },
    
    // Convert to title case
    title: value => {
        return String(value).split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    },
    
    // Trim whitespace
    trim: value => String(value).trim(),
    
    // Convert to number
    number: value => Number(value),
    
    // Convert to boolean
    boolean: value => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            const lower = value.toLowerCase();
            if (lower === 'true' || lower === '1' || lower === 'yes') return true;
            if (lower === 'false' || lower === '0' || lower === 'no') return false;
        }
        return Boolean(value);
    },
    
    // Convert to absolute value (for numbers)
    abs: value => Math.abs(Number(value)),
    
    // Round number
    round: value => Math.round(Number(value)),
    
    // Floor number
    floor: value => Math.floor(Number(value)),
    
    // Ceil number
    ceil: value => Math.ceil(Number(value)),
    
    // Default value if empty/null/undefined
    default: (value, defaultValue = '') => {
        return (value === null || value === undefined || value === '') ? defaultValue : value;
    }
}

module.exports = TemplateFilters;