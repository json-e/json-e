const {ASTNode, UnaryOp, BinOp, Builtin, ArrayAccess, List, Object} = require("../src/AST");
const Tokenizer = require("../src/tokenizer");
const {SyntaxError} = require('./error');

let syntaxRuleError = (token, expects) => {
    expects.sort();
    return new SyntaxError(`Found ${token.value}, expected ${expects.join(', ')}`, token);
};

class Parser {
    constructor(tokenizer, source, context, offset = 0) {
        this._source = source;
        this._tokenizer = tokenizer;
        this.current_token = this._tokenizer.next(this._source, offset);
        this.context = context;
        this.unaryOpTokens = ["-", "+", "!"];
        this.binOpTokens = ["-", "+", "/", "*", "**", ".", ">", "<", ">=", "<=", "" +
        "!=", "==", "&&", "||", "in"];
        this.primitivesTokens = ["number", "null", "true", "false"];
    }

    eat(...kinds) {
        if (kinds.length > 0 && kinds.indexOf(this.current_token.kind) === -1) {
            throw syntaxRuleError(this.current_token, kinds);
        }
        try {
            this.current_token = this._tokenizer.next(this._source, this.current_token.end);
        } catch (err) {
            throw err;
        }
    }

    /**
     * Try to get the next token if it matches one of the kinds given, otherwise
     * return null. If no kinds are given returns the next of any kind.
     */

    parse() {
        //    logicalOr : logicalAnd (OR logicalAnd)*
        let node = this.logicalAnd();
        let token = this.current_token;

        for (; token !== null && token.kind == "||"; token = this.current_token) {
            this.eat(token.kind);
            node = new BinOp(token, node, this.logicalAnd());
        }

        return node
    }

    logicalAnd() {
        //    logicalAnd : inStatement (AND inStatement)*
        let node = this.inStatement();
        let token = this.current_token;

        for (; token != null && token.kind == "&&"; token = this.current_token) {
            this.eat(token.kind);
            node = new BinOp(token, node, this.inStatement());
        }

        return node
    }

    inStatement() {
        //    inStatement : equality (IN equality)*
        let node = this.equality();
        let token = this.current_token;

        for (; token != null && token.kind == "in"; token = this.current_token) {
            this.eat(token.kind);
            node = new BinOp(token, node, this.equality());
        }

        return node
    }

    equality() {
        //    equality : comparison (EQUALITY | INEQUALITY  comparison)*
        let node = this.comparison();
        let token = this.current_token;

        for (; token != null && (token.kind == "==" || token.kind == "!="); token = this.current_token) {
            this.eat(token.kind);
            node = new BinOp(token, node, this.comparison());
        }

        return node
    }

    comparison() {
        //    comparison : addition (LESS | GREATER | LESSEQUAL | GREATEREQUAL addition)*
        let node = this.addition();
        let token = this.current_token;

        while (token != null && (token.kind == "<" || token.kind == ">" || token.kind == ">=" || token.kind == "<=")) {
            this.eat(token.kind);
            node = new BinOp(token, node, this.addition());
            token = this.current_token;
        }

        return node
    }

    addition() {
        //    addition : multiplication (PLUS | MINUS multiplication)*
        let node = this.multiplication();
        let token = this.current_token;

        for (; token != null && (token.kind == "+" || token.kind == "-"); token = this.current_token) {
            this.eat(token.kind);
            node = new BinOp(token, node, this.multiplication());
        }

        return node
    }

    multiplication() {
        //    multiplication : exponentiation (MUL | DIV exponentiation)*
        let node = this.exponentiation();
        let token = this.current_token;

        for (; token != null && (token.kind == "*" || token.kind == "/"); token = this.current_token) {
            this.eat(token.kind);
            node = new BinOp(token, node, this.exponentiation());
        }

        return node
    }

    exponentiation() {
        //    exponentiation : factor (EXP exponentiation)*
        let node = this.factor();
        let token = this.current_token;

        for (; token != null && token.kind == "**"; token = this.current_token) {
            this.eat(token.kind);
            node = new BinOp(token, this.exponentiation(), node);
        }

        return node
    }

    factor() {
        //    factor : unaryOp factor | primitives | (string | list | builtin) (valueAccess)? | LPAREN expr RPAREN |object
        let token = this.current_token;
        let node;
        let isUnaryOpToken = this.unaryOpTokens.indexOf(token.kind) !== -1;
        let isPrimitivesToken = this.primitivesTokens.indexOf(token.kind) !== -1;

        if (isUnaryOpToken) {
            this.eat(token.kind);
            node = new UnaryOp(token, this.factor());
        } else if (isPrimitivesToken) {
            this.eat(token.kind);
            node = new ASTNode(token);
        } else if (token.kind == "string") {
            this.eat(token.kind);
            node = new ASTNode(token);
            node = this.valueAccess(node)
        } else if (token.kind == "(") {
            this.eat("(");
            node = this.parse();
            this.eat(")");
        } else if (token.kind == "[") {
            node = this.list();
            node = this.valueAccess(node)
        } else if (token.kind == "{") {
            node = this.object();
        } else if (token.kind == "identifier") {
            node = this.builtins();
            node = this.valueAccess(node)
        }

        return node
    }

    builtins() {
        //    builtins : ID((LPAREN (expr ( COMMA expr)*)? RPAREN)? | (DOT ID)*)
        let args = null;
        let token = this.current_token;
        let node;
        this.eat("identifier");

        if (this.current_token != null && this.current_token.kind == "(") {
            args = [];
            this.eat("(");
            node = this.parse();
            args.push(node);

            while (this.current_token.kind == ",") {
                this.eat(",");
                node = this.parse();
                args.push(node)
            }
            this.eat(")")
        }
        node = new Builtin(token, args);

        for (token = this.current_token; token != null && token.kind == "."; token = this.current_token) {
            this.eat(".");
            let right = this.current_token;
            node = new BinOp(token, node, right);
            if (this.current_token) {
                this.eat(this.current_token.kind);
            }
        }

        return node
    }

    list() {
        //    list : LSQAREBRAKET (expr ( COMMA expr)*)? RSQAREBRAKET)
        let node;
        let arr = [];
        let token = this.current_token;
        this.eat("[");

        if (this.current_token.kind != "]") {
            node = this.parse();
            arr.push(node);

            while (this.current_token.kind == ",") {
                this.eat(",");
                node = this.parse();
                arr.push(node)
            }
        }
        this.eat("]");
        node = new List(token, arr);
        return node
    }

    valueAccess(node) {
        //    valueAccess : (LSQAREBRAKET expr |(expr? SEMI expr?)  RSQAREBRAKET)(LSQAREBRAKET expr
        //   |(expr? SEMI expr?)  RSQAREBRAKET))*
        let leftArg = null, rightArg = null;
        let token;
        let isInterval = false;

        for (token = this.current_token; token && token.kind == "[";) {
            this.eat("[");

            if (this.current_token.kind != ":") {
                leftArg = this.parse();
            }
            if (this.current_token.kind == ":") {
                isInterval = true;
                this.eat(":");
                if (this.current_token.kind != "]") {
                    rightArg = this.parse();
                }
            }
            this.eat("]");
            node = new ArrayAccess(token, node, isInterval, leftArg, rightArg);
            token = this.current_token
        }

        return node;
    }

    object() {
        //    object : LCURLYBRACE ( STR | ID SEMI expr (COMMA STR | ID SEMI expr)*)? RCURLYBRACE (DOT ID)?
        let node;
        let obj = {};
        let key, value;
        let token = this.current_token;
        this.eat("{");

        while (this.current_token.kind == "string" || this.current_token.kind == "identifier") {
            key = this.current_token.value;
            if (this.current_token.kind == "string") {
                key = parseString(key);
            }
            this.eat(this.current_token.kind);
            this.eat(":");
            value = this.parse();
            obj[key] = value;
            if (this.current_token.kind == "}") {
                break;
            } else {
                this.eat(",")
            }
        }
        this.eat("}");
        node = new Object(token, obj);
        token = this.current_token;

        if (token != null && token.kind == ".") {
            this.eat(".");
            let right = this.current_token;
            this.eat(this.current_token.kind);
            node = new BinOp(token, node, right);
        }
        return node;
    }

}

let
    parseString = (str) => {
        return str.slice(1, -1);
    };

let
    createTokenizer = function () {
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
            }
        );
        return tokenizer
    };


exports
    .NewParser = Parser;
exports
    .createTokenizer = createTokenizer;