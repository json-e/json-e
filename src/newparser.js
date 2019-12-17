const {ASTnode, UnaryOp} = require("../src/AST");

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

exports.NewParser = Parser;