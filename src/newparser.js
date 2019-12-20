const {ASTNode, UnaryOp, BinOp} = require("../src/AST");
const Tokenizer = require("../src/tokenizer");

class Parser {
    constructor(tokenizer, source, offset = 0) {
        this._source = source;
        this._tokenizer = tokenizer;
        this.current_token = this._tokenizer.next(this._source, offset);
        this.unaryOpTokens = ["-", "+", "!"];
        this.binOpTokens = ["-", "+", "/", "*", "**", ".", ">", "<", ">=", "<=", "" +
        "!=", "==", "&&", "||", "in"];
        this.primitivesTokens = ["number", "null", "str", "true", "false"];
    }

    eat(token_type) {
        if (this.current_token.kind == token_type) {
            this.current_token = this._tokenizer.next(this._source, this.current_token.end);
        }
    }

    parse() {
        //    expr : term (unaryOp term)*
        let node = this.term();
        let token = this.current_token;

        if (token == null) {
            return node
        }

        while (this.unaryOpTokens.indexOf(token.kind) !== -1) {
            this.eat(token.kind);
            node = new UnaryOp(token, this.term());
        }

        return node;
    }

    term() {
        //    term : factor (binaryOp factor)*
        let node = this.factor();
        let token = this.current_token;

        if (token == null) {
            return node
        }

        while (this.binOpTokens.indexOf(token.kind) !== -1) {
            this.eat(token.kind);
            node = new BinOp(token, node, this.factor());
        }

        return node
    }

    factor() {
        //    factor : unaryOp factor | Primitives | LPAREN expr RPAREN
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
        }

        return node
    }
}

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