/**
 * @file ZScript (UZDoom) language support
 * @author danatationn <lemontasteicetea@proton.me>
 * @license MIT
 */

/// // <reference types="tree-sitter-cli/dsl" />
// // @ts-check

export default grammar({
  name: "zscript",

  word: $ => $.identifier,

  conflicts: $ => [
    [$.instance_type, $.variable_name],
    [$.member_declaration_flag, $.method_definition_flag],
    [$.color_type, $.color_literal_expression],
    [$._expression, $.instance_type, $.variable_name],
    [$._expression, $.instance_type],
    [$.instance_type, $.instance_type],
    [$._expression, $.variable_name, $.fixed_array_type],
    [$.variable_name, $.fixed_array_type],
    [$.foreach_loop_item, $.constant_expression],
  ],

  extras: $ => [
    /\s/,
    $.line_comment,
    $.block_comment,
  ],

  rules: {
    source_file: $ => seq(
      optional($.version_directive),
      repeat($._top_level),
    ),

    version_directive: $ => seq(
      'version',
      $.string_literal,
    ),

    include_directive: $ => seq(
      '#include',
      $.string_literal
    ),

    _top_level: $ => choice(
      $.class_definition,
      $.structure_definition,
      $.enumeration_definition,
      $.constant_definition,
      $.include_directive,
    ),

    // DEFINITIONS //

    class_definition: $ => seq($.class_header, '{', repeat($._class_content), '}'),

    class_header: $ => choice(
      seq(choice($.kw_extend, $.kw_mixin), $.kw_class, $.identifier),
      seq($.kw_class, $.identifier, optional(seq(':', $.instance_type)), repeat($.class_definition_flags)),
    ),

    _class_content: $ => choice(
      $.default_block,
      $.state_block,
      $.member_declaration,
      $.method_definition,
      $.constant_definition,
      $.enumeration_definition,
      $.flag_definition,
      $.property_definition,
      $.structure_definition,
    ),

    constant_definition: $ => choice(
      seq($.kw_const, field('name', $.identifier), '=', field('value', $._expression), ';'),
      $.static_array_definition,
    ),

    default_block: $ => seq(
      $.kw_default,
      '{',
      repeat($.default_definition),
      '}',
    ),
    default_definition: $ => choice(
      $.default_flag,
      $.default_property,
    ),
    default_flag: $ => seq(
      choice('+', '-'),
      $.identifier,
      optional(seq('.', $.identifier)),
      optional(';'),
    ),
    default_property: $ => choice(
      seq($.identifier, repeat(seq('.', $.identifier)), repeat1($.constant_expression), ';'),
      seq($.default_special_property, ';'),
      seq($.kw_damage_function, $._expression, ';'),
    ),
    default_special_property: $ => choice($.kw_clear_flags, $.kw_monster, $.kw_projectile),

    enumeration_definition: $ => seq(
      $.kw_enum,
      $.identifier,
      optional(seq(':', $.integer_type)),
      '{',
      seq($.enumerator, repeat(seq(',', $.enumerator)), optional(',')),
      '}',
      optional(';'),
    ),
    enumerator: $ => seq(
      $.identifier,
      optional(seq('=', $.constant_expression))
    ),

    flag_definition: $ => seq(
      $.kw_flagdef,
      $.identifier,
      ':',
      $.identifier,
      ',',
      $.integer_literal,
      ';',
    ),

    member_declaration: $ => seq(
      repeat($.member_declaration_flag),
      $.type,
      $.variable_name,
      repeat(seq(',', $.variable_name)),
      ';',
    ),

    method_definition: $ => prec.left(seq(
      repeat($.method_definition_flag),
      $.type,
      repeat(seq(',', $.type)),
      $.identifier,
      '(',
      optional($.method_argument_list_or_void),
      ')',
      optional($.kw_const),
      choice(seq('{', repeat($._statement), '}'), ';'),
    )),
    method_argument_list: $ => prec.left(choice(
      seq($.type, $.variable_name, repeat(seq(',', $.method_argument_list))),
      seq($.type, $.variable_name, '=', $.constant_expression, repeat(seq(',', $.method_argument_list))),
    )),
    method_argument_list_or_void: $ => choice(
      $.method_argument_list,
      $.kw_void,
    ),

    property_definition: $ => seq(
      $.kw_property, $.identifier, ':', $.identifier, repeat(seq(',', $.identifier)), ';',
    ),

    // states block: parens + action scope are optional (bare `States { }` is valid)
    state_block: $ => seq(
      $.kw_states,
      optional(seq('(', $.action_scope, repeat(seq(',', $.action_scope)), ')')),
      '{', repeat($._state_item), '}',
    ),
    _state_item: $ => choice(
      $.state_label,
      $.state_line,
      $.state_flow,
    ),
    state_label: $ => seq($.identifier, ':'),
    // sprites are always 4 uppercase chars; frames always uppercase. must not match mixed-case labels
    state_sprite: $ => token(prec(1, /[A-Z0-9_]{4}/)),
    state_frames: $ => token(prec(1, /[A-Z#]+/)),
    state_line: $ => seq(
      $.state_sprite,
      $.state_frames,
      $.state_time,
      repeat($.state_option),
      choice(
        ';',
        seq($.state_function, ';'),
        seq('{', repeat($._statement), '}'),
      ),
    ),
    state_flow: $ => choice(
      seq($.kw_goto, $.identifier, optional(seq('+', $.integer_literal)), optional(';')),
      seq(choice($.kw_stop, $.kw_loop, $.kw_wait, $.kw_fail), optional(';')),
    ),
    state_time: $ => choice(
      seq('-', $.integer_literal),
      $.integer_literal,
      seq($.kw_random, '(', $.integer_literal, ',', $.integer_literal, ')'),
    ),
    state_option: $ => choice(
      choice($.kw_bright, $.kw_fast, $.kw_slow, $.kw_no_delay, $.kw_can_raise),
      seq($.kw_offset, '(', $.integer_literal, ',', $.integer_literal, ')'),
      seq($.kw_light, '(', $.string_literal, repeat(seq(',', $.string_literal)), ')'),
    ),
    // state function: either nothing (;), a call without trailing ;, or an inline block
    state_function: $ => choice(
      ';',
      seq($.identifier, '(', optional($.argument_list), ')'),
      seq('{', repeat($._statement), '}'),
    ),

    structure_definition: $ => seq($.kw_struct, $.identifier, repeat($.structure_flag), '{', repeat($.structure_content), '}', optional(';')),
    structure_content: $ => choice(
      $.member_declaration,
      $.method_definition,
      $.enumeration_definition,
      $.constant_definition,
    ),

    // STATEMENTS //

    argument_list: $ => seq(
      $._argument,
      repeat(seq(',', $._argument)),
    ),
    _argument: $ => choice(
      seq($.identifier, ':', $._expression),
      $._expression,
    ),

    _expression: $ => choice(
      $.identifier,
      $.kw_super,
      $.literal,
      $.vector_literal_expression,
      $.color_literal_expression,

      seq('(', $._expression, ')'),

      // postfix
      // prec.left(15, seq($._expression, '(', optional($.argument_list), ')')),
      // prec.left(15, seq($.type, '(', $._expression, ')')),
      $.call_expression,
      $.type_cast_expression,
      prec.left(15, seq('(', $.kw_class, '<', $.type, '>', ')', '(', $._expression, ')')),
      prec.left(15, seq($._expression, '[', $._expression, ']')),
      prec.left(15, seq($._expression, '.', $.identifier)),
      prec.left(15, seq($._expression, '++')),
      prec.left(15, seq($._expression, '--')),

      // unary
      prec.right(14, seq('-', $._expression)),
      prec.right(14, seq('!', $._expression)),
      prec.right(14, seq('++', $._expression)),
      prec.right(14, seq('--', $._expression)),
      prec.right(14, seq('~', $._expression)),
      prec.right(14, seq('+', $._expression)),
      prec.right(14, seq($.kw_align_of, $._expression)),
      prec.right(14, seq($.kw_size_of, $._expression)),

      // binary arithmetic
      prec.left(13, seq($._expression, '**', $._expression)),
      prec.left(12, seq($._expression, '*', $._expression)),
      prec.left(12, seq($._expression, '/', $._expression)),
      prec.left(12, seq($._expression, '%', $._expression)),
      prec.left(11, seq($._expression, '+', $._expression)),
      prec.left(11, seq($._expression, '-', $._expression)),
      prec.left(10, seq($._expression, '<<', $._expression)),
      prec.left(10, seq($._expression, '>>', $._expression)),
      prec.left(10, seq($._expression, '>>>', $._expression)),
      // binary vector
      prec.left(10, seq($._expression, $.kw_cross, $._expression)),
      prec.left(10, seq($._expression, $.kw_dot, $._expression)),
      // binary concatenation
      prec.left(9, seq($._expression, '..', $._expression)),
      // binary comparison
      prec.left(8, seq($._expression, '<', $._expression)),
      prec.left(8, seq($._expression, '>', $._expression)),
      prec.left(8, seq($._expression, '<=', $._expression)),
      prec.left(8, seq($._expression, '>=', $._expression)),
      prec.left(8, seq($._expression, '==', $._expression)),
      prec.left(8, seq($._expression, '!=', $._expression)),
      prec.left(8, seq($._expression, '~==', $._expression)),
      // binary signed difference
      prec.left(8, seq($._expression, '<>=', $._expression)),
      // binary type
      prec.left(8, seq($._expression, $.kw_is, $._expression)),
      // binary logical
      prec.left(7, seq($._expression, '&', $._expression)),
      prec.left(6, seq($._expression, '^', $._expression)),
      prec.left(5, seq($._expression, '|', $._expression)),
      // binary lazy boolean
      prec.left(4, seq($._expression, '&&', $._expression)),
      prec.left(3, seq($._expression, '||', $._expression)),
      // ternary
      prec.right(2, seq($._expression, '?', $._expression, ':', $._expression)),
      // binary assignment
      prec.right(1, seq($._expression, '=', $._expression)),
      prec.right(1, seq($._expression, '+=', $._expression)),
      prec.right(1, seq($._expression, '-=', $._expression)),
      prec.right(1, seq($._expression, '*=', $._expression)),
      prec.right(1, seq($._expression, '/=', $._expression)),
      prec.right(1, seq($._expression, '%=', $._expression)),
      prec.right(1, seq($._expression, '<<=', $._expression)),
      prec.right(1, seq($._expression, '>>=', $._expression)),
      prec.right(1, seq($._expression, '>>>=', $._expression)),
      prec.right(1, seq($._expression, '|=', $._expression)),
      prec.right(1, seq($._expression, '&=', $._expression)),
      prec.right(1, seq($._expression, '^=', $._expression)),
    ),

    call_expression: $ => prec.left(15, seq(
      field('function', $._expression),
      '(', optional($.argument_list), ')',
    )),

    type_cast_expression: $ => prec.left(15, seq(
      field('type', $.type),
      '(', field('value', $._expression), ')',
    )),

    _statement: $ => choice(
      $.compound_statement,
      $.expression_statement,
      $.conditional_statement,
      $.switch_statement,
      $.switch_case,
      $.switch_default,
      $._loop_statement,
      $._flow_statement,
      $.local_variable_statement,
      $.multi_assignment_statement,
      $.null_statement,
      $.static_array_definition,
    ),

    compound_statement: $ => seq('{', repeat($._statement), '}'),
    expression_statement: $ => seq($._expression, ';'),
    conditional_statement: $ => prec.right(seq($.kw_if, '(', $._expression, ')', $._statement, optional(seq($.kw_else, $._statement)))),
    switch_statement: $ => seq($.kw_switch, '(', $._expression, ')', $._statement),
    switch_case: $ => seq($.kw_case, $._expression, ':'),
    switch_default: $ => seq($.kw_default, ':'),

    _loop_statement: $ => choice($.foreach_loop_statement, $.for_loop_statement, $.while_loop_statement, $.do_while_loop_statement),
    for_loop_statement: $ => seq(
      $.kw_for, '(', optional($.for_loop_initializer), ';', optional($._expression), ';', optional($.for_loop_update), ')',
      $._statement
    ),
    for_loop_initializer: $ => choice($.for_loop_local_variable_statement, $.for_loop_update),
    for_loop_update: $ => seq($._expression, repeat(seq(',', $._expression))),
    foreach_loop_statement: $ => seq(
      $.kw_foreach, '(', seq($.foreach_loop_item, repeat(seq(',', $.foreach_loop_item))), ':', $._expression, ')',
      $._statement
    ),
    foreach_loop_declaration: $ => seq($.foreach_loop_item, repeat(seq(',', $.foreach_loop_item))),
    foreach_loop_item: $ => seq(optional($.type), $.identifier, optional(seq('[', $._expression, ']'))),
    while_loop_statement: $ => choice(
      seq($.kw_while, '(', $._expression, ')', $._statement),
      seq($.kw_until, '(', $._expression, ')', $._statement),
    ),
    do_while_loop_statement: $ => choice(
      seq($.kw_do, $._statement, $.kw_while, '(', $._expression, ')'),
      seq($.kw_do, $._statement, $.kw_until, '(', $._expression, ')'),
    ),

    _flow_statement: $ => choice($.continue_flow_statement, $.break_flow_statement, $.return_flow_statement),
    continue_flow_statement: $ => seq($.kw_continue, ';'),
    break_flow_statement: $ => seq($.kw_break, ';'),
    return_flow_statement: $ => seq($.kw_return, optional(seq($._expression, repeat(seq(',', $._expression)))), ';'),

    for_loop_local_variable_statement:  $ => seq($.type, $.local_variable_initializer, repeat(seq(',', $.local_variable_initializer))),
    local_variable_statement:           $ => seq($.type, $.local_variable_initializer, repeat(seq(',', $.local_variable_initializer)), ';'),
    local_variable_initializer:         $ => seq($.variable_name, optional(seq('=', $._expression))),

    multi_assignment_statement: $ => seq('[', $._expression, repeat(seq(',', $._expression)), ']', '=', $._expression, ';'),
    null_statement: $ => ';',
    static_array_definition: $ => seq($.kw_static, $.kw_const, $.type, $.variable_name, '=', '{', $.constant_expression, repeat(seq(',', $.constant_expression)), '}', ';'),

    // TYPES //

    type: $ => choice(
      $.numeric_type,
      $.string_type,
      $.name_type,
      $.boolean_type,
      $.integer_like_reference_type,
      $.string_like_reference_type,
      $.color_type,
      $.let_type,
      $.vector_type,
      $.fixed_array_type,
      $.dynamic_array_type,
      // $.map_type,
      $.class_reference_type,
      $.native_pointer_type,
      $.read_only_type,
      $.instance_type,
      $.variable_name,
      $.kw_void,
    ),

    numeric_type: $ => choice($.floating_point_type, $.integer_type),
    floating_point_type: $ => choice($.kw_double, $.kw_float, $.kw_float32, $.kw_float64),
    integer_type: $ => choice($.kw_int, $.kw_uint, $.kw_int16, $.kw_uint16, $.kw_int8, $.kw_uint8, $.kw_sbyte, $.kw_byte, $.kw_short, $.kw_ushort),
    string_type: $ => token('string'),  // the String class also exists
    name_type: $ => $.kw_name,
    boolean_type: $ => $.kw_boolean,
    integer_like_reference_type: $ => choice($.kw_sprite_id, $.kw_texture_id),
    string_like_reference_type: $ => choice($.kw_sound, $.kw_state_label),
    color_type: $ => $.kw_color,
    let_type: $ => $.kw_let,
    vector_type: $ => choice($.kw_vector2, $.kw_vector3),
    class_reference_type: $ => seq($.kw_class, optional(seq('<', $.type, '>'))),
    native_pointer_type: $ => choice(seq('@', $.type), $.kw_void_ptr),
    dynamic_array_type: $ => seq($.kw_array, '<', $.type, '>'),
    read_only_type: $ => seq($.kw_read_only, '<', $.type, '>'),
    instance_type: $ => prec.left(seq(optional('.'), $.identifier, repeat(seq('.', $.identifier)))),
    variable_name: $ => seq($.identifier, repeat(seq('[', optional($.constant_expression), ']'))),
    fixed_array_type: $ => seq($.identifier, repeat1(seq('[', optional($.constant_expression), ']'))),

    // FLAGS //

    class_definition_flags: $ => choice(
      choice($.kw_abstract, $.kw_native, $.kw_play, $.kw_ui),
      seq($.kw_replaces, $.identifier),
      seq($.kw_version, $.string_literal),
    ),
    member_declaration_flag: $ => choice(
      choice($.kw_internal, $.kw_latent, $.kw_meta, $.kw_native, $.kw_play, $.kw_private, $.kw_protected, $.kw_read_only, $.kw_transient, $.kw_ui),
      $.deprecated_flag, $.version_flag,
    ),
    method_definition_flag: $ => choice(
      choice($.kw_action, $.kw_clear_scope, $.kw_final, $.kw_native, $.kw_override, $.kw_play, $.kw_private, $.kw_protected, $.kw_static, $.kw_ui, $.kw_var_arg, $.kw_virtual, $.kw_virtual_scope),
      $.deprecated_flag, $.version_flag, $.action_flag,
    ),
    structure_flag: $ => choice(
      choice($.kw_clear_scope, $.kw_native, $.kw_play, $.kw_ui),
      $.version_flag,
    ),

    deprecated_flag: $ => seq($.kw_deprecated, '(', $.string_literal, optional(seq(',', $.string_literal)), ')'),
    version_flag: $ => seq($.kw_version, '(', $.string_literal, ')'),
    action_flag: $ => seq($.kw_action, '(', $.action_scope, repeat(seq(',', $.action_scope)), ')'),
    action_scope: $ => choice($.kw_actor, $.kw_item, $.kw_overlay, $.kw_weapon),

    // LITERALS //

    literal: $ => choice(
      $.string_literal, $.integer_literal, $.name_literal, $.floating_point_literal, $.boolean_literal, $.null_literal,
    ),

    vector_literal_expression: $ => choice(
      seq('(', $._expression, ',', $._expression, optional(seq(',', $._expression)), ')'),
    ),
    color_literal_expression: $ => seq(
      $.kw_color, '(', $._expression, ',', $._expression, ',', $._expression, optional(seq(',', $._expression)), ')',
    ),
    constant_expression: $ => $._expression,
    string_literal: $ => token(seq('"', repeat(choice(/[^"\\]/, /\\./)), '"')),  // so it doesn't break on escape characters

    identifier: $ => /[a-zA-Z_][a-zA-Z0-9_]*/,

    integer_literal: $ => choice(
      $.octal_literal,
      $.decimal_literal,
      $.hexadecimal_literal,
    ),
    // atomic token() to avoid multi-token ambiguity conflicts
    // octal takes prec(1) so "07" prefers octal over decimal
    // decimal covers 0 alone (no suffix on octal for bare "0")
    octal_literal:       $ => token(prec(1, seq('0', /[0-7]+/, optional(/[uUlL]{1,2}/)))),
    decimal_literal:     $ => token(seq(/[0-9]+/, optional(/[uUlL]{1,2}/))),
    hexadecimal_literal: $ => token(prec(2, seq(/0[xX]/, /[0-9a-fA-F]+/, optional(/[uUlL]{1,2}/)))),

    floating_point_literal: $ => token(choice(
      seq(/[0-9]+/, /[eE]/, optional(/[+\-]/), /[0-9]+/, optional(/[fF]/)),
      seq(/[0-9]*/, '.', /[0-9]+/, optional(seq(/[eE]/, optional(/[+\-]/), /[0-9]+/)), optional(/[fF]/)),
      seq(/[0-9]+/, '.', /[0-9]*/, optional(seq(/[eE]/, optional(/[+\-]/), /[0-9]+/)), optional(/[fF]/)),
    )),

    boolean_literal: $ => choice($.kw_false, $.kw_true),

    name_literal: $ => seq('\'', repeat1($.name_character), '\''),
    name_character: $ => choice(
      '\\\'',
      /[\s\S]/,
    ),

    null_literal: $ => /null/i,

    // TOKENS //

    line_comment:  $ => token(seq('//', /.*/)),
    block_comment: $ => token(seq('/*', /[^*]*\*+([^/*][^*]*\*+)*/, '/')),

    // KEYWORDS //

    kw_const:  $ => token(prec(1, /const/i)),
    kw_void:   $ => token(prec(1, /void/i)),
    kw_void_ptr:   $ => token(prec(1, /voidPtr/i)),
    kw_false:  $ => token(prec(1, /false/i)),
    kw_true:   $ => token(prec(1, /true/i)),
    kw_null:   $ => token(prec(1, /null/i)),

    kw_struct: $ => token(prec(1, /struct/i)),

    kw_double:       $ => token(prec(1, /double/i)),
    kw_float:        $ => token(prec(1, /float/i)),
    kw_float64:      $ => token(prec(1, /float64/i)),
    kw_float32:      $ => token(prec(1, /float32/i)),
    kw_int:          $ => token(prec(1, /int/i)),
    kw_uint:         $ => token(prec(1, /uint/i)),
    kw_int16:        $ => token(prec(1, /int16/i)),
    kw_uint16:       $ => token(prec(1, /uint16/i)),
    kw_int8:         $ => token(prec(1, /int8/i)),
    kw_uint8:        $ => token(prec(1, /uint8/i)),
    kw_sbyte:        $ => token(prec(1, /sbyte/i)),
    kw_byte:         $ => token(prec(1, /byte/i)),
    kw_short:        $ => token(prec(1, /short/i)),
    kw_ushort:       $ => token(prec(1, /ushort/i)),
    kw_name:         $ => token(prec(1, /name/i)),
    kw_boolean:      $ => token(prec(1, /bool/i)),
    kw_sprite_id:    $ => token(prec(1, /spriteId/i)),
    kw_texture_id:   $ => token(prec(1, /textureId/i)),
    kw_sound:        $ => token(prec(1, /sound/i)),
    kw_state_label:  $ => token(prec(1, /stateLabel/i)),
    kw_color:        $ => token(prec(1, /color/i)),
    kw_let:          $ => token(prec(1, /let/i)),
    kw_vector2:      $ => token(prec(1, /vector2/i)),
    kw_vector3:      $ => token(prec(1, /vector3/i)),
    kw_array:        $ => token(prec(1, /array/i)),
    kw_read_only:    $ => token(prec(1, /readOnly/i)),

    kw_super:  $ => token(prec(1, /super/i)),

    kw_align_of:  $ => token(prec(1, /alignOf/i)),
    kw_size_of:   $ => token(prec(1, /sizeOf/i)),
    kw_cross:     $ => token(prec(1, /cross/i)),
    kw_dot:       $ => token(prec(1, /dot/i)),
    kw_is:        $ => token(prec(1, /is/i)),

    kw_enum:     $ => token(prec(1, /enum/i)),
    kw_flagdef:  $ => token(prec(1, /flagDef/i)),
    kw_property: $ => token(prec(1, /property/i)),

    kw_if:        $ => token(prec(1, /if/i)),
    kw_else:      $ => token(prec(1, /else/i)),
    kw_switch:    $ => token(prec(1, /switch/i)),
    kw_case:      $ => token(prec(1, /case/i)),
    kw_default:   $ => token(prec(1, /default/i)),

    // common flags
    kw_native:       $ => token(prec(1, /native/i)),
    kw_clear_scope:  $ => token(prec(1, /clearScope/i)),
    kw_play:         $ => token(prec(1, /play/i)),
    kw_private:      $ => token(prec(1, /private/i)),
    kw_protected:    $ => token(prec(1, /protected/i)),
    kw_static:       $ => token(prec(1, /static/i)),
    kw_ui:           $ => token(prec(1, /ui/i)),

    // member dec flags
    kw_internal:   $ => token(prec(1, /internal/i)),
    kw_latent:     $ => token(prec(1, /latent/i)),
    kw_transient:  $ => token(prec(1, /transient/i)),
    kw_meta:       $ => token(prec(1, /meta/i)),

    // method def flags
    kw_action:         $ => token(prec(1, /action/i)),
    kw_final:          $ => token(prec(1, /final/i)),
    kw_override:       $ => token(prec(1, /override/i)),
    kw_var_arg:        $ => token(prec(1, /varArg/i)),
    kw_virtual:        $ => token(prec(1, /virtual/i)),
    kw_virtual_scope:  $ => token(prec(1, /virtualScope/i)),

    // flow
    kw_for:      $ => token(prec(1, /for/i)),
    kw_foreach:  $ => token(prec(1, /foreach/i)),
    kw_while:    $ => token(prec(1, /while/i)),
    kw_until:    $ => token(prec(1, /until/i)),
    kw_do:       $ => token(prec(1, /do/i)),

    kw_continue: $ => token(prec(1, /continue/i)),
    kw_break:    $ => token(prec(1, /break/i)),
    kw_return:   $ => token(prec(1, /return/i)),

    kw_deprecated:  $ => token(prec(1, /deprecated/i)),
    kw_actor:       $ => token(prec(1, /actor/i)),
    kw_item:        $ => token(prec(1, /item/i)),
    kw_overlay:     $ => token(prec(1, /overlay/i)),
    kw_weapon:      $ => token(prec(1, /weapon/i)),

    // class flags
    kw_class:    $ => token(prec(1, /class/i)),
    kw_extend:   $ => token(prec(1, /extend/i)),
    kw_mixin:    $ => token(prec(1, /mixin/i)),
    kw_abstract: $ => token(prec(1, /abstract/i)),
    kw_replaces: $ => token(prec(1, /replaces/i)),
    kw_version:  $ => token(prec(1, /version/i)),

    kw_damage_function:  $ => token(prec(1, /DamageFunction/i)),
    kw_clear_flags:      $ => token(prec(1, /ClearFlags/i)),
    kw_monster:          $ => token(prec(1, /Monster/i)),
    kw_projectile:       $ => token(prec(1, /Projectile/i)),

    kw_states:     $ => token(prec(1, /states/i)),
    kw_goto:       $ => token(prec(1, /goto/i)),
    kw_stop:       $ => token(prec(1, /stop/i)),
    kw_loop:       $ => token(prec(1, /loop/i)),
    kw_wait:       $ => token(prec(1, /wait/i)),
    kw_fail:       $ => token(prec(1, /fail/i)),
    kw_random:     $ => token(prec(1, /random/i)),
    kw_bright:     $ => token(prec(1, /bright/i)),
    kw_fast:       $ => token(prec(1, /fast/i)),
    kw_slow:       $ => token(prec(1, /slow/i)),
    kw_no_delay:   $ => token(prec(1, /noDelay/i)),
    kw_can_raise:  $ => token(prec(1, /canRaise/i)),
    kw_offset:     $ => token(prec(1, /offset/i)),
    kw_light:      $ => token(prec(1, /light/i)),
  }
});
