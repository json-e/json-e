const {Term, UnaryOp} = require("../src/AST");

class Parser {
    constructor(parser, source, offset = 0) {
        this._source = source;
        this._tokenizer = parser._tokenizer;
        this.current_token = this._tokenizer.next(this._source, offset);
    }

    eat(token_type) {
        if (this.current_token.kind == token_type) {
            this.current_token = this._tokenizer.next(this._source, this.current_token.end);
        }
    }

    factor() {
        //    factor : (PLUS | MINUS) factor | Primitives
        let token = this.current_token;
        let node;

        if (token.kind == "+") {
            this.eat("+");
            node = new UnaryOp(token, this.factor());
        } else if (token.kind == "-") {
            this.eat("-");
            node = new UnaryOp(token, this.factor());
        } else if (token.kind == "!") {
            this.eat("!");
            node = new UnaryOp(token, this.factor());
        } else if (token.kind == "number") {
            this.eat("number");
            node = new Term(token);
        }

        return node;

    }

    parse() {
        let node = this.factor();
        return node;
    }
}

exports.NewParser = Parser;