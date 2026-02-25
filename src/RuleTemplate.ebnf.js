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

    number_atom          ::= number | template_value
    number_time_atom     ::= number_time | template_value WS+ unit | template_value
    tod_atom             ::= number_tod | template_value
    dow_atom             ::= dow | template_value
    between_time_only_atom ::= between_time_only | template_value
    between_tod_only_atom  ::= between_tod_only | template_value
`

module.exports = Grammars.W3C.getRules(grammar);
