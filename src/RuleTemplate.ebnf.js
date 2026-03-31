const {Grammars} = require('ebnf');

const grammar = `
    TEMPLATE_BEGIN       ::= "\${"
    TEMPLATE_END         ::= "}"
    PIPE                 ::= "|"
    IDENT                ::= [A-Za-z_][A-Za-z0-9_]*
    DOT                  ::= "."

    template_value       ::= TEMPLATE_BEGIN WS* template_expr WS* TEMPLATE_END

    template_expr        ::= template_path (WS* template_pipe WS* template_filter_call)*

    template_pipe        ::= PIPE

    template_path        ::= IDENT (WS* DOT WS* IDENT)*

    template_filter_call ::= template_filter_name (WS* BEGIN_ARGUMENT WS* template_filter_args? WS* END_ARGUMENT)?

    template_filter_name ::= IDENT

    template_filter_args ::= template_filter_arg (WS* "," WS* template_filter_arg)*

    template_filter_arg  ::= value | template_value
    argument             ::= number_time_atom WS* | statement WS*
    simple_result        ::= fcall | number_time_atom | value

    number_atom          ::= number | template_value
    number_time_atom     ::= number_time | template_value WS+ unit | template_value
    tod_atom             ::= number_tod | template_value
    dow_atom             ::= dow | template_value
    between_time_only_atom ::= between_time_only | template_value
    between_tod_only_atom  ::= between_tod_only | template_value

    string_atom          ::= string | template_value
    boolean_atom         ::= false | true | template_value
    time_value_atom      ::= number_tod | template_value
    time_period_atom     ::= between_time_only | between_tod_only | template_value
    time_period_ago_atom ::= time_period_ago_between | template_value
    value_atom           ::= boolean_atom | array | time_period | number_time_atom | number_atom | tod_atom | string_atom | object_atom | string_array | number_array | boolean_array | object_array

    object_atom          ::= json_object | template_value
    json_value           ::= string | number | false | true | null | json_array | json_object
    json_member          ::= string NAME_SEPARATOR json_value
    json_object          ::= BEGIN_OBJECT (json_member (VALUE_SEPARATOR json_member)*)? END_OBJECT
    json_array           ::= BEGIN_ARRAY (json_value (VALUE_SEPARATOR json_value)*)? END_ARRAY

    string_array         ::= BEGIN_ARRAY (string (VALUE_SEPARATOR string)*)? END_ARRAY | template_value
    number_array         ::= BEGIN_ARRAY (number (VALUE_SEPARATOR number)*)? END_ARRAY | template_value
    boolean_array        ::= BEGIN_ARRAY (boolean_atom (VALUE_SEPARATOR boolean_atom)*)? END_ARRAY | template_value
    object_array         ::= BEGIN_ARRAY (json_object (VALUE_SEPARATOR json_object)*)? END_ARRAY | template_value
`

module.exports = Grammars.W3C.getRules(grammar);
