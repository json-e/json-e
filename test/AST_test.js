const assert = require('assert');
const {BinOp, ASTNode, UnaryOp, Builtin} = require("../src/AST");
const {NewParser, createTokenizer} = require('./../src/newparser');
const {NewInterpreter} = require('./../src/newinterpreter');
const oldIterpreter = require("../src/interpreter");
const addBuiltins = require("../src/builtins");

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
            let newNode = new Builtin(op, builtin, args);
            assert(newNode instanceof Builtin);
        });
    }
);

describe(
    'Check parser for primitives',
    () => {
        let tokenizer = createTokenizer();

        it('should create AST for expression "2"', function () {
            let parser = new NewParser(tokenizer, "2", {});
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
            let parser = new NewParser(tokenizer, "-2", {});
            let node = parser.parse();

            let isUnaryNodeCorrect = node.token.value == "-" && node.token.kind == "-"

            assert(isUnaryNodeCorrect && node.expr.token.value == 2);
        });

        it('should create AST for expression "+-2"', function () {
            let parser = new NewParser(tokenizer, "+-2", {});
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
            let parser = new NewParser(tokenizer, "5-2", {});
            let node = parser.parse();

            let isBinaryNodeCorrect = node.token.value == "-" && node.token.kind == "-"
            let isPrimitivesNodesCorrect = node.left.token.value == "5" && node.right.token.value == "2"

            assert(isBinaryNodeCorrect && isPrimitivesNodesCorrect);
        });

        it('should create AST for expression "1+3*8"', function () {
            let parser = new NewParser(tokenizer, "1+3*8", {});
            let node = parser.parse();
            // let toke

            let isBinaryNodesCorrect = node.token.value == "*" && node.left.token.value == "+";
            let isPrimitivesNodesCorrect = node.right.token.value == "8" && node.left.left.token.value == "1";
            isPrimitivesNodesCorrect = isPrimitivesNodesCorrect && node.left.right.token.value == "3"

            assert(isBinaryNodesCorrect && isPrimitivesNodesCorrect);
        });
    }
);

describe(
    'Check parser for builtins',
    () => {
        let tokenizer = createTokenizer();
        let context = addBuiltins({a:2});

        it('should create AST for expression "min(5,2)"', function () {
            let parser = new NewParser(tokenizer, "min(5,2)", context);
            let node = parser.parse();

            let isBuiltinNodeCorrect = node.token.value == "min" && node.token.kind == "identifier";
            let isPrimitivesNodesCorrect = node.args[0].token.value == "5" && node.args[1].token.value == "2";

            assert(isBuiltinNodeCorrect && isPrimitivesNodesCorrect);
        });

        it('should create AST for expression "a"', function () {
            let parser = new NewParser(tokenizer, "a", context);
            let node = parser.parse();
            // let toke

            let isBuiltinNodeCorrect = node.token.value == "a" && node.token.kind == "identifier";
            let isPrimitivesNodesCorrect = node.args[0] === undefined;

            assert(isBuiltinNodeCorrect && isPrimitivesNodesCorrect);
        });
    }
);

describe(
    'Check interpreter',
    () => {
        it('should interpret AST for expression "-2"', function () {
            let expr = "-2";
            let tokenizer = createTokenizer();
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter();

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });

        it('should interpret AST for expression "+7"', function () {
            let expr = "+7";
            let tokenizer = createTokenizer();
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter();

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });

        it('should interpret AST for expression "!5"', function () {
            let expr = "!5";
            let tokenizer = createTokenizer();
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter();

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });

        it('should interpret AST for expression "2+3"', function () {
            let expr = "2+3";
            let tokenizer = createTokenizer();
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter();

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });

        it('should interpret AST for expression "2-3"', function () {
            let expr = "2-3";
            let tokenizer = createTokenizer();
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter();

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });

        it('should interpret AST for expression "6/2"', function () {
            let expr = "6/2";
            let tokenizer = createTokenizer();
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter();

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });

        it('should interpret AST for expression "2*3"', function () {
            let expr = "2*3";
            let tokenizer = createTokenizer();
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter();

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });

        it('should interpret AST for expression "5>2"', function () {
            let expr = "5>2";
            let tokenizer = createTokenizer();
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter();

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });

        it('should interpret AST for expression "4<7"', function () {
            let expr = "4<7";
            let tokenizer = createTokenizer();
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter();

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });

        it('should interpret AST for expression "3>=3"', function () {
            let expr = "3>=3";
            let tokenizer = createTokenizer();
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter();

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });

        it('should interpret AST for expression "6<=2"', function () {
            let expr = "6<=2";
            let tokenizer = createTokenizer();
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter();

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });

        it('should interpret AST for expression "2!=3"', function () {
            let expr = "2!=3";
            let tokenizer = createTokenizer();
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter();

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });

        it('should interpret AST for expression "5==2"', function () {
            let expr = "5==2";
            let tokenizer = createTokenizer();
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter();

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });

        it('should interpret AST for expression "false||false"', function () {
            let expr = "false||false";
            let tokenizer = createTokenizer();
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter();

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });
        it('should interpret AST for expression "true&&false"', function () {
            let expr = "true&&false";
            let tokenizer = createTokenizer();
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter();

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });

        it('should interpret AST for expression "2**3"', function () {
            let expr = "2**3";
            let tokenizer = createTokenizer();
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter();

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });

    }
);



