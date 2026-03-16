import type { VariableValue } from '../../index';

const timePeriod: VariableValue = {
    value: { from: '08:00', to: '12:00' },
    type: 'time period'
};

const timePeriodAgo: VariableValue = {
    value: { from: '08:00', to: '12:00', ago: [2, 'HOURS'] },
    type: 'time period ago'
};

void timePeriod;
void timePeriodAgo;
