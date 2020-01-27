const {isFunction, isObject, isString, isArray} = require("../src/type-utils");

class Interpreter {
    constructor(context) {
        this.context = context;
    }

    visit(node) {
        let funcName = "visit_" + node.constructor.name;
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
        }
    }

    visit_UnaryOp(node) {
        switch (node.token.kind) {
            case ("+"):
                return +this.visit(node.expr);
            case ("-"):
                return -this.visit(node.expr);
            case ("!"):
                return !this.visit(node.expr);
        }
    }

    visit_BinOp(node) {
        switch (node.token.kind) {
            case ("+"):
                return this.visit(node.left) + this.visit(node.right);
            case ("-"):
                return this.visit(node.left) - this.visit(node.right);
            case ("/"):
                return this.visit(node.left) / this.visit(node.right);
            case ("*"):
                return this.visit(node.left) * this.visit(node.right);
            case (">"):
                return this.visit(node.left) > this.visit(node.right);
            case ("<"):
                return this.visit(node.left) < this.visit(node.right);
            case (">="):
                return this.visit(node.left) >= this.visit(node.right);
            case ("<="):
                return this.visit(node.left) <= this.visit(node.right);
            case ("!="):
                return this.visit(node.left) != this.visit(node.right);
            case ("=="):
                return this.visit(node.left) == this.visit(node.right);
            case ("||"):
                return this.visit(node.left) || this.visit(node.right);
            case ("&&"):
                return this.visit(node.left) && this.visit(node.right);
            case ("**"):
                return Math.pow(this.visit(node.left), this.visit(node.right));
            case ("."): {
                let obj = this.visit(node.left);
                let key = node.right.token.value;

                if (obj.hasOwnProperty(key)) {
                    return obj[key];
                }
                break
            }
            case ("in"): {
                let left = this.visit(node.left);
                let right = this.visit(node.right);

                if (isObject(right)) {
                    right = Object.keys(right);
                } else if (isString(right)) {
                    return right.indexOf(left) !== -1;
                }

                return right.some(r => isEqual(left, r));
            }
        }
    }

    visit_List(node) {
        let list = [];

        if (node.list[0] != undefined) {
            node.list.forEach(function (item) {
                list.push(this.visit(item))
            }, this);
        }

        return list
    }

    visit_ArrayAccess(node) {
        let array = this.context[node.token.value];
        let left = null, right = null;

        if (node.left) {
            left = this.visit(node.left);
        }
        if (node.right) {
            right = this.visit(node.right);
        }
        if (left < 0) {
            left = array.length + left
        }
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
            return array.slice(left, right)
        } else {
            return array[left]
        }
    }

    visit_Builtin(node) {
        let args = [];
        let builtin = this.context[node.token.value];
        if (isFunction(builtin)) {
            node.args.forEach(function (item) {
                args.push(this.visit(item))
            }, this);
            return builtin.apply(null, args);
        }
        return builtin
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

exports
    .NewInterpreter = Interpreter;