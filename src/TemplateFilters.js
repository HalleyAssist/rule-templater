/*
Called as (value, args)
*/
const TemplateFilters = {
    string: value => JSON.stringify(String(value)),
}

module.exports = TemplateFilters;