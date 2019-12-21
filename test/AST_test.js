const assert = require('assert');
const {BinOp, ASTNode, UnaryOp, Builtins} = require("../src/AST");
const {NewParser, createTokenizer} = require('./../src/newparser');

describe(
    'Check AST Constructors',
    () => {
        let op = {value: "-", kind: "-"}, builtin = "max", args = new Array();
        let left = new BinOp(op), right = new UnaryOp(op), expr = new ASTNode(op);

        it('should create node for binary operation ', function () {
            let newNode = new BinOp(op, left, right);
            assert(newNode instanceof BinOp);
        });

        it('should create node for unary operation ', function () {
            let newNode = new UnaryOp(op, expr);
            assert(newNode instanceof UnaryOp);
        });

        it('should create node for builtins', function () {
            let newNode = new Builtins(op, builtin, args);
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

describe(
    'Check parser for binary operations',
    () => {
        let tokenizer = createTokenizer();

        it('should create AST for expression "5-2"', function () {
            let parser = new NewParser(tokenizer, "5-2");
            let node = parser.parse();

            let isBinaryNodeCorrect = node.token.value == "-" && node.token.kind == "-"
            let isPrimitivesNodesCorrect = node.left.token.value == "5" && node.right.token.value == "2"

            assert(isBinaryNodeCorrect && isPrimitivesNodesCorrect );
        });

        it('should create AST for expression "1+3*8"', function () {
            let parser = new NewParser(tokenizer, "1+3*8");
            let node = parser.parse();
            // let toke

            let isBinaryNodesCorrect = node.token.value == "*" && node.left.token.value == "+";
            let isPrimitivesNodesCorrect =node.right.token.value == "8" && node.left.left.token.value == "1";
            isPrimitivesNodesCorrect = isPrimitivesNodesCorrect && node.left.right.token.value == "3"

            assert(isBinaryNodesCorrect && isPrimitivesNodesCorrect);
        });
    }
);


