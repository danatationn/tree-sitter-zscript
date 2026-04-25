; keywords - declarations
[
  (kw_class)
  (kw_struct)
  (kw_enum)
  (kw_const)
  (kw_static)
  (kw_property)
  (kw_flagdef)
  (kw_states)
  (kw_default)
  (kw_damage_function)
] @keyword

; keywords - modifiers/flags
[
  (kw_abstract)
  (kw_native)
  (kw_play)
  (kw_ui)
  (kw_internal)
  (kw_latent)
  (kw_transient)
  (kw_meta)
  (kw_private)
  (kw_protected)
  (kw_read_only)
  (kw_clear_scope)
  (kw_virtual)
  (kw_virtual_scope)
  (kw_override)
  (kw_final)
  (kw_action)
  (kw_var_arg)
  (kw_extend)
  (kw_mixin)
  (kw_replaces)
  (kw_version)
  (kw_deprecated)
  (kw_void)
  (kw_void_ptr)
  (kw_return)
] @keyword

; keywords - conditionals
[
  (kw_if)
  (kw_else)
  (kw_switch)
  (kw_case)
] @keyword.conditional

; keywords - loops
[
  (kw_for)
  (kw_foreach)
  (kw_while)
  (kw_until)
  (kw_do)
] @keyword.repeat

; keywords - control flow
[
  (kw_break)
  (kw_continue)
  (kw_goto)
  (kw_stop)
  (kw_loop)
  (kw_wait)
  (kw_fail)
] @keyword.control

; keywords - state options
[
  (kw_bright)
  (kw_fast)
  (kw_slow)
  (kw_no_delay)
  (kw_can_raise)
  (kw_offset)
  (kw_light)
  (kw_random)
] @keyword.modifier

; keywords - operators
[
  (kw_align_of)
  (kw_size_of)
  (kw_cross)
  (kw_dot)
  (kw_is)
  (kw_super)
] @keyword.operator

; types - builtin
[
  (integer_type)
  (floating_point_type)
  (string_type)
  (boolean_type)
  (vector_type)
  (color_type)
  (name_type)
  (let_type)
] @type.builtin

; types
(instance_type) @type

; literals
(string_literal) @string
(integer_literal) @number
(floating_point_literal) @number.float
(boolean_literal) @boolean
(null_literal) @constant.builtin
(name_literal) @string.special

; comments
(line_comment) @comment
(block_comment) @comment

; functions/methods
(method_definition
  (identifier) @function)

(expression_statement
  (identifier) @function.call .)

; class/struct/enum names
(class_header
  (identifier) @type)

(structure_definition
  (identifier) @type)

(enumeration_definition
  (identifier) @type.enum)

(enumerator
  (identifier) @constant)

; member declarations
(member_declaration
  (variable_name (identifier) @variable.member))

; state labels
(state_label (identifier) @label)

; operators
["+" "-" "*" "/" "%" "**" "==" "!=" "<" ">" "<=" ">=" "&&" "||" "!" "~" "&" "|" "^" "<<" ">>" ">>>" "=" "+=" "-=" "*=" "/=" "%=" "|=" "&=" "^=" "<<=" ">>=" ">>>=" "~==" "<>=" ".." "?" ":"] @operator

; punctuation
["(" ")" "{" "}" "[" "]"] @punctuation.bracket
["." "," ";" ":"] @punctuation.delimiter
