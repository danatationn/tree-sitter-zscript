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
    [$.foreach_loop_item, $.instance_type],
    [$.foreach_loop_item, $.instance_type, $.variable_name],
    [$.for_loop_statement, $.for_loop_initializer],
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
      seq('class', $.identifier, optional(seq(':', $.instance_type)), repeat($.class_definition_flags)),
      seq('extend', 'class', $.identifier),
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
      seq('const', field('name', $.identifier), '=', field('value', $._expression), ';'),
      $.static_array_definition,
    ),

    default_block: $ => seq(
      choice('default', 'Default'),
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
      seq('DamageFunction', $._expression, ';'),
    ),
    default_special_property: $ => /ClearFlags|Monster|Projectile/,

    enumeration_definition: $ => seq(
      'enum',
      $.identifier,
      optional(seq(':', $.integer_type)),
      '{',
      seq($.enumerator, repeat(seq(',', $.enumerator)), optional(',')),
      '}',
    ),
    enumerator: $ => seq(
      $.identifier,
      optional(seq('=', $.constant_expression))
    ),

    flag_definition: $ => seq(
      'flagDef',
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
      optional('const'),
      choice(seq('{', repeat($._statement), '}'), ';'),
    )),
    method_argument_list: $ => prec.left(choice(
      seq($.type, $.variable_name, repeat(seq(',', $.method_argument_list))),
      seq($.type, $.variable_name, '=', $.constant_expression, repeat(seq(',', $.method_argument_list))),
    )),
    method_argument_list_or_void: $ => choice(
      $.method_argument_list,
      'void',
    ),

    property_definition: $ => seq(
      'property', $.identifier, ':', $.identifier, repeat(seq(',', $.identifier)), ';',
    ),

    // states block: parens + action scope are optional (bare `States { }` is valid)
    state_block: $ => seq(
      choice('states', 'States'),
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
      seq(/[Gg]oto/, $.identifier, optional(seq('+', $.integer_literal)), optional(';')),
      seq(/[Ss]top|[Ll]oop|[Ww]ait|[Ff]ail/, optional(';')),
    ),
    state_time: $ => choice(
      seq('-', $.integer_literal),
      $.integer_literal,
      seq('random', '(', $.integer_literal, ',', $.integer_literal, ')'),
    ),
    state_option: $ => choice(
      /[Bb]right|[Ff]ast|[Ss]low|[Nn]oDelay|[Cc]anRaise/,
      seq(/[Oo]ffset/, '(', $.integer_literal, ',', $.integer_literal, ')'),
      seq(/[Ll]ight/, '(', $.string_literal, repeat(seq(',', $.string_literal)), ')'),
    ),
    // state function: either nothing (;), a call without trailing ;, or an inline block
    state_function: $ => choice(
      ';',
      seq($.identifier, '(', optional($.argument_list), ')'),
      seq('{', repeat($._statement), '}'),
    ),

    structure_definition: $ => seq('struct', $.identifier, repeat($.structure_flag), '{', repeat($.structure_content), '}', optional(';')),
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
      'super',
      $.literal,
      $.vector_literal_expression,
      $.color_literal_expression,

      seq('(', $._expression, ')'),

      // postfix
      prec.left(15, seq($._expression, '(', optional($.argument_list), ')')),
      prec.left(15, seq($.type, '(', $._expression, ')')),
      prec.left(15, seq('(', 'class', '<', $.type, '>', ')', '(', $._expression, ')')),
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
      prec.right(14, seq('alignOf', $._expression)),
      prec.right(14, seq('sizeOf', $._expression)),

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
      prec.left(10, seq($._expression, 'cross', $._expression)),
      prec.left(10, seq($._expression, 'dot', $._expression)),
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
      prec.left(8, seq($._expression, 'is', $._expression)),
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

    block: $ => seq('{', repeat($._statement), '}'),

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
    conditional_statement: $ => prec.right(seq('if', '(', $._expression, ')', $._statement, optional(seq('else', $._statement)))),
    switch_statement: $ => seq('switch', '(', $._expression, ')', $._statement),
    switch_case: $ => seq('case', $._expression, ':'),
    switch_default: $ => seq('default', ':'),

    _loop_statement: $ => choice($.foreach_loop_statement, $.for_loop_statement, $.while_loop_statement, $.do_while_loop_statement),
    for_loop_statement: $ => seq(
      'for', '(', optional($.for_loop_initializer), ';', optional($._expression), ';', optional($.for_loop_update), ')',
      $._statement
    ),
    for_loop_initializer: $ => choice($.for_loop_local_variable_statement, $.for_loop_update),
    for_loop_update: $ => seq($._expression, repeat(seq(',', $._expression))),
    foreach_loop_statement: $ => seq(
      'foreach', '(', repeat1(seq($.foreach_loop_item, repeat(seq(',', $.foreach_loop_item)))), ':', $._expression, ')',
      $._statement
    ),
    foreach_loop_declaration: $ => seq($.foreach_loop_item, repeat(seq(',', $.foreach_loop_item))),
    foreach_loop_item: $ => seq(optional($.type), $.identifier, optional(seq('[', $._expression, ']'))),
    while_loop_statement: $ => choice(
      seq('while', '(', $._expression, ')', $._statement),
      seq('until', '(', $._expression, ')', $._statement),
    ),
    do_while_loop_statement: $ => choice(
      seq('do', $._statement, 'while', '(', $._expression, ')'),
      seq('do', $._statement, 'until', '(', $._expression, ')'),
    ),

    _flow_statement: $ => choice($.continue_flow_statement, $.break_flow_statement, $.return_flow_statement),
    continue_flow_statement: $ => seq('continue', ';'),
    break_flow_statement: $ => seq('break', ';'),
    return_flow_statement: $ => seq('return', optional(seq($._expression, repeat(seq(',', $._expression)))), ';'),

    for_loop_local_variable_statement:  $ => seq($.type, $.local_variable_initializer, repeat(seq(',', $.local_variable_initializer))),
    local_variable_statement:           $ => seq($.type, $.local_variable_initializer, repeat(seq(',', $.local_variable_initializer)), ';'),
    local_variable_initializer:         $ => seq($.variable_name, optional(seq('=', $._expression))),

    multi_assignment_statement: $ => seq('[', $._expression, repeat(seq(',', $._expression)), ']', '=', $._expression, ';'),
    null_statement: $ => ';',
    static_array_definition: $ => seq('static', 'const', $.type, $.variable_name, '=', '{', $.constant_expression, repeat(seq(',', $.constant_expression)), '}', ';'),

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
      'void',
    ),

    numeric_type: $ => choice($.floating_point_type, $.integer_type),
    floating_point_type: $ => /double|float|float64|float32/,
    integer_type: $ => /int|uint|int16|uint16|int8|uint8|sbyte|byte|short|ushort/,
    string_type: $ => 'string',
    name_type: $ => 'name',
    boolean_type: $ => 'bool',
    integer_like_reference_type: $ => /spriteId|textureId/,
    string_like_reference_type: $ => /sound|stateLabel/,
    color_type: $ => 'color',
    let_type: $ => 'let',
    vector_type: $ => /vector2|vector3/,
    class_reference_type: $ => seq('class', optional(seq('<', $.type, '>'))),
    native_pointer_type: $ => choice(seq('@', $.type), 'voidPtr'),
    dynamic_array_type: $ => seq('array', '<', $.type, '>'),
    read_only_type: $ => seq('readOnly', '<', $.type, '>'),
    instance_type: $ => prec.left(seq(optional('.'), $.identifier, repeat(seq('.', $.identifier)))),
    variable_name: $ => seq($.identifier, repeat(seq('[', optional($.constant_expression), ']'))),
    fixed_array_type: $ => seq($.identifier, repeat1(seq('[', optional($.constant_expression), ']'))),

    // FLAGS //

    class_definition_flags: $ => choice(
      'abstract', 'native', 'play', 'ui',
      seq('replaces', $.identifier),
      seq('version', $.string_literal),
    ),
    member_declaration_flag: $ => choice(
      'internal', 'latent', 'meta', 'native', 'play', 'private', 'protected', 'readOnly', 'transient', 'ui',
      $.deprecated_flag, $.version_flag,
    ),
    method_definition_flag: $ => choice(
      'action', 'clearScope', 'final', 'native', 'override', 'play', 'private', 'protected', 'static', 'ui', 'varArg', 'virtual', 'virtualScope',
      $.deprecated_flag, $.version_flag, $.action_flag,
    ),
    structure_flag: $ => choice(
      'clearScope', 'native', 'play', 'ui',
      $.version_flag,
    ),

    deprecated_flag: $ => seq('deprecated', '(', $.string_literal, optional(seq(',', $.string_literal)), ')'),
    version_flag: $ => seq('version', '(', $.string_literal, ')'),
    action_flag: $ => seq('action', '(', $.action_scope, repeat(seq(',', $.action_scope)), ')'),
    action_scope: $ => /actor|item|overlay|weapon/,

    // LITERALS //

    literal: $ => choice(
      $.string_literal, $.integer_literal, $.name_literal, $.floating_point_literal, $.boolean_literal, $.null_literal,
    ),

    vector_literal_expression: $ => choice(
      seq('(', $._expression, ',', $._expression, optional(seq(',', $._expression)), ')'),
    ),
    color_literal_expression: $ => seq(
      'color', '(', $._expression, ',', $._expression, ',', $._expression, optional(seq(',', $._expression)), ')',
    ),
    constant_expression: $ => $._expression,
    string_literal: $ => /"[^"]*"/,

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

    boolean_literal: $ => /false|true/,

    name_literal: $ => seq('\'', $.name_character, '\''),
    name_character: $ => choice(
      '\\\'',
      /[\s\S]/,
    ),

    null_literal: $ => 'null',

    // TOKENS //

    line_comment:  $ => token(seq('//', /.*/)),
    block_comment: $ => token(seq('/*', /[^*]*\*+([^/*][^*]*\*+)*/, '/')),
  }
});
