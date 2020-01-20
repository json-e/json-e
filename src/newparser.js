const {ASTNode, UnaryOp, BinOp, Builtin, ArrayAccess, List, Object} = require("../src/AST");
const Tokenizer = require("../src/tokenizer");

class Parser {
    constructor(tokenizer, source, context, offset = 0) {
        this._source = source;
        this._tokenizer = tokenizer;
        this.current_token = this._tokenizer.next(this._source, offset);
        this.context = context;
        this.unaryOpTokens = ["-", "+", "!"];
        this.binOpTokens = ["-", "+", "/", "*", "**", ".", ">", "<", ">=", "<=", "" +
        "!=", "==", "&&", "||", "in"];
        this.primitivesTokens = ["number", "null", "string", "true", "false"];
    }

    eat(token_type) {
        if (this.current_token.kind == token_type) {
            this.current_token = this._tokenizer.next(this._source, this.current_token.end);
        }
    }

    simpleRule(next, args) {
        let node = next.call(this);
        let token = this.current_token;

        for (; token !== null && args.indexOf(token.kind) !== -1; token = this.current_token) {
            this.eat(token.kind);
            node = new BinOp(token, node, next.call(this));
        }

        return node
    }

    parse() {
        //    expr : logicalAnd (OR logicalAnd)*
        return this.simpleRule.call(this, this.logicalAnd, ["||"])
    }

    logicalAnd() {
        //    logicalAnd : equality (AND equality)*
        return this.simpleRule.call(this, this.inStatement, ["&&"])
    }

    inStatement() {
        //    inStatement : equality (IN equality)*
        return this.simpleRule.call(this, this.equality, ["in"])
    }

    equality() {
        //    logicalAnd : comparison (EQUALITY | INEQUALITY  comparison)*
        return this.simpleRule.call(this, this.comparison, ["==", "!="])
    }

    comparison() {
        //    comparison : addition (LESS | GREATER | LESSEQUAL | GREATEREQUAL addition)*
        return this.simpleRule.call(this, this.addition, ["<", ">", ">=", "<="])
    }

    addition() {
        //    addition : multiplication (PLUS | MINUS multiplication)*
        return this.simpleRule.call(this, this.multiplication, ["+", "-"])
    }

    multiplication() {
        //    multiplication : exponentiation (MUL | DIV exponentiation)*
        return this.simpleRule.call(this, this.exponentiation, ["*", "/"])
    }

    exponentiation() {
        //    exponentiation : factor (EXP factor)*
        return this.simpleRule.call(this, this.factor, ["**"])
    }

    factor() {
        //    factor : unaryOp factor | primitives | LPAREN expr RPAREN | list | object |
        //              |  ID (arrayAccess | DOT ID | builtins)
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
        } else if (token.kind == "(") {
            this.eat("(");
            node = this.parse();
            this.eat(")");
        } else if (token.kind == "[") {
            node = this.list();
        } else if (token.kind == "{") {
            node = this.object();
        } else if (token.kind == "identifier") {
            let nextToken = this._tokenizer.next(this._source, this.current_token.end);

            if (nextToken != null && nextToken.kind == "[") {
                node = this.arrayAccess();
            } else if (nextToken != null && nextToken.kind == ".") {
                let left = new Builtin(this.current_token, []);
                this.eat(token.kind);
                token = this.current_token;
                this.eat(".");
                let right = new Builtin(this.current_token, []);
                this.eat(right.kind);
                node = new BinOp(token, left, right);
            } else {
                node = this.builtins()
            }
        }

        return node
    }

    builtins() {
        //    builtins : (LPAREN (expr ( COMMA expr)*)? RPAREN)?
        let args = [];
        let token = this.current_token;
        let node;
        this.eat("identifier");

        if (this.current_token != null && this.current_token.kind == "(") {
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
        return node
    }

    list() {
        //    list : LSQAREBRAKET (expr ( COMMA expr)*)? RSQAREBRAKET)
        let node;
        let list = [];
        let token = this.current_token;
        this.eat("[");

        if (this.current_token != "]") {
            node = this.parse();
            list.push(node);

            while (this.current_token.kind == ",") {
                this.eat(",");
                node = this.parse();
                list.push(node)
            }
        }
        this.eat("]");
        node = new List(token, list);
        return node
    }

    arrayAccess() {
        //    arrayAccess : LSQAREBRAKET expr |(expr? SEMI expr?)  RSQAREBRAKET)
        let node, left = null, right = null;
        let token = this.current_token;
        let isInterval = false;
        this.eat("identifier");
        this.eat("[");

        if (this.current_token.kind != ":") {
            left = this.parse();
        }
        if (this.current_token.kind == ":") {
            isInterval = true;
            this.eat(":");
            if (this.current_token.kind != "]") {
                right = this.parse();
            }
        }
        this.eat("]");
        node = new ArrayAccess(token, isInterval, left, right);
        return node;
    }

    object() {
        //    object : LCURLYBRACE ( STR | ID SEMI expr (COMMA STR | ID expr)*)? RCURLYBRACE (DOT ID)?
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
            if (this.current_token == "}") {
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
            let right = new Builtin(this.current_token, []);
            this.eat(right.kind);
            node = new BinOp(token, node, right);
        }
        return node;
    }

}

let parseString = (str) => {
    return str.slice(1, -1);
};

let createTokenizer = function () {
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


exports.NewParser = Parser;
exports.createTokenizer = createTokenizer;