const RuleTemplate = require('./src/RuleTemplater');
const GeneralTemplate = require('./src/GeneralTemplate');

module.exports = RuleTemplate;
module.exports.ParserRules = RuleTemplate.ParserRules;
module.exports.VariableTypes = RuleTemplate.VariableTypes;
module.exports.TemplateFilters = RuleTemplate.TemplateFilters;
module.exports.GeneralTemplate = GeneralTemplate;
