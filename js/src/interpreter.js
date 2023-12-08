const {isFunction, isObject, isString, isArray, isNumber, isInteger, isTruthy} = require("../src/type-utils");
const {InterpreterError} = require('./error');

let expectationError = (operator, expectation) => new InterpreterError(`${operator} expects ${expectation}`);

class Interpreter {
    constructor(context) {
        this.context = context;
    }

    visit(node) {
        let funcName = "visit_" + node.constructorName;
        return this[funcName](node);
    }

    visit_ASTNode(node) {
        let str;
        switch (node.token.kind) {
            case("number"):
                return +node.token.value;
            case("null"):
                return null;
            case("string"):
                str = node.token.value.slice(1, -1);
                return str;
            case("true"):
                return true;
            case("false"):
                return false;
            case("identifier"):
                return node.token.value;
        }
    }

    visit_UnaryOp(node) {
        let value = this.visit(node.expr);
        switch (node.token.kind) {
            case ("+"):
                if (!isNumber(value)) {
                    throw expectationError('unary +', 'number');
                }
                return +value;
            case ("-"):
                if (!isNumber(value)) {
                    throw expectationError('unary -', 'number');
                }
                return -value;
            case ("!"):
                return !isTruthy(value)
        }
    }

    visit_BinOp(node) {
        let left = this.visit(node.left);
        let right;
        switch (node.token.kind) {
            case ("||"):
                return isTruthy(left) || isTruthy(this.visit(node.right));
            case ("&&"):
                return isTruthy(left) && isTruthy(this.visit(node.right));
            default:
                right = this.visit(node.right);
        }

        switch (node.token.kind) {
            case ("+"):
                testMathOperands("+", left, right);
                return left + right;
            case ("-"):
                testMathOperands("-", left, right);
                return left - right;
            case ("/"):
                testMathOperands("/", left, right);
                if (right == 0) {
                    throw new InterpreterError("division by zero");
                }
                return left / right;
            case ("*"):
                testMathOperands("*", left, right);
                return left * right;
            case (">"):
                testComparisonOperands(">", left, right);
                return left > right;
            case ("<"):
                testComparisonOperands("<", left, right);
                return left < right;
            case (">="):
                testComparisonOperands(">=", left, right);
                return left >= right;
            case ("<="):
                testComparisonOperands("<=", left, right);
                return left <= right;
            case ("!="):
                testComparisonOperands("!=", left, right);
                return !isEqual(left, right);
            case ("=="):
                testComparisonOperands("==", left, right);
                return isEqual(left, right);
            case ("**"):
                testMathOperands("**", left, right);
                return Math.pow(right, left);
            case ("."): {
                if (isObject(left)) {
                    if (left.hasOwnProperty(right)) {
                        return left[right];
                    }
                    throw new InterpreterError(`object has no property "${right}"`);
                }
                throw expectationError('infix: .', 'objects');
            }
            case ("in"): {
                if (isObject(right)) {
                    if (!isString(left)) {
                        throw expectationError('Infix: in-object', 'string on left side');
                    }
                    right = Object.keys(right);
                } else if (isString(right)) {
                    if (!isString(left)) {
                        throw expectationError('Infix: in-string', 'string on left side');
                    }
                    return right.indexOf(left) !== -1;
                } else if (!isArray(right)) {
                    throw expectationError('Infix: in', 'Array, string, or object on right side');
                }
                return right.some(r => isEqual(left, r));
            }
        }
    }

    visit_List(node) {
        let list = [];

        if (node.list[0] !== undefined) {
            node.list.forEach(function (item) {
                list.push(this.visit(item))
            }, this);
        }

        return list
    }

    visit_ValueAccess(node) {
        let array = this.visit(node.arr);
        let left = 0, right = null;

        if (node.left) {
            left = this.visit(node.left);
        }
        if (node.right) {
            right = this.visit(node.right);
        }
        if (left < 0) {
            left = array.length + left
        }
        if (isArray(array) || isString(array)) {
            if (node.isInterval) {
                right = right === null ? array.length : right;
                if (right < 0) {
                    right = array.length + right;
                    if (right < 0)
                        right = 0
                }
                if (left > right) {
                    left = right
                }
                if (!isInteger(left) || !isInteger(right)) {
                    throw new InterpreterError('cannot perform interval access with non-integers');
                }
                return array.slice(left, right)
            }
            if (!isInteger(left)) {
                throw new InterpreterError('should only use integers to access arrays or strings');
            }
            if (left >= array.length) {
                throw new InterpreterError('index out of bounds');
            }
            return array[left]
        }
        if (!isObject(array)) {
            throw expectationError(`infix: "[..]"`, 'object, array, or string');
        }

        if (!isString(left)) {
            throw new InterpreterError('object keys must be strings');
        }

        if (array.hasOwnProperty(left)) {
            return array[left];
        } else {
            return null;
        }
    }

    visit_ContextValue(node) {
        if (this.context.hasOwnProperty(node.token.value)) {
            let contextValue = this.context[node.token.value];
            return contextValue
        }
        throw new InterpreterError(`unknown context value ${node.token.value}`);
    }

    visit_FunctionCall(node) {
        let args = [];

        let funcName = this.visit(node.name);
        if (isFunction(funcName)) {
            node.args.forEach(function (item) {
                args.push(this.visit(item))
            }, this);
            if (funcName.hasOwnProperty("jsone_builtin")) {
                args.unshift(this.context);
            }
            return funcName.apply(null, args);
        } else {
            throw new InterpreterError(`${funcName} is not callable`);
        }
    }

    visit_Object(node) {
        let obj = {};

        for (let key in node.obj) {
            obj[key] = this.visit(node.obj[key])
        }

        return obj
    }

    interpret(tree) {
        return this.visit(tree);
    }
}

let isEqual = (a, b) => {
    if (isArray(a) && isArray(b) && a.length === b.length) {
        for (let i = 0; i < a.length; i++) {
            if (!isEqual(a[i], b[i])) {
                return false;
            }
        }
        return true;
    }
    if (isFunction(a)) {
        return a === b;
    }
    if (isObject(a) && isObject(b)) {
        let keys = Object.keys(a).sort();
        if (!isEqual(keys, Object.keys(b).sort())) {
            return false;
        }
        for (let k of keys) {
            if (!isEqual(a[k], b[k])) {
                return false;
            }
        }
        return true;
    }
    return a === b;
};

let testMathOperands = (operator, left, right) => {
    if (operator === '+' && !(isNumber(left) && isNumber(right) || isString(left) && isString(right))) {
        throw expectationError('infix: +', 'numbers/strings + numbers/strings');
    }
    if (['-', '*', '/', '**'].some(v => v === operator) && !(isNumber(left) && isNumber(right))) {
        throw expectationError(`infix: ${operator}`, `number ${operator} number`);
    }
    return
};

let testComparisonOperands = (operator, left, right) => {
    if (operator === '==' || operator === '!=') {
        return null;
    }

    let test = ['>=', '<=', '<', '>'].some(v => v === operator)
        && (isNumber(left) && isNumber(right) || isString(left) && isString(right));

    if (!test) {
        throw expectationError(`infix: ${operator}`, `numbers/strings ${operator} numbers/strings`);
    }
    return
};

exports
    .Interpreter = Interpreter;
