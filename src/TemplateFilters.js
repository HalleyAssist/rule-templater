/*
Template filters are functions that transform variable values.
They are applied in the template syntax as ${variable|filter} or ${variable|filter1|filter2}
*/
const HUMANISE_TIME_UNITS = [
    { name: 'year', seconds: 31536000, aliases: ['year', 'years', 'yr', 'yrs', 'y'] },
    { name: 'month', seconds: 2592000, aliases: ['month', 'months', 'mo', 'mos'] },
    { name: 'week', seconds: 604800, aliases: ['week', 'weeks', 'wk', 'wks', 'w'] },
    { name: 'day', seconds: 86400, aliases: ['day', 'days', 'd'] },
    { name: 'hour', seconds: 3600, aliases: ['hour', 'hours', 'hr', 'hrs', 'h'] },
    { name: 'minute', seconds: 60, aliases: ['minute', 'minutes', 'min', 'mins'] },
    { name: 'second', seconds: 1, aliases: ['second', 'seconds', 'sec', 'secs', 's'] }
];

const getHumaniseTimeUnit = minUnit => {
    if (minUnit === null || minUnit === undefined || minUnit === '') {
        return null;
    }

    const normalizedMinUnit = String(minUnit).trim().toLowerCase();
    const unit = HUMANISE_TIME_UNITS.find(candidate => candidate.aliases.includes(normalizedMinUnit));

    if (!unit) {
        throw new Error(`Unknown humanise_time min_unit \"${minUnit}\"`);
    }

    return unit;
};

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

    humanise_list: (varData, joiner = 'and') => {
        if (typeof varData.value === 'string') {
            varData.type = 'string';
            return;
        }

        if (!Array.isArray(varData.value)) {
            varData.value = String(varData.value);
            varData.type = 'string';
            return;
        }

        const items = varData.value.map(item => String(item));

        if (items.length === 0) {
            varData.value = '';
        } else if (items.length === 1) {
            [varData.value] = items;
        } else if (items.length === 2) {
            varData.value = `${items[0]} ${joiner} ${items[1]}`;
        } else {
            varData.value = `${items.slice(0, -1).join(', ')} ${joiner} ${items[items.length - 1]}`;
        }

        varData.type = 'string';

    },

    humanise_time: (varData, minUnit = null) => {
        const rawSeconds = Number(varData.value);

        if (isNaN(rawSeconds)) {
            throw new Error(`Value "${varData.value}" cannot be converted to seconds`);
        }

        const isNegative = rawSeconds < 0;
        const absoluteSeconds = Math.abs(rawSeconds);
        const minimumUnit = getHumaniseTimeUnit(minUnit);
        const minimumUnitIndex = minimumUnit
            ? HUMANISE_TIME_UNITS.findIndex(unit => unit.name === minimumUnit.name)
            : HUMANISE_TIME_UNITS.length - 1;
        const candidateUnits = HUMANISE_TIME_UNITS.slice(0, minimumUnitIndex + 1);
        let selectedUnit = candidateUnits.find(unit => absoluteSeconds % unit.seconds === 0);
        let quantity;

        if (selectedUnit) {
            quantity = absoluteSeconds / selectedUnit.seconds;
        } else if (minimumUnit) {
            selectedUnit = minimumUnit;
            quantity = Math.floor(absoluteSeconds / selectedUnit.seconds);
        } else {
            selectedUnit = HUMANISE_TIME_UNITS[HUMANISE_TIME_UNITS.length - 1];
            quantity = absoluteSeconds;
        }

        const signedQuantity = isNegative ? -quantity : quantity;
        const label = Math.abs(signedQuantity) === 1 ? selectedUnit.name : `${selectedUnit.name}s`;

        varData.value = `${signedQuantity} ${label}`;
        varData.type = 'string';

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