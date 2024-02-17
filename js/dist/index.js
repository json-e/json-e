(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.jsone = factory());
})(this, (function () { 'use strict';

    var parser = {};

    var AST = {};

    class ASTNode {
        constructor(token) {
            this.token = token;
            this.constructorName = 'ASTNode';
        }
    }

    let Primitive$1 = ASTNode;

    class BinOp$1 extends ASTNode {
        constructor(token, left, right) {
            super(token);
            this.constructorName = 'BinOp';
            this.left = left;
            this.right = right;
        }
    }

    class UnaryOp$1 extends ASTNode {
        constructor(token, expr) {
            super(token);
            this.constructorName = 'UnaryOp';
            this.expr = expr;
        }
    }

    class FunctionCall$1 extends ASTNode {
        constructor(token, name, args) {
            super(token);
            this.constructorName = 'FunctionCall';
            this.name = name;
            this.args = args;
        }
    }

    class ContextValue$1 {
        constructor(token) {
            this.token = token;
            this.constructorName = 'ContextValue';
        }
    }

    class List$1 extends ASTNode {
        constructor(token, list) {
            super(token);
            this.constructorName = 'List';
            this.list = list;
        }
    }

    class ValueAccess$1 extends ASTNode {
        constructor(token, arr, isInterval, left, right) {
            super(token);
            this.constructorName = 'ValueAccess';
            this.isInterval = isInterval;
            this.arr = arr;
            this.left = left;
            this.right = right;

        }
    }

    class Object$2 extends ASTNode {
        constructor(token, obj) {
            super(token);
            this.constructorName = 'Object';
            this.obj = obj;
        }
    }

    AST.ASTNode = ASTNode;
    AST.BinOp = BinOp$1;
    AST.UnaryOp = UnaryOp$1;
    AST.Primitive = Primitive$1;
    AST.FunctionCall = FunctionCall$1;
    AST.ContextValue = ContextValue$1;
    AST.ValueAccess = ValueAccess$1;
    AST.List = List$1;
    AST.Object = Object$2;

    class JSONTemplateError$1 extends Error {
      constructor(message) {
        super(message);
        this.location = [];
      }

      add_location(loc) {
        this.location.unshift(loc);
      }

      toString() {
        if (this.location.length) {
          return `${this.name} at template${this.location.join('')}: ${this.message}`;
        } else {
          return `${this.name}: ${this.message}`;
        }
      }
    }

    class SyntaxError$3 extends JSONTemplateError$1 {
      constructor(message) {
        super(message);
        this.message = message;
        this.name = 'SyntaxError';
      }
    }

    class BaseError extends JSONTemplateError$1 {
      constructor(message) {
        super(message);
        this.message = message;
        this.name = 'BaseError';
      }
    }

    class InterpreterError$1 extends BaseError {
      constructor(message) {
        super(message);
        this.name = 'InterpreterError';
      }
    }

    class TemplateError$1 extends BaseError {
      constructor(message) {
        super(message);
        this.name = 'TemplateError';
      }
    }

    class BuiltinError$1 extends BaseError {
      constructor(message) {
        super(message);
        this.name = 'BuiltinError';
      }
    }

    var error = {JSONTemplateError: JSONTemplateError$1, SyntaxError: SyntaxError$3, InterpreterError: InterpreterError$1, TemplateError: TemplateError$1, BuiltinError: BuiltinError$1};

    const {UnaryOp, BinOp, Primitive, ContextValue, FunctionCall, ValueAccess, List, Object: Object$1} = AST;
    const {SyntaxError: SyntaxError$2} = error;

    let syntaxRuleError$1 = (token, expects) => {
        expects.sort();
        return new SyntaxError$2(`Found: ${token.value} token, expected one of: ${expects.join(', ')}`, token);
    };

    class Parser$1 {
        constructor(tokenizer, source, offset = 0) {
            this._source = source;
            this._tokenizer = tokenizer;
            this.current_token = this._tokenizer.next(this._source, offset);
            this.unaryOpTokens = ["-", "+", "!"];
            this.primitivesTokens = ["number", "null", "true", "false", "string"];
            this.operations = [["||"], ["&&"], ["in"], ["==", "!="], ["<", ">", "<=", ">="], ["+", "-"], ["*", "/"], ["**"]];
            this.expectedTokens = ["!", "(", "+", "-", "[", "false", "identifier", "null", "number", "string", "true", "{"];

        }

        takeToken(...kinds) {
            if (this.current_token == null) {
                throw new SyntaxError$2('Unexpected end of input');
            }

            if (kinds.length > 0 && kinds.indexOf(this.current_token.kind) === -1) {
                throw syntaxRuleError$1(this.current_token, kinds);
            }
            try {
                this.current_token = this._tokenizer.next(this._source, this.current_token.end);
            } catch (err) {
                throw err;
            }
        }

        parse(level = 0) {
            //expr : logicalAnd (OR logicalAnd)*
            //logicalAnd : inStatement (AND inStatement)*
            //inStatement : equality (IN equality)*
            //equality : comparison (EQUALITY | INEQUALITY  comparison)*
            //comparison : addition (LESS | GREATER | LESSEQUAL | GREATEREQUAL addition)*
            //addition : multiplication (PLUS | MINUS multiplication)* "
            //multiplication : exponentiation (MUL | DIV exponentiation)*
            //exponentiation : propertyAccessOrFunc (EXP exponentiation)*
            let node;
            if (level == this.operations.length - 1) {
                node = this.parsePropertyAccessOrFunc();
                let token = this.current_token;

                for (; token != null && this.operations[level].indexOf(token.kind) !== -1; token = this.current_token) {
                    this.takeToken(token.kind);
                    node = new BinOp(token, this.parse(level), node);
                }
            } else {
                node = this.parse(level + 1);
                let token = this.current_token;

                for (; token != null && this.operations[level].indexOf(token.kind) !== -1; token = this.current_token) {
                    this.takeToken(token.kind);
                    node = new BinOp(token, node, this.parse(level + 1));
                }
            }

            return node
        }

        parsePropertyAccessOrFunc() {
            let node = this.parseUnit();
            let operators = ["[", "(", "."];
            let rightPart;
            for (let token = this.current_token; token != null && operators.indexOf(token.kind) !== -1; token = this.current_token) {
                if (token.kind == "[") {
                    node = this.parseAccessWithBrackets(node);
                } else if (token.kind == ".") {
                    token = this.current_token;
                    this.takeToken(".");
                    rightPart = new Primitive(this.current_token);
                    this.takeToken("identifier");
                    node = new BinOp(token, node, rightPart);
                } else if (token.kind == "(") {
                    node = this.parseFunctionCall(node);
                }
            }
            return node
        }


        parseUnit() {
            // unit : unaryOp unit | primitives | contextValue | LPAREN expr RPAREN | list | object
            let token = this.current_token;
            let node;
            let isUnaryOpToken = this.unaryOpTokens.indexOf(token.kind) !== -1;
            let isPrimitivesToken = this.primitivesTokens.indexOf(token.kind) !== -1;
            if (this.current_token == null) {
                throw new SyntaxError$2('Unexpected end of input');
            }
            if (isUnaryOpToken) {
                this.takeToken(token.kind);
                node = new UnaryOp(token, this.parseUnit());
            } else if (isPrimitivesToken) {
                this.takeToken(token.kind);
                node = new Primitive(token);
            } else if (token.kind == "identifier") {
                this.takeToken(token.kind);
                node = new ContextValue(token);
            } else if (token.kind == "(") {
                this.takeToken("(");
                node = this.parse();
                if (node == null) {
                    throw syntaxRuleError$1(this.current_token, this.expectedTokens);
                }
                this.takeToken(")");
            } else if (token.kind == "[") {
                node = this.parseList();
            } else if (token.kind == "{") {
                node = this.parseObject();
            }
            return node
        }

        parseFunctionCall(name) {
            //    functionCall: LPAREN (expr ( COMMA expr)*)? RPAREN
            let token = this.current_token;
            let node;
            let args = [];
            this.takeToken("(");

            if (this.current_token.kind != ")") {
                node = this.parse();
                args.push(node);

                while (this.current_token != null && this.current_token.kind == ",") {
                    if (args[args.length - 1] == null) {
                        throw syntaxRuleError$1(this.current_token, this.expectedTokens);
                    }
                    this.takeToken(",");
                    node = this.parse();
                    args.push(node);
                }
            }
            this.takeToken(")");

            node = new FunctionCall(token, name, args);

            return node
        }

        parseList() {
            //    list : LSQAREBRAKET (expr ( COMMA expr)*)? RSQAREBRAKET)
            let node;
            let arr = [];
            let token = this.current_token;
            this.takeToken("[");

            if (this.current_token.kind != "]") {
                node = this.parse();
                arr.push(node);

                while (this.current_token.kind == ",") {
                    if (arr[arr.length - 1] == null) {
                        throw syntaxRuleError$1(this.current_token, this.expectedTokens);
                    }
                    this.takeToken(",");
                    node = this.parse();
                    arr.push(node);
                }
            }
            this.takeToken("]");
            node = new List(token, arr);
            return node
        }

        parseAccessWithBrackets(node) {
            //    valueAccess : LSQAREBRAKET expr |(expr? SEMI expr?)  RSQAREBRAKET)
            let leftArg = null, rightArg = null;
            let token = this.current_token;
            let isInterval = false;

            this.takeToken("[");
            if (this.current_token.kind == "]") {
                throw syntaxRuleError$1(this.current_token, this.expectedTokens);
            }

            if (this.current_token.kind != ":") {
                leftArg = this.parse();
            }
            if (this.current_token.kind == ":") {
                isInterval = true;
                this.takeToken(":");
            }
            if (this.current_token.kind != "]") {
                rightArg = this.parse();
            }

            if (isInterval && rightArg == null && this.current_token.kind != "]") {
                throw syntaxRuleError$1(this.current_token, this.expectedTokens);
            }
            this.takeToken("]");
            node = new ValueAccess(token, node, isInterval, leftArg, rightArg);

            return node;
        }

        parseObject() {
            //    object : LCURLYBRACE ( STR | ID SEMI expr (COMMA STR | ID SEMI expr)*)? RCURLYBRACE (DOT ID)?
            let node;
            let obj = {};
            let key, value;
            let objToken = this.current_token;
            this.takeToken("{");
            let token = this.current_token;

            while (token != null && (token.kind == "string" || token.kind == "identifier")) {
                key = token.value;
                if (token.kind == "string") {
                    key = parseString(key);
                }
                this.takeToken(token.kind);
                this.takeToken(":");
                value = this.parse();
                if (value == null) {
                    throw syntaxRuleError$1(this.current_token, this.expectedTokens);
                }
                obj[key] = value;
                if (this.current_token != null && this.current_token.kind == "}") {
                    break;
                } else {
                    this.takeToken(",");
                }
                token = this.current_token;
            }
            this.takeToken("}");
            node = new Object$1(objToken, obj);

            return node;
        }

    }

    let
        parseString = (str) => {
            return str.slice(1, -1);
        };


    parser.Parser = Parser$1;

    var {SyntaxError: SyntaxError$1} = error;

    let escapeRegex = (s) => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

    let isRegEx = (re) => {
      if (typeof re !== 'string') {
        return false;
      }
      try {
        new RegExp(`^${re}$`);
      } catch (e) {
        return false;
      }
      return true;
    };

    let isNonCaptureRegex = (re) => {
      return isRegEx(re) && (new RegExp(`^(?:|${re})$`)).exec('').length === 1;
    };

    let indexOfNotUndefined = (a, start = 0) => {
      let n = a.length;
      for (let i = start; i < n; i++) {
        if (a[i] !== undefined) {
          return i;
        }
      }
      return -1;
    };

    /**
     * Custom implementation of `assert` to avoid pulling in a
     * polyfill on browsers
     */
    const assert = prop => {
      if (!prop) {
        throw new Error('Token configuration is invalid');
      }
    };

    class Tokenizer$1 {
      constructor(options = {}) {
        options = Object.assign({}, {
          ignore: null,
          patterns: {},
          tokens: [],
        }, options);

        // Validate options
        assert(options.ignore === null || isNonCaptureRegex(options.ignore));
        assert(options.patterns instanceof Object);
        for (let pattern of Object.keys(options.patterns)) {
          assert(isNonCaptureRegex(options.patterns[pattern]));
        }
        assert(options.tokens instanceof Array);
        options.tokens.forEach(tokenName => assert(typeof tokenName === 'string'));

        // Build regular expression
        this._tokens = options.tokens;
        this._hasIgnore = options.ignore ? 1 : 0;
        this._regex = new RegExp('^(?:' + [
          this._hasIgnore ? `(${options.ignore})` : null,
          ...this._tokens.map(tokenName => {
            return `(${options.patterns[tokenName] || escapeRegex(tokenName)})`;
          }),
        ].filter(e => e !== null).join('|') + ')');
      }

      next(source, offset = 0) {
        let m, i;
        do {
          m = this._regex.exec(source.slice(offset));
          if (m === null) {
            // If not at end of input throw an error
            if (source.slice(offset) !== '') {
              throw new SyntaxError$1(`Unexpected input for '${source}' at '${source.slice(offset)}'`,
                {start: offset, end: source.length});
            }
            return null;
          }
          i = indexOfNotUndefined(m, 1);
          offset += m[0].length;
        } while (this._hasIgnore && i === 1);
        return {
          kind:   this._tokens[i - 1 - this._hasIgnore],
          value:  m[i],
          start:  offset - m[0].length,
          end:    offset,
        };
      }

      tokenize(source, offset = 0) {
        let token = {end: offset};
        let tokens = [];
        while (token = this.next(source, token.end)) {
          tokens.push(token);
        }
        return tokens;
      }
    }

    // Export Tokenizer
    var tokenizer$1 = Tokenizer$1;

    var interpreter = {};

    let utils = {
      isString:   expr => typeof expr === 'string',
      isNumber:   expr => typeof expr === 'number',
      isInteger:  expr => typeof expr === 'number' && Number.isInteger(expr),
      isBool:     expr => typeof expr === 'boolean',
      isNull:     expr => expr === null,
      isArray:    expr => expr instanceof Array,
      isObject:   expr => expr instanceof Object && !(expr instanceof Array) && !(expr instanceof Function),
      isFunction: expr => expr instanceof Function,
      isTruthy: expr => {
        return expr!== null && (
          utils.isArray(expr) && expr.length > 0 ||
          utils.isObject(expr) && Object.keys(expr).length > 0 ||
          utils.isString(expr) && expr.length > 0 ||
          utils.isNumber(expr) && expr !== 0 ||
          utils.isBool(expr) && expr ||
          utils.isFunction(expr)
        );
      },
    };

    var typeUtils = utils;

    const {isFunction: isFunction$2, isObject: isObject$2, isString: isString$2, isArray: isArray$3, isNumber: isNumber$2, isInteger, isTruthy: isTruthy$1} = typeUtils;
    const {InterpreterError} = error;

    let expectationError = (operator, expectation) => new InterpreterError(`${operator} expects ${expectation}`);

    class Interpreter$1 {
        constructor(context) {
            this.context = context;
        }

        visit(node) {
            let funcName = "visit_" + node.constructorName;
            return this[funcName](node);
        }

        visit_ASTNode(node) {
            let str;
            switch (node.token.kind) {
                case("number"):
                    return +node.token.value;
                case("null"):
                    return null;
                case("string"):
                    str = node.token.value.slice(1, -1);
                    return str;
                case("true"):
                    return true;
                case("false"):
                    return false;
                case("identifier"):
                    return node.token.value;
            }
        }

        visit_UnaryOp(node) {
            let value = this.visit(node.expr);
            switch (node.token.kind) {
                case ("+"):
                    if (!isNumber$2(value)) {
                        throw expectationError('unary +', 'number');
                    }
                    return +value;
                case ("-"):
                    if (!isNumber$2(value)) {
                        throw expectationError('unary -', 'number');
                    }
                    return -value;
                case ("!"):
                    return !isTruthy$1(value)
            }
        }

        visit_BinOp(node) {
            let left = this.visit(node.left);
            let right;
            switch (node.token.kind) {
                case ("||"):
                    return isTruthy$1(left) || isTruthy$1(this.visit(node.right));
                case ("&&"):
                    return isTruthy$1(left) && isTruthy$1(this.visit(node.right));
                default:
                    right = this.visit(node.right);
            }

            switch (node.token.kind) {
                case ("+"):
                    testMathOperands("+", left, right);
                    return left + right;
                case ("-"):
                    testMathOperands("-", left, right);
                    return left - right;
                case ("/"):
                    testMathOperands("/", left, right);
                    if (right == 0) {
                        throw new InterpreterError("division by zero");
                    }
                    return left / right;
                case ("*"):
                    testMathOperands("*", left, right);
                    return left * right;
                case (">"):
                    testComparisonOperands(">", left, right);
                    return left > right;
                case ("<"):
                    testComparisonOperands("<", left, right);
                    return left < right;
                case (">="):
                    testComparisonOperands(">=", left, right);
                    return left >= right;
                case ("<="):
                    testComparisonOperands("<=", left, right);
                    return left <= right;
                case ("!="):
                    testComparisonOperands("!=", left, right);
                    return !isEqual(left, right);
                case ("=="):
                    testComparisonOperands("==", left, right);
                    return isEqual(left, right);
                case ("**"):
                    testMathOperands("**", left, right);
                    return Math.pow(right, left);
                case ("."): {
                    if (isObject$2(left)) {
                        if (left.hasOwnProperty(right)) {
                            return left[right];
                        }
                        throw new InterpreterError(`object has no property "${right}"`);
                    }
                    throw expectationError('infix: .', 'objects');
                }
                case ("in"): {
                    if (isObject$2(right)) {
                        if (!isString$2(left)) {
                            throw expectationError('Infix: in-object', 'string on left side');
                        }
                        right = Object.keys(right);
                    } else if (isString$2(right)) {
                        if (!isString$2(left)) {
                            throw expectationError('Infix: in-string', 'string on left side');
                        }
                        return right.indexOf(left) !== -1;
                    } else if (!isArray$3(right)) {
                        throw expectationError('Infix: in', 'Array, string, or object on right side');
                    }
                    return right.some(r => isEqual(left, r));
                }
            }
        }

        visit_List(node) {
            let list = [];

            if (node.list[0] !== undefined) {
                node.list.forEach(function (item) {
                    list.push(this.visit(item));
                }, this);
            }

            return list
        }

        visit_ValueAccess(node) {
            let array = this.visit(node.arr);
            let left = 0, right = null;

            if (node.left) {
                left = this.visit(node.left);
            }
            if (node.right) {
                right = this.visit(node.right);
            }
            const slice_or_index = (isInterval, value, left, right) => {
                if (left < 0) {
                    left = value.length + left;
                    if (left < 0)
                        left = 0;
                }
                if (isInterval) {
                    right = right === null ? value.length : right;
                    if (right < 0) {
                        right = value.length + right;
                        if (right < 0)
                            right = 0;
                    }
                    if (left > right) {
                        left = right;
                    }
                    if (!isInteger(left) || !isInteger(right)) {
                        throw new InterpreterError('cannot perform interval access with non-integers');
                    }
                    return value.slice(left, right)
                }
                if (!isInteger(left)) {
                    throw new InterpreterError('should only use integers to access arrays or strings');
                }
                if (left >= value.length) {
                    throw new InterpreterError('index out of bounds');
                }
                return value[left]
            };
            if (isArray$3(array)) {
                return slice_or_index(node.isInterval, array, left, right);
            }
            if (isString$2(array)) {
                // If the string is entirely one-byte characters (i.e. ASCII), we can
                // simply use `String.prototype.slice`.
                /*eslint no-control-regex: "off"*/
                if (/^[\x00-\x7F]*$/.test(array)) {
                    return slice_or_index(node.isInterval, array, left, right);
                }
                // Otherwise, we need to convert it to an array of characters first,
                // slice that, and convert back.
                let res = slice_or_index(node.isInterval, [...array], left, right);
                if (isArray$3(res)) {
                    res = res.join('');
                }
                return res;
            }
            if (!isObject$2(array)) {
                throw expectationError(`infix: "[..]"`, 'object, array, or string');
            }

            if (!isString$2(left)) {
                throw new InterpreterError('object keys must be strings');
            }

            if (array.hasOwnProperty(left)) {
                return array[left];
            } else {
                return null;
            }
        }

        visit_ContextValue(node) {
            if (this.context.hasOwnProperty(node.token.value)) {
                let contextValue = this.context[node.token.value];
                return contextValue
            }
            throw new InterpreterError(`unknown context value ${node.token.value}`);
        }

        visit_FunctionCall(node) {
            let args = [];

            let funcName = this.visit(node.name);
            if (isFunction$2(funcName)) {
                node.args.forEach(function (item) {
                    args.push(this.visit(item));
                }, this);
                if (funcName.hasOwnProperty("jsone_builtin")) {
                    args.unshift(this.context);
                }
                return funcName.apply(null, args);
            } else {
                throw new InterpreterError(`${funcName} is not callable`);
            }
        }

        visit_Object(node) {
            let obj = {};

            for (let key in node.obj) {
                obj[key] = this.visit(node.obj[key]);
            }

            return obj
        }

        interpret(tree) {
            return this.visit(tree);
        }
    }

    let isEqual = (a, b) => {
        if (isArray$3(a) && isArray$3(b) && a.length === b.length) {
            for (let i = 0; i < a.length; i++) {
                if (!isEqual(a[i], b[i])) {
                    return false;
                }
            }
            return true;
        }
        if (isFunction$2(a)) {
            return a === b;
        }
        if (isObject$2(a) && isObject$2(b)) {
            let keys = Object.keys(a).sort();
            if (!isEqual(keys, Object.keys(b).sort())) {
                return false;
            }
            for (let k of keys) {
                if (!isEqual(a[k], b[k])) {
                    return false;
                }
            }
            return true;
        }
        return a === b;
    };

    let testMathOperands = (operator, left, right) => {
        if (operator === '+' && !(isNumber$2(left) && isNumber$2(right) || isString$2(left) && isString$2(right))) {
            throw expectationError('infix: +', 'numbers/strings + numbers/strings');
        }
        if (['-', '*', '/', '**'].some(v => v === operator) && !(isNumber$2(left) && isNumber$2(right))) {
            throw expectationError(`infix: ${operator}`, `number ${operator} number`);
        }
        return
    };

    let testComparisonOperands = (operator, left, right) => {
        if (operator === '==' || operator === '!=') {
            return null;
        }

        let test = ['>=', '<=', '<', '>'].some(v => v === operator)
            && (isNumber$2(left) && isNumber$2(right) || isString$2(left) && isString$2(right));

        if (!test) {
            throw expectationError(`infix: ${operator}`, `numbers/strings ${operator} numbers/strings`);
        }
        return
    };

    interpreter.Interpreter = Interpreter$1;

    // Regular expression matching:
    // A years B months C days D hours E minutes F seconds
    var timeExp = new RegExp([
      '^(\\s*(-|\\+))?',
      '(\\s*(?<years>\\d+)\\s*(y|year|years|yr))?',
      '(\\s*(?<months>\\d+)\\s*(months|month|mo))?',
      '(\\s*(?<weeks>\\d+)\\s*(weeks|week|wk|w))?',
      '(\\s*(?<days>\\d+)\\s*(days|day|d))?',
      '(\\s*(?<hours>\\d+)\\s*(hours|hour|hr|h))?',
      '(\\s*(?<minutes>\\d+)\\s*(minutes|minute|min|m))?',
      '(\\s*(?<seconds>\\d+)\\s*(seconds|second|sec|s))?',
      '\\s*$',
    ].join(''), 'i');

    /** Parse time string */
    var parseTime = function(str) {
      // Parse the string
      var match = timeExp.exec(str || '');
      if (!match) {
        throw new Error('String: \'' + str + '\' isn\'t a time expression');
      }
      // Negate if needed
      var neg = match[2] === '-' ? - 1 : 1;
      // Return parsed values
      let groups = match.groups;
      return {
        years:    parseInt(groups['years']   || 0, 10) * neg,
        months:   parseInt(groups['months']  || 0, 10) * neg,
        weeks:    parseInt(groups['weeks']   || 0, 10) * neg,
        days:     parseInt(groups['days']    || 0, 10) * neg,
        hours:    parseInt(groups['hours']   || 0, 10) * neg,
        minutes:  parseInt(groups['minutes'] || 0, 10) * neg,
        seconds:  parseInt(groups['seconds'] || 0, 10) * neg,
      };
    };

    // Render timespan fromNow as JSON timestamp
    var fromNow$2 = (timespan = '', reference) => {
      let offset = parseTime(timespan);

      // represent months and years as 30 and 365 days, respectively
      offset.days += 30 * offset.months;
      offset.days += 365 * offset.years;

      if (reference) {
        reference = new Date(reference);
      } else {
        reference = new Date();
      }

      var retval = new Date(
        reference.getTime()
        + offset.weeks   * 7 * 24 * 60 * 60 * 1000
        + offset.days        * 24 * 60 * 60 * 1000
        + offset.hours            * 60 * 60 * 1000
        + offset.minutes               * 60 * 1000
        + offset.seconds                    * 1000
      );
      return retval.toJSON();
    };

    var jsonStableStringifyWithoutJsonify = function (obj, opts) {
        if (!opts) opts = {};
        if (typeof opts === 'function') opts = { cmp: opts };
        var space = opts.space || '';
        if (typeof space === 'number') space = Array(space+1).join(' ');
        var cycles = (typeof opts.cycles === 'boolean') ? opts.cycles : false;
        var replacer = opts.replacer || function(key, value) { return value; };

        var cmp = opts.cmp && (function (f) {
            return function (node) {
                return function (a, b) {
                    var aobj = { key: a, value: node[a] };
                    var bobj = { key: b, value: node[b] };
                    return f(aobj, bobj);
                };
            };
        })(opts.cmp);

        var seen = [];
        return (function stringify (parent, key, node, level) {
            var indent = space ? ('\n' + new Array(level + 1).join(space)) : '';
            var colonSeparator = space ? ': ' : ':';

            if (node && node.toJSON && typeof node.toJSON === 'function') {
                node = node.toJSON();
            }

            node = replacer.call(parent, key, node);

            if (node === undefined) {
                return;
            }
            if (typeof node !== 'object' || node === null) {
                return JSON.stringify(node);
            }
            if (isArray$2(node)) {
                var out = [];
                for (var i = 0; i < node.length; i++) {
                    var item = stringify(node, i, node[i], level+1) || JSON.stringify(null);
                    out.push(indent + space + item);
                }
                return '[' + out.join(',') + indent + ']';
            }
            else {
                if (seen.indexOf(node) !== -1) {
                    if (cycles) return JSON.stringify('__cycle__');
                    throw new TypeError('Converting circular structure to JSON');
                }
                else seen.push(node);

                var keys = objectKeys(node).sort(cmp && cmp(node));
                var out = [];
                for (var i = 0; i < keys.length; i++) {
                    var key = keys[i];
                    var value = stringify(node, key, node[key], level+1);

                    if(!value) continue;

                    var keyValue = JSON.stringify(key)
                        + colonSeparator
                        + value;
                    out.push(indent + space + keyValue);
                }
                seen.splice(seen.indexOf(node), 1);
                return '{' + out.join(',') + indent + '}';
            }
        })({ '': obj }, '', obj, 0);
    };

    var isArray$2 = Array.isArray || function (x) {
        return {}.toString.call(x) === '[object Array]';
    };

    var objectKeys = Object.keys || function (obj) {
        var has = Object.prototype.hasOwnProperty || function () { return true };
        var keys = [];
        for (var key in obj) {
            if (has.call(obj, key)) keys.push(key);
        }
        return keys;
    };

    var {BuiltinError} = error;
    var fromNow$1 = fromNow$2;
    var {
      isString: isString$1, isNumber: isNumber$1, isBool: isBool$1,
      isArray: isArray$1, isObject: isObject$1,
      isNull, isFunction: isFunction$1,
    } = typeUtils;

    let types = {
      string: isString$1,
      number: isNumber$1,
      boolean: isBool$1,
      array: isArray$1,
      object: isObject$1,
      null: isNull,
      function: isFunction$1,
    };

    let builtinError = (builtin) => new BuiltinError(`invalid arguments to ${builtin}`);

    var builtins = (context) => {
      let builtins = {};
      let define = (name, context, {
        argumentTests = [],
        minArgs = false,
        variadic = null,
        needsContext = false,
        invoke,
      }) => {
        context[name] = (...args) => {
          let ctx = args.shift();
          if (!variadic && args.length < argumentTests.length) {
            throw builtinError(`builtin: ${name}`, `${args.toString()}, too few arguments`);
          }

          if (minArgs && args.length < minArgs) {
            throw builtinError(`builtin: ${name}: expected at least ${minArgs} arguments`);
          }

          if (variadic) {
            argumentTests = args.map(() => variadic);
          }

          args.forEach((arg, i) => {
            if (!argumentTests[i].split('|').some(test => types[test](arg))) {
              throw builtinError(`builtin: ${name}`, `argument ${i + 1} to be ${argumentTests[i]} found ${typeof arg}`);
            }
          });
          if (needsContext)
            return invoke(ctx, ...args);

          return invoke(...args);
        };
        context[name].jsone_builtin = true;

        return context[name];
      };

      // Math functions
      ['max', 'min'].forEach(name => {
        if (Math[name] == undefined) {
          throw new Error(`${name} in Math undefined`);
        }
        define(name, builtins, {
          minArgs: 1,
          variadic: 'number',
          invoke: (...args) => Math[name](...args),
        });
      });

      ['sqrt', 'ceil', 'floor', 'abs'].forEach(name => {
        if (Math[name] == undefined) {
          throw new Error(`${name} in Math undefined`);
        }
        define(name, builtins, {
          argumentTests: ['number'],
          invoke: num => Math[name](num),
        });
      });

      // String manipulation
      define('lowercase', builtins, {
        argumentTests: ['string'],
        invoke: str => str.toLowerCase(),
      });

      define('uppercase', builtins, {
        argumentTests: ['string'],
        invoke: str => str.toUpperCase(),
      });

      define('str', builtins, {
        argumentTests: ['string|number|boolean|null'],
        invoke: obj => {
          if (obj === null) {
            return 'null';
          }
          return obj.toString();
        },
      });

      define('number', builtins, {
        argumentTests: ['string'],
        invoke: Number,
      });

      define('len', builtins, {
        argumentTests: ['string|array'],
        invoke: obj => Array.from(obj).length,
      });

      define('strip', builtins, {
        argumentTests: ['string'],
        invoke: str => str.trim(),
      });

      define('rstrip', builtins, {
        argumentTests: ['string'],
        invoke: str => str.replace(/\s+$/, ''),
      });

      define('lstrip', builtins, {
        argumentTests: ['string'],
        invoke: str => str.replace(/^\s+/, ''),
      });

      define('split', builtins, {
        minArgs: 2,
        argumentTests: ['string', 'string|number'],
        invoke: (input, delimiter) => input.split(delimiter)
      });

      define('join', builtins, {
        argumentTests: ['array', 'string|number'],
        invoke: (list, separator) => list.join(separator) 
      });

      // Miscellaneous
      define('fromNow', builtins, {
        variadic: 'string',
        minArgs: 1,
        needsContext: true,
        invoke: (ctx, str, reference) => fromNow$1(str, reference || ctx.now),
      });

      define('typeof', builtins, {
        argumentTests: ['string|number|boolean|array|object|null|function'],
        invoke: x => {
          for (let type of ['string', 'number', 'boolean', 'array', 'object', 'function']) {
            if (types[type](x)) {
              return type;
            }
          }
          if (types['null'](x)) {
            return 'null';
          }
          throw builtinError('builtin: typeof');
        },
      });

      define('defined', builtins, {
        argumentTests: ['string'],
        needsContext: true,
        invoke: (ctx, str) => ctx.hasOwnProperty(str)
      });

      return Object.assign({}, builtins, context);
    };

    /* eslint-disable */

    const {Parser} = parser;
    const Tokenizer = tokenizer$1;
    const {Interpreter} = interpreter;
    var fromNow = fromNow$2;
    var stringify = jsonStableStringifyWithoutJsonify;
    var {
      isString, isNumber, isBool,
      isArray, isObject,
      isTruthy, isFunction,
    } = typeUtils;
    var addBuiltins = builtins;
    var {JSONTemplateError, TemplateError, SyntaxError} = error;

    let syntaxRuleError = (token) => {
        return new SyntaxError(`Found: ${token.value} token, expected one of: !=, &&, (, *, **, +, -, ., /, <, <=, ==, >, >=, [, in, ||`);
    };

    function checkUndefinedProperties(template, allowed) {
      var unknownKeys = '';
      var combined = new RegExp(allowed.join('|') + '$');
      for (var key of Object.keys(template).sort()) {
        if (!combined.test(key)) {
          unknownKeys += ' ' + key;
        }
      }
      if (unknownKeys) {
        throw new TemplateError(allowed[0].replace('\\', '') + ' has undefined properties:' + unknownKeys);
      }
    }

    let flattenDeep = (a) => {
      return Array.isArray(a) ? [].concat(...a.map(flattenDeep)) : a;
    };

    let interpolate = (string, context) => {
      let result = '';
      let remaining = string;
      let offset;
      while ((offset = remaining.search(/\$?\${/g)) !== -1) {
        result += remaining.slice(0, offset);

        if (remaining[offset+1] != '$') {
          let v = parseUntilTerminator(remaining.slice(offset + 2), '}', context);
          if (isArray(v.result) || isObject(v.result)) {
            let input = remaining.slice(offset + 2, offset + v.offset);
            throw new TemplateError(`interpolation of '${input}' produced an array or object`);
          }

          // if it is null, result should just be appended with empty string
          if (v.result === null) {
            result += '';
          } else {
            result += v.result.toString();
          }

          remaining = remaining.slice(offset + v.offset + 1);
        } else {
          result += '${';
          remaining = remaining.slice(offset + 3);
        }
      }
      result += remaining;
      return result;
    };

    // Object used to indicate deleteMarker
    let deleteMarker = {};

    let operators = {};

    operators.$eval = (template, context) => {
      checkUndefinedProperties(template, ['\\$eval']);

      if (!isString(template['$eval'])) {
        throw new TemplateError('$eval must be given a string expression');
      }

      return parse(template['$eval'], context);
    };

    operators.$flatten = (template, context) => {
      checkUndefinedProperties(template, ['\\$flatten']);

      let value = render(template['$flatten'], context);

      if (!isArray(value)) {
        throw new TemplateError('$flatten value must evaluate to an array');
      }

      return value.reduce((a, b) => a.concat(b), []);
    };

    operators.$flattenDeep = (template, context) => {
      checkUndefinedProperties(template, ['\\$flattenDeep']);

      let value = render(template['$flattenDeep'], context);

      if (!isArray(value)) {
        throw new TemplateError('$flattenDeep value must evaluate to an array');
      }

      return flattenDeep(value);
    };

    operators.$fromNow = (template, context) => {
      checkUndefinedProperties(template, ['\\$fromNow', 'from']);

      let value = render(template['$fromNow'], context);
      let reference = context.now;
      if (template['from']) {
        reference = render(template['from'], context);
      }
      if (!isString(value)) {
        throw new TemplateError('$fromNow expects a string');
      }
      return fromNow(value, reference);
    };

    operators.$if = (template, context) => {
      checkUndefinedProperties(template, ['\\$if', 'then', 'else']);

      if (!isString(template['$if'])) {
        throw new TemplateError('$if can evaluate string expressions only');
      }
      if (isTruthy(parse(template['$if'], context))) {
        if(template.hasOwnProperty('$then')){
          throw new TemplateError('$if Syntax error: $then: should be spelled then: (no $)')
        }

       return template.hasOwnProperty('then') ? render(template.then, context) : deleteMarker;
      }

      return template.hasOwnProperty('else') ? render(template.else, context) : deleteMarker;
    };

    operators.$json = (template, context) => {
      checkUndefinedProperties(template, ['\\$json']);

      const rendered = render(template['$json'], context);
      if (containsFunctions(rendered)) {
        throw new TemplateError('evaluated template contained uncalled functions');
      }
      return stringify(rendered);
    };

    operators.$let = (template, context) => {
      checkUndefinedProperties(template, ['\\$let', 'in']);

      if (!isObject(template['$let'])) {
        throw new TemplateError('$let value must be an object');
      }
      let variables = {};

      let initialResult = render(template['$let'], context);
      if (!isObject(initialResult)) {
        throw new TemplateError('$let value must be an object');
      }
      Object.keys(initialResult).forEach(key => {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
          throw new TemplateError('top level keys of $let must follow /[a-zA-Z_][a-zA-Z0-9_]*/');
        }else {
          variables[key] = initialResult[key];
        }
      });

      var child_context = Object.assign({}, context, variables);

      if (template.in == undefined) {
        throw new TemplateError('$let operator requires an `in` clause');
      }

      return render(template.in, child_context);
    };

    operators.$map = (template, context) => {
      const EACH_RE = 'each\\(([a-zA-Z_][a-zA-Z0-9_]*)(,\\s*([a-zA-Z_][a-zA-Z0-9_]*))?\\)';
      checkUndefinedProperties(template, ['\\$map', EACH_RE]);
      let value = render(template['$map'], context);
      if (!isArray(value) && !isObject(value)) {
        throw new TemplateError('$map value must evaluate to an array or object');
      }

      if (Object.keys(template).length !== 2) {
        throw new TemplateError('$map must have exactly two properties');
      }

      let eachKey = Object.keys(template).filter(k => k !== '$map')[0];
      let match = /^each\(([a-zA-Z_][a-zA-Z0-9_]*)(,\s*([a-zA-Z_][a-zA-Z0-9_]*))?\)$/.exec(eachKey);
      if (!match) {
        throw new TemplateError('$map requires each(identifier) syntax');
      }

      let x = match[1];
      let i = match[3];
      let each = template[eachKey];

      let object = isObject(value);

      if (object) {
        value = Object.keys(value).map(key => ({key, val: value[key]}));
        let eachValue;
        value = value.map(v => {
          let args = typeof i !== 'undefined' ? {[x]: v.val, [i]: v.key} : {[x]: v};
          eachValue = render(each, Object.assign({}, context, args));
          if (!isObject(eachValue)) {
            throw new TemplateError(`$map on objects expects each(${x}) to evaluate to an object`);
          }
          return eachValue;
        }).filter(v => v !== deleteMarker);
        //return value.reduce((a, o) => Object.assign(a, o), {});
        return Object.assign({}, ...value);
      } else {
        return value.map((v, idx) => {
          let args = typeof i !== 'undefined' ? {[x]: v, [i]: idx} : {[x]: v};
          return render(each, Object.assign({}, context, args));
        }).filter(v => v !== deleteMarker);
      }
    };

    operators.$find = (template, context) => {
      const EACH_RE = 'each\\(([a-zA-Z_][a-zA-Z0-9_]*)(,\\s*([a-zA-Z_][a-zA-Z0-9_]*))?\\)';
      checkUndefinedProperties(template, ['\\$find', EACH_RE]);
      let value = render(template['$find'], context);
      if (!isArray(value)) {
        throw new TemplateError('$find value must evaluate to an array');
      }

      if (Object.keys(template).length !== 2) {
        throw new TemplateError('$find must have exactly two properties');
      }

      let eachKey = Object.keys(template).filter(k => k !== '$find')[0];
      let match = /^each\(([a-zA-Z_][a-zA-Z0-9_]*)(,\s*([a-zA-Z_][a-zA-Z0-9_]*))?\)$/.exec(eachKey);
      if (!match) {
        throw new TemplateError('$find requires each(identifier) syntax');
      }

      if (!isString(template[eachKey])) {
        throw new TemplateError('each can evaluate string expressions only');
      }

      let x = match[1];
      let i = match[3];
      let each = template[eachKey];

      const result = value.find((v, idx) => {
        let args = typeof i !== 'undefined' ? {[x]: v, [i]: idx} : {[x]: v};

        if (isTruthy(parse(each, Object.assign({}, context, args)))) {
          return render(each, Object.assign({}, context, args));
        }
      });

      return result !== undefined ? result : deleteMarker;
    };

    operators.$match = (template, context) => {
      checkUndefinedProperties(template, ['\\$match']);

      if (!isObject(template['$match'])) {
        throw new TemplateError('$match can evaluate objects only');
      }

      const result = [];
      const conditions = template['$match'];

      for (let condition of Object.keys(conditions).sort()) {
        if (isTruthy(parse(condition, context))) {
          result.push(render(conditions[condition], context));
        }
      }

      return result;
    };

    operators.$switch = (template, context) => {
      checkUndefinedProperties(template, [ '\\$switch' ]);

      if (!isObject(template['$switch'])) {
        throw new TemplateError('$switch can evaluate objects only');
      }

      let result = [];
      const conditions = template['$switch'];

      for (let condition of Object.keys(conditions).filter(k => k !== '$default').sort()) {
        if (isTruthy(parse(condition, context))) {
          result.push(render(conditions[condition], context));
        }
      }

      if (result.length > 1) {
        throw new TemplateError('$switch can only have one truthy condition');
      }

      if (result.length === 0 && conditions[ '$default' ]) {
        result.push(render(conditions[ '$default' ], context));
      }

      return result.length > 0 ? result[0] : deleteMarker;
    };

    operators.$merge = (template, context) => {
      checkUndefinedProperties(template, ['\\$merge']);

      let value = render(template['$merge'], context);

      if (!isArray(value) || value.some(o => !isObject(o))) {
        throw new TemplateError('$merge value must evaluate to an array of objects');
      }

      return Object.assign({}, ...value);
    };

    operators.$mergeDeep = (template, context) => {
      checkUndefinedProperties(template, ['\\$mergeDeep']);

      let value = render(template['$mergeDeep'], context);

      if (!isArray(value) || value.some(o => !isObject(o))) {
        throw new TemplateError('$mergeDeep value must evaluate to an array of objects');
      }

      if (value.length === 0) {
        return {};
      }
      // merge two values, preferring the right but concatenating lists and
      // recursively merging objects
      let merge = (l, r) => {
        if (isArray(l) && isArray(r)) {
          return l.concat(r);
        }
        if (isObject(l) && isObject(r)) {
          let res = Object.assign({}, l);
          for (let p in r) { // eslint-disable-line taskcluster/no-for-in
            if (p in l) {
              res[p] = merge(l[p], r[p]);
            } else {
              res[p] = r[p];
            }
          }
          return res;
        }
        return r;
      };
      // start with the first element of the list
      return value.reduce(merge, value.shift());
    };

    operators.$reverse = (template, context) => {
      checkUndefinedProperties(template, ['\\$reverse']);

      let value = render(template['$reverse'], context);

      if (!isArray(value)) {
        throw new TemplateError('$reverse value must evaluate to an array of objects');
      }
      return value.reverse();
    };

    operators.$sort = (template, context) => {
      const BY_RE = 'by\\(([a-zA-Z_][a-zA-Z0-9_]*)\\)';
      checkUndefinedProperties(template, ['\\$sort', BY_RE]);
      let value = render(template['$sort'], context);
      if (!isArray(value)) {
        throw new TemplateError('$sorted values to be sorted must have the same type');
      }

      let byKey = Object.keys(template).filter(k => k !== '$sort')[0];
      let match = /^by\(([a-zA-Z_][a-zA-Z0-9_]*)\)$/.exec(byKey);
      let by;
      if (match) {
        let contextClone = Object.assign({}, context);
        let x = match[1];
        let byExpr = template[byKey];
        by = value => {
          contextClone[x] = value;
          return parse(byExpr, contextClone);
        };
      } else {
        let needBy = value.some(v => isArray(v) || isObject(v));
        if (needBy) {
          throw new TemplateError('$sorted values to be sorted must have the same type');
        }
        by = value => value;
      }

      // tag each value with its `by` value (schwartzian tranform)
      let tagged = value.map(e => [by(e), e]);

      // check types of the `by` values
      if (tagged.length > 0) {
        let eltType = typeof tagged[0][0];
        if (eltType !== 'number' && eltType !== 'string' ||
            tagged.some(e => eltType !== typeof e[0])) {
          throw new TemplateError('$sorted values to be sorted must have the same type');
        }
      }

      // finish the schwartzian transform
      return tagged
        .sort((a, b) => {
          a = a[0];
          b = b[0];
          if (a < b) { return -1; }
          if (a > b) { return 1; }
          return 0;
        })
        .map(e => e[1]);
    };

    let render = (template, context) => {
      if (isNumber(template) || isBool(template) || template === null) {
        return template;
      }
      if (isString(template)) {
        return interpolate(template, context);
      }
      if (isArray(template)) {
        return template.map((v, i) => {
          try {
            return render(v, context);
          } catch (err) {
            if (err instanceof JSONTemplateError) {
              err.add_location(`[${i}]`);
            }
            throw err;
          }
        }).filter((v) => v !== deleteMarker);
      }

      let matches = Object.keys(operators).filter(c => template.hasOwnProperty(c));
      if (matches.length > 1) {
        throw new TemplateError('only one operator allowed');
      }
      if (matches.length === 1) {
        return operators[matches[0]](template, context);
      }

      // clone object
      let result = {};
      for (let key of Object.keys(template)) {
        let value;
        try {
          value = render(template[key], context);
        } catch (err) {
          if (err instanceof JSONTemplateError) {
            if (/^[a-zA-Z][a-zA-Z0-9]*$/.test(key)) {
              err.add_location(`.${key}`);
            } else {
              err.add_location(`[${JSON.stringify(key)}]`);
            }
          }
          throw err;
        }
        if (value !== deleteMarker) {
          if (key.startsWith('$$')) {
            key = key.substr(1);
          } else if (/^\$[a-zA-Z][a-zA-Z0-9]*$/.test(key)) {
            throw new TemplateError('$<identifier> is reserved; use $$<identifier>');
          } else {
            key = interpolate(key, context);
          }

          result[key] = value;
        }
      }
      return result;
    };

    let tokenizer = new Tokenizer({
        ignore: '\\s+', // ignore all whitespace including \n
        patterns: {
            number: '[0-9]+(?:\\.[0-9]+)?',
            identifier: '[a-zA-Z_][a-zA-Z_0-9]*',
            string: '\'[^\']*\'|"[^"]*"',
            // avoid matching these as prefixes of identifiers e.g., `insinutations`
            true: 'true(?![a-zA-Z_0-9])',
            false: 'false(?![a-zA-Z_0-9])',
            in: 'in(?![a-zA-Z_0-9])',
            null: 'null(?![a-zA-Z_0-9])',
        },
        tokens: [
            '**', ...'+-*/[].(){}:,'.split(''),
            '>=', '<=', '<', '>', '==', '!=', '!', '&&', '||',
            'true', 'false', 'in', 'null', 'number',
            'identifier', 'string',
        ]
    });

    let parse = (source, context) => {
        let parser = new Parser(tokenizer, source);
        let tree = parser.parse();
        if (parser.current_token != null) {
            throw syntaxRuleError(parser.current_token);
        }
        let interpreter = new Interpreter(context);

        return interpreter.interpret(tree);
    };

    let parseUntilTerminator = (source, terminator, context) => {
        let parser = new Parser(tokenizer, source);
        let tree = parser.parse();
        let next = parser.current_token;
        if (!next) {
            // string ended without the terminator
            let errorLocation = source.length;
            throw new SyntaxError("unterminated ${..} expression",
                {start: errorLocation, end: errorLocation});
        } else if (next.kind !== terminator) {
            throw syntaxRuleError(next);
        }
        let interpreter = new Interpreter(context);
        let result = interpreter.interpret(tree);

        return {result, offset: next.start + 2};
    };

    let containsFunctions = (rendered) => {
      if (isFunction(rendered)) {
        return true;
      } else if (Array.isArray(rendered)) {
        return rendered.some(containsFunctions);
      } else if (typeof rendered === 'object' && rendered !== null) {
        for (const key of Object.keys(rendered)) {
          if (containsFunctions(rendered[key])) {
            return true;
          }
        }
        return false;
      } else {
        return false;
      }
    };

    var src = (template, context = {}) => {
      if (!isObject(context)) {
        throw new TemplateError('context must be an object');
      }
      let test = Object.keys(context).every(v => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v));
      if (!test) {
        throw new TemplateError('top level keys of context must follow /[a-zA-Z_][a-zA-Z0-9_]*/');
      }
      context = addBuiltins(Object.assign({}, {now: fromNow('0 seconds')}, context));
      let result = render(template, context);
      if (result === deleteMarker) {
        return null;
      }

      if (containsFunctions(result)) {
        throw new TemplateError('evaluated template contained uncalled functions');
      }

      return result;
    };

    return src;

}));
