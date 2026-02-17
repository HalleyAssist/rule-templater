const {Grammars} = require('ebnf');

const grammar = `
statement_main       ::= statement EOF
logical_operator     ||= AND | OR
statement            ::= expression (logical_operator expression)*
expression           ::= not_expression | standard_expression | parenthesis_expression
parenthesis_expression::= BEGIN_PARENTHESIS WS* statement WS* END_PARENTHESIS
not_expression       ||= NOT (result | parenthesis_expression)
standard_expression  ||= result ((WS* eq_approx) | (WS* basic_rhs) | ((WS+ IS)? WS+ between) | (WS+ in_expr))?
basic_rhs            ::= operator WS*  result
eq_approx            ::= eq_operator WS* "~" WS* result

PLUS                 ::= "+"
MINUS                ::= "-"
MULTIPLY             ::= "*"
DIVIDE               ::= "/"
MODULUS              ::= "%"
DEFAULT_VAL          ::= "??"
arithmetic_operator  ::= PLUS | MINUS | MULTIPLY | DIVIDE | MODULUS | DEFAULT_VAL
arithmetic_operand   ::= fcall | number_time | number
arithmetic_result    ::= arithmetic_operand WS* arithmetic_operator WS* ( arithmetic_result | arithmetic_operand )

simple_result        ::= fcall | value
result               ::= arithmetic_result | simple_result
value                ::= false | true | array | time_period | number_time | number | number_tod | string
BEGIN_ARRAY          ::= WS* #x5B WS*  /* [ left square bracket */
BEGIN_OBJECT         ::= WS* #x7B WS*  /* { left curly bracket */
END_ARRAY            ::= WS* #x5D WS*  /* ] right square bracket */
END_OBJECT           ::= WS* #x7D WS*  /* } right curly bracket */
NAME_SEPARATOR       ::= WS* #x3A WS*  /* : colon */
VALUE_SEPARATOR      ::= WS* #x2C WS*  /* , comma */
WS                   ::= [#x20#x09#x0A#x0D]   /* Space | Tab | \n | \r */

operator             ::= GTE | LTE | GT | LT | EQ | NEQ
eq_operator          ::= EQ | NEQ

BEGIN_ARGUMENT       ::= "("
END_ARGUMENT         ::= ")"

BEGIN_PARENTHESIS    ::= "("
END_PARENTHESIS      ::= ")"

BEGIN_IN             ||= "IN"

in_expr              ::= BEGIN_IN WS* BEGIN_PARENTHESIS WS* arguments END_PARENTHESIS

argument             ::= statement WS*
arguments            ::= argument (WS* "," WS* argument)*
fname                ::= [a-zA-z0-9]+
fcall                ::= fname WS* BEGIN_ARGUMENT WS* arguments? END_ARGUMENT

between_number       ||= (number_time | number) ((WS+ "AND" WS+) | (WS* "-" WS*)) (number_time | number)
between_number_time  ||= number_time ((WS+ "AND" WS+) | (WS* "-" WS*)) number_time (WS+ dow_range)?
between_tod          ||= number_tod ((WS+ "AND" WS+)) number_tod (WS+ dow_range)?
between              ||= "BETWEEN" WS+ (between_number | between_tod)
dow                  ||= "MONDAY" | "MON" | "TUESDAY" | "TUE" | "WEDNESDAY" | "WED" | "THURSDAY" | "THU" | "THUR" | "FRIDAY" | "FRI" | "SATURDAY" | "SAT" | "SUNDAY" | "SUN"
dow_range            ||= "ON" WS+ dow (WS+ "TO" WS+ dow)?
between_time_only    ||= "BETWEEN" WS+ between_number_time
between_tod_only     ||= "BETWEEN" WS+ between_tod

AND                  ||= (WS* "&&" WS*) | (WS+ "AND" WS+)
OR                   ||= (WS* "||" WS*) | (WS+ "OR" WS+)
AGO                  ||= "AGO"
GT                   ::= ">"
LT                   ::= "<"
GTE                  ::= ">="
LTE                  ::= "<="
IS                   ||= "is"
EQ                   ::= "==" | "="
NEQ                  ::= "!="
NOT                  ||= ("!" WS*) | ("not" WS+)
false                ||= "FALSE"
null                 ||= "null"
true                 ||= "TRUE"
array                ::= BEGIN_ARRAY (value (VALUE_SEPARATOR value)*)? END_ARRAY

unit                 ||= "seconds" | "minutes" | "hours" | "weeks" | "days" | "second" | "minute" | "week" | "hour" | "day" | "mins" | "min"
number               ::= "-"? ([0-9]+) ("." [0-9]+)? ("e" ( "-" | "+" )? ("0" | [1-9] [0-9]*))?
number_time          ::= number WS+ unit
number_tod           ::= ([0-9]+) ":" ([0-9]+)

time_period_ago      ||= number_time (WS+ number_time)* WS+ AGO
time_period_ago_between ||= number_time (WS+ number_time)* WS+ AGO WS+ between_tod_only
time_period_const    ||= "today" | time_period_ago
time_period          ::= time_period_ago_between | time_period_const | between_tod_only | between_time_only

string               ::= '"' (([#x20-#x21] | [#x23-#x5B] | [#x5D-#xFFFF]) | #x5C (#x22 | #x5C | #x2F | #x62 | #x66 | #x6E | #x72 | #x74 | #x75 HEXDIG HEXDIG HEXDIG HEXDIG))* '"'
HEXDIG               ::= [a-fA-F0-9]
`

module.exports = Grammars.W3C.getRules(grammar);
