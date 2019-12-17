const {ASTnode, UnaryOp} = require("../src/AST");
const Tokenizer = require("../src/tokenizer");

class Parser {
    constructor(tokenizer, source, offset = 0) {
        this._source = source;
        this._tokenizer = tokenizer;
        this.current_token = this._tokenizer.next(this._source, offset);
    }

    eat(token_type) {
        if (this.current_token.kind == token_type) {
            this.current_token = this._tokenizer.next(this._source, this.current_token.end);
        }
    }

    parse() {
        //    factor : (PLUS | MINUS) factor | Primitives
        let token = this.current_token;
        let node;

        if (token.kind == "+") {
            this.eat("+");
            node = new UnaryOp(token, this.parse());
        } else if (token.kind == "-") {
            this.eat("-");
            node = new UnaryOp(token, this.parse());
        } else if (token.kind == "!") {
            this.eat("!");
            node = new UnaryOp(token, this.parse());
        } else if (token.kind == "number") {
            this.eat("number");
            node = new ASTnode(token);
        }

        return node;
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
}


exports.NewParser = Parser;
exports.createTokenizer = createTokenizer;