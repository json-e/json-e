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

            let isBinaryNodesCorrect = node.token.value == "+" && node.left.token.value == "1";
            let isPrimitivesNodesCorrect = node.right.token.value == "*" && node.right.left.token.value == "3";
            isPrimitivesNodesCorrect = isPrimitivesNodesCorrect && node.right.right.token.value == "8"

            assert(isBinaryNodesCorrect && isPrimitivesNodesCorrect);
        });
    }
);

describe(
    'Check parser for builtins',
    () => {
        let tokenizer = createTokenizer();
        let context = addBuiltins({a: 2});

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
    'Check parser for lists',
    () => {
        let tokenizer = createTokenizer();

        it('should create AST for expression "[]"', function () {
            let parser = new NewParser(tokenizer, "[]", {});
            let node = parser.parse();

            let isListNodeCorrect = node.token.value == "[" && node.token.kind == "[" && node.list[0] == undefined;

            assert(isListNodeCorrect);
        });

        it('should create AST for expression [2, 5]', function () {
            let parser = new NewParser(tokenizer, "[2, 5]", {});
            let node = parser.parse();

            let isListTokenCorrect = node.token.value == "[" && node.token.kind == "["
            let isListCorrect = node.list[0].token.value == 2 && node.list[1].token.value == 5;

            assert(isListTokenCorrect && isListCorrect);
        });
    }
);

describe(
    'Check parser for array access',
    () => {
        let tokenizer = createTokenizer();
        let context = addBuiltins({a: [1,2,3,4]});

        it('should create AST for expression "a[2]"', function () {
            let parser = new NewParser(tokenizer, "a[2]", context);
            let node = parser.parse();

            let isIDCorrect = node.token.value == "a" && node.token.kind == "identifier";
            let isIndexCorrect = node.left.token.value == 2;

            assert(isIDCorrect && isIndexCorrect);
        });

        it('should create AST for expression "a[:2]"', function () {
            let parser = new NewParser(tokenizer, "a[:2]", context);
            let node = parser.parse();

            let isIDCorrect = node.token.value == "a" && node.token.kind == "identifier";
            let isIndexCorrect = node.left == null && node.right.token.value == 2;

            assert(isIDCorrect && isIndexCorrect);
        });

        it('should create AST for expression "a[2:3]"', function () {
            let parser = new NewParser(tokenizer, "a[2:3]", context);
            let node = parser.parse();

            let isBuiltinNodeCorrect = node.token.value == "a" && node.token.kind == "identifier";
            let isPrimitivesNodesCorrect =  node.left.token.value == 2 && node.right.token.value == 3;

            assert(isBuiltinNodeCorrect && isPrimitivesNodesCorrect);
        });
    }
);

describe(
    'Check parser for objects',
    () => {
        let tokenizer = createTokenizer();
        let context = {};

        it('should create AST for expression "{}"', function () {
            let parser = new NewParser(tokenizer, "{}", context);
            let node = parser.parse();

            let isTokenCorrect = node.token.value == "{" && node.token.kind == "{";
            let isObjCorrect = Object.keys(node.obj).length == 0

            assert(isTokenCorrect && isObjCorrect);
        });

        it('should create AST for expression "{k:2}"', function () {
            let parser = new NewParser(tokenizer, "{k:2}", context);
            let node = parser.parse();

            let isTokenCorrect = node.token.value == "{" && node.token.kind == "{";
            let isObjCorrect = node.obj["k"].token.value == 2;

            assert(isTokenCorrect && isObjCorrect);
        });

        it('should create AST for expression "{"a": 2, b : "abcd"}"', function () {
            let parser = new NewParser(tokenizer, "{\"a\": 2, b : \"abcd\"}", context);
            let node = parser.parse();

            let isTokenCorrect = node.token.value == "{" && node.token.kind == "{";
            let isObjCorrect = node.obj["a"].token.value == 2 && node.obj["b"].token.value == "abcd";

            assert(isTokenCorrect && isObjCorrect);
        });
    }
);

describe(
    'Check parser for operation "."',
    () => {
        let tokenizer = createTokenizer();
        let context = {};

        it('should create AST for expression "{a: 1}.a"', function () {
            let parser = new NewParser(tokenizer, "{a: 1}.a", context);
            let node = parser.parse();

            let isTokenCorrect = node.token.value == "." && node.token.kind == ".";
            let isObjCorrect = node.left.obj["a"].token.value == 1;
            let isKeyCorrect = node.right.token.kind == "identifier" && node.right.token.value == "a" ;

            assert(isTokenCorrect && isObjCorrect && isKeyCorrect);
        });

        it('should create AST for expression "k.b"', function () {
            let parser = new NewParser(tokenizer, "k.b", context);
            let node = parser.parse();

            let isTokenCorrect = node.token.value == "." && node.token.kind == ".";
            let isObjCorrect = node.left.token.value == "k";
            let isKeyCorrect = node.right.token.value == "b";

            assert(isTokenCorrect && isObjCorrect && isKeyCorrect);
        });
    }
);

describe(
    'Check parser for operation "in"',
    () => {
        let tokenizer = createTokenizer();

        it('should create AST for expression "1 in [1,2]"', function () {
            let parser = new NewParser(tokenizer, "1 in [1,2]", {});
            let node = parser.parse();

            let isInTokenCorrect = node.token.value == "in" && node.token.kind == "in"
            let isLeftNodeCorrect = node.left.token.value == 1;
            let isRightNodeCorrect = node.right.token.kind == "[";

            assert(isInTokenCorrect && isLeftNodeCorrect && isRightNodeCorrect);
        });

        it('should create AST for expression "\"a\" in \"bac\""', function () {
            let parser = new NewParser(tokenizer, '"a" in "bac"', {});
            let node = parser.parse();

            let isInTokenCorrect = node.token.value == "in" && node.token.kind == "in"
            let isLeftNodeCorrect = node.left.token.value == "\"a\"";
            let isRightNodeCorrect = node.right.token.value == "\"bac\"";

            assert(isInTokenCorrect && isLeftNodeCorrect && isRightNodeCorrect);
        });
    }
);

describe(
    'Check interpreter',
    () => {
        let tokenizer = createTokenizer();
        it('should interpret AST for expression "-2"', function () {
            let expr = "-2";
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter({});

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });

        it('should interpret AST for expression "+7"', function () {
            let expr = "+7";
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter({});

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });

        it('should interpret AST for expression "!5"', function () {
            let expr = "!5";
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter({});

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });

        it('should interpret AST for expression "2+3"', function () {
            let expr = "2+3";
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter({});

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });

        it('should interpret AST for expression "2-3"', function () {
            let expr = "2-3";
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter({});

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });

        it('should interpret AST for expression "6/2"', function () {
            let expr = "6/2";
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter({});

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });

        it('should interpret AST for expression "2*3"', function () {
            let expr = "2*3";
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter({});

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });

        it('should interpret AST for expression "2+3*5"', function () {
            let expr = "2+3*5";
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter({});

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });

        it('should interpret AST for expression "5>2"', function () {
            let expr = "5>2";
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter({});

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });

        it('should interpret AST for expression "4<7"', function () {
            let expr = "4<7";
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter({});

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });

        it('should interpret AST for expression "3>=3"', function () {
            let expr = "3>=3";
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter({});

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });

        it('should interpret AST for expression "6<=2"', function () {
            let expr = "6<=2";
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter({});

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });

        it('should interpret AST for expression "2!=3"', function () {
            let expr = "2!=3";
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter({});

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });

        it('should interpret AST for expression "5==2"', function () {
            let expr = "5==2";
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter({});

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });

        it('should interpret AST for expression "false||false"', function () {
            let expr = "false||false";
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter({});

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });
        it('should interpret AST for expression "true&&false"', function () {
            let expr = "true&&false";
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter({});

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });

        it('should interpret AST for expression "2**3"', function () {
            let expr = "2**3";
            let parser = new NewParser(tokenizer, expr, {});
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter({});

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr));
        });

        it('should interpret AST for expression "max(5,2,9)"', function () {
            let context = addBuiltins();
            let expr = "max(5,2,9)";
            let parser = new NewParser(tokenizer, expr, context);
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter(context);

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr, context));
        });
        it('should interpret AST for expression "a" with context {a :3}', function () {
            let context = {a: 3};
            let expr = "a";
            let parser = new NewParser(tokenizer, expr, context);
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter(context);

            assert.equal(newInterpreter.interpret(tree), oldIterpreter.parse(expr, context));
        });

        it('should interpret AST for expression "[]"', function () {
            let context = {};
            let expr = "[]";

            let parser = new NewParser(tokenizer, expr, context);
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter(context);

            assert.equal(JSON.stringify(oldIterpreter.parse(expr, context)),JSON.stringify(newInterpreter.interpret(tree)));
        });

        it('should interpret AST for expression [2, 5]', function () {
            let context = {};
            let expr = "[2, 5]";
            let parser = new NewParser(tokenizer, expr, context);
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter(context);

            assert.equal(JSON.stringify(oldIterpreter.parse(expr, context)),JSON.stringify(newInterpreter.interpret(tree)));
        });

        it('should interpret AST for expression "a[2]"', function () {
            let context = {a: [1,2,3,4]};
            let expr = "a[2]";
            let parser = new NewParser(tokenizer, expr, context);
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter(context);

            assert.equal(JSON.stringify(oldIterpreter.parse(expr, context)),JSON.stringify(newInterpreter.interpret(tree)));
        });

        it('should interpret AST for expression "a[:2]"', function () {
            let context = {a: [1,2,3,4]};
            let expr = "a[:2]";
            let parser = new NewParser(tokenizer, expr, context);
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter(context);

            assert.equal(JSON.stringify(oldIterpreter.parse(expr, context)),JSON.stringify(newInterpreter.interpret(tree)));
        });

        it('should interpret AST for expression "a[2:3]"', function () {
            let context = {a: [1,2,3,4]};
            let expr = "a[2:3]";
            let parser = new NewParser(tokenizer, expr, context);
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter(context);

            assert.equal(JSON.stringify(oldIterpreter.parse(expr, context)),JSON.stringify(newInterpreter.interpret(tree)));
        });

        it('should interpret AST for expression "{}"', function () {
            let context = {};
            let expr = "{}";
            let parser = new NewParser(tokenizer, expr, context);
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter(context);

            assert.equal(JSON.stringify(oldIterpreter.parse(expr, context)),JSON.stringify(newInterpreter.interpret(tree)));
        });

        it('should interpret AST for expression "{k : 2}"', function () {
            let context = {};
            let expr = "{k : 2}";
            let parser = new NewParser(tokenizer, expr, context);
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter(context);

            assert.equal(JSON.stringify(oldIterpreter.parse(expr, context)),JSON.stringify(newInterpreter.interpret(tree)));
        });

        it('should interpret AST for expression "{"a" : 2+5, b : "zxc"}"', function () {
            let context = {};
            let expr = "{\"a\" : 2+5, b : \"zxc\"}";
            let parser = new NewParser(tokenizer, expr, context);
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter(context);

            assert.equal(JSON.stringify(oldIterpreter.parse(expr, context)),JSON.stringify(newInterpreter.interpret(tree)));
        });

        it('should interpret AST for expression "{a: 1}.a"', function () {
            let context = {};
            let expr = "{a: 1}.a";
            let parser = new NewParser(tokenizer, expr, context);
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter(context);

            assert.equal(JSON.stringify(oldIterpreter.parse(expr, context)),JSON.stringify(newInterpreter.interpret(tree)));
        });

        it('should interpret AST for expression "{k.b} with context {k : {b : 8}}"', function () {
            let context = {k : {b : 8}};
            let expr = "k.b";
            let parser = new NewParser(tokenizer, expr, context);
            let tree = parser.parse();
            let newInterpreter = new NewInterpreter(context);

            assert.equal(JSON.stringify(oldIterpreter.parse(expr, context)),JSON.stringify(newInterpreter.interpret(tree)));
        });
    }
);



