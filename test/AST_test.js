const assert = require('assert');
const {BinOp, ASTNode, UnaryOp, Builtins} = require("../src/AST");
const {NewParser, createTokenizer} = require('./../src/newparser');

describe(
    'Check AST Constructors',
    () => {
        let op = {value: "-", kind: "-"}, builtin = "max", args = new Array();
        let left = new BinOp(op), right = new UnaryOp(op), expr = new ASTNode(op);

        it('should create node for binary operation ', function () {
            let newNode = new BinOp(left, right, op);
            assert(newNode instanceof BinOp);
        });

        it('should create node for unary operation ', function () {
            let newNode = new UnaryOp(op, expr);
            assert(newNode instanceof UnaryOp);
        });

        it('should create node for builtins', function () {
            let newNode = new Builtins(builtin, args, op);
            assert(newNode instanceof Builtins);
        });
    }
);

describe(
    'Check parser for primitives',
    () => {
        let tokenizer = createTokenizer();

        it('should create AST for expression "2"', function () {
            let parser = new NewParser(tokenizer, "2");
            let node = parser.parse();

            assert(node.token.kind == "number" && node.token.value == "2");
        });
    }
);

describe(
    'Check parser for unary operations',
    () => {
        let tokenizer = createTokenizer();

        it('should create AST for expression "-2"', function () {
            let parser = new NewParser(tokenizer, "-2");
            let node = parser.parse();

            let isUnaryNodeCorrect = node.token.value == "-" && node.token.kind == "-"

            assert(isUnaryNodeCorrect && node.expr.token.value == 2);
        });

        it('should create AST for expression "+-2"', function () {
            let parser = new NewParser(tokenizer, "+-2");
            let node = parser.parse();

            let isUnaryNodesCorrect = node.token.value == "+" && node.expr.token.value == "-";
            isUnaryNodesCorrect = isUnaryNodesCorrect && node.token.kind == "+" && node.expr.token.kind == "-";

            assert(isUnaryNodesCorrect && node.expr.expr.token.value == "2");
        });
    }
);



