const {ASTNode, UnaryOp, BinOp} = require("../src/AST");
const Tokenizer = require("../src/tokenizer");

class Parser {
    constructor(tokenizer, source, offset = 0) {
        this._source = source;
        this._tokenizer = tokenizer;
        this.current_token = this._tokenizer.next(this._source, offset);
        this.tokensForUnaryOp = ["-", "+", "!"];
        this.tokensForBinOp = ["-", "+", "/", "*", "**", ".", ">", "<", ">=", "<=", "" +
        "!=", "==", "&&", "||", "in"];
        this.tokensForPrimitives = ["number", "null", "str", "true", "false"]
    }

    eat(token_type) {
        if (this.current_token.kind == token_type) {
            this.current_token = this._tokenizer.next(this._source, this.current_token.end);
        }
    }

    parse() {
        //    expr : term (unaryOp term)*
        let token;
        let node = this.term();

        if (this.current_token !== null) {
            while (this.tokensForUnaryOp.indexOf(this.current_token.kind) != "-1") {
                token = this.current_token;
                this.eat(token.kind);
                node = new BinOp(token, this.term());
            }
        }

        return node;
    }

    term() {
        //    term : factor (binaryOp factor)*
        let token;
        let node = this.factor();

        if (this.current_token !== null) {
            while (this.tokensForBinOp.indexOf(this.current_token.kind) != "-1") {
                token = this.current_token;
                this.eat(token.kind);
                node = new BinOp(token, this.factor());
            }
        }

        return node
    }

    factor() {
        //    factor : unaryOp factor | Primitives | LPAREN expr RPAREN
        let token = this.current_token;
        let node;

        if (this.tokensForUnaryOp.indexOf(token.kind) != "-1") {
            this.eat(token.kind);
            node = new UnaryOp(token, this.factor());
        } else if (this.tokensForPrimitives.indexOf(token.kind) != "-1") {
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