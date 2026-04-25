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
      // i need to alias everything so highlighting can work . the cost of being case-insensitive :unamused:
      seq($.kw_class, $.identifier, optional(seq(':', $.instance_type)), repeat($.class_definition_flags)),
      seq(choice($.kw_extend, $.kw_mixin), $.kw_class, $.identifier),
    ),

    _class_content: $ => choice(
      $.constant_definition,
      $.default_block,
      $.enumeration_definition,
      $.flag_definition,
      $.member_declaration,
      $.method_definition,
      $.property_definition,
      $.state_block,
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
      prec.left(15, seq($._expression, '(', optional($.argument_list), ')')),
      prec.left(15, seq($.type, '(', $._expression, ')')),
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

    kw_const:  $ => /const/i,
    kw_void:   $ => /void/i,
    kw_void_ptr:   $ => /voidPtr/i,
    kw_false:  $ => /false/i,
    kw_true:   $ => /true/i,
    kw_null:   $ => /null/i,

    kw_struct: $ => /struct/i,

    kw_double:       $ => /double/i,
    kw_float:        $ => /float/i,
    kw_float64:      $ => /float64/i,
    kw_float32:      $ => /float32/i,
    kw_int:          $ => /int/i,
    kw_uint:         $ => /uint/i,
    kw_int16:        $ => /int16/i,
    kw_uint16:       $ => /uint16/i,
    kw_int8:         $ => /int8/i,
    kw_uint8:        $ => /uint8/i,
    kw_sbyte:        $ => /sbyte/i,
    kw_byte:         $ => /byte/i,
    kw_short:        $ => /short/i,
    kw_ushort:       $ => /ushort/i,
    kw_name:         $ => /name/i,
    kw_boolean:      $ => /bool/i,
    kw_sprite_id:    $ => /spriteId/i,
    kw_texture_id:   $ => /textureId/i,
    kw_sound:        $ => /sound/i,
    kw_state_label:  $ => /stateLabel/i,
    kw_color:        $ => /color/i,
    kw_let:          $ => /let/i,
    kw_vector2:      $ => /vector2/i,
    kw_vector3:      $ => /vector3/i,
    kw_array:        $ => /array/i,
    kw_read_only:    $ => /readOnly/i,

    kw_super:  $ => /super/i,

    kw_align_of:  $ => /alignOf/i,
    kw_size_of:   $ => /sizeOf/i,
    kw_cross:     $ => /cross/i,
    kw_dot:       $ => /dot/i,
    kw_is:        $ => /is/i,

    kw_enum:     $ => /enum/i,
    kw_flagdef:  $ => /flagDef/i,
    kw_property: $ => /property/i,

    kw_if:        $ => /if/i,
    kw_else:      $ => /else/i,
    kw_switch:    $ => /switch/i,
    kw_case:      $ => /case/i,
    kw_default:   $ => /default/i,

    // common flags
    kw_native:       $ => /native/i,
    kw_clear_scope:  $ => /clearScope/i,
    kw_play:         $ => /play/i,
    kw_private:      $ => /private/i,
    kw_protected:    $ => /protected/i,
    kw_static:       $ => /static/i,
    kw_ui:           $ => /ui/i,

    // member dec flags
    kw_internal:   $ => /internal/i,
    kw_latent:     $ => /latent/i,
    kw_transient:  $ => /transient/i,
    kw_meta:       $ => /meta/i,

    // method def flags
    kw_action:         $ => /action/i,
    kw_final:          $ => /final/i,
    kw_override:       $ => /override/i,
    kw_var_arg:        $ => /varArg/i,
    kw_virtual:        $ => /virtual/i,
    kw_virtual_scope:  $ => /virtualScope/i,

    // flow
    kw_for:      $ => /for/i,
    kw_foreach:  $ => /foreach/i,
    kw_while:    $ => /while/i,
    kw_until:    $ => /until/i,
    kw_do:       $ => /do/i,

    kw_continue: $ => /continue/i,
    kw_break:    $ => /break/i,
    kw_return:   $ => /return/i,

    kw_deprecated: $ => /deprecated/i,
    kw_actor:    $ => /actor/i,
    kw_item:     $ => /item/i,
    kw_overlay:  $ => /overlay/i,
    kw_weapon:   $ => /weapon/i,

    // class flags
    kw_class:    $ => /class/i,
    kw_extend:   $ => /extend/i,
    kw_mixin:    $ => /mixin/i,
    kw_abstract: $ => /abstract/i,
    kw_native:   $ => /native/i,
    kw_play:     $ => /play/i,
    kw_replaces: $ => /replaces/i,
    kw_version:  $ => /version/i,

    kw_default:          $ => /default/i,
    kw_damage_function:  $ => /DamageFunction/i,
    kw_clear_flags:      $ => /ClearFlags/i,
    kw_monster:          $ => /Monster/i,
    kw_projectile:       $ => /Projectile/i,

    kw_states:     $ => /states/i,
    kw_goto:       $ => /goto/i,
    kw_stop:       $ => /stop/i,
    kw_loop:       $ => /loop/i,
    kw_wait:       $ => /wait/i,
    kw_fail:       $ => /fail/i,
    kw_random:     $ => /random/i,
    kw_bright:     $ => /bright/i,
    kw_fast:       $ => /fast/i,
    kw_slow:       $ => /slow/i,
    kw_no_delay:   $ => /noDelay/i,
    kw_can_raise:  $ => /canRaise/i,
    kw_offset:     $ => /offset/i,
    kw_light:      $ => /light/i,
  }
});
