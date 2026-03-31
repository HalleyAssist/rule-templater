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

    string_atom          ::= string
    boolean_atom         ::= false | true
    time_value_atom      ::= number_tod

    object_atom          ::= json_object
    json_value           ::= string | number | false | true | null | json_array | json_object
    json_member          ::= string NAME_SEPARATOR json_value
    json_object          ::= BEGIN_OBJECT (json_member (VALUE_SEPARATOR json_member)*)? END_OBJECT
    json_array           ::= BEGIN_ARRAY (json_value (VALUE_SEPARATOR json_value)*)? END_ARRAY

    string_array         ::= BEGIN_ARRAY (string (VALUE_SEPARATOR string)*)? END_ARRAY
    number_array         ::= BEGIN_ARRAY (number (VALUE_SEPARATOR number)*)? END_ARRAY
    boolean_array        ::= BEGIN_ARRAY (boolean_atom (VALUE_SEPARATOR boolean_atom)*)? END_ARRAY
    object_array         ::= BEGIN_ARRAY (json_object (VALUE_SEPARATOR json_object)*)? END_ARRAY
`

module.exports = Grammars.W3C.getRules(grammar);
