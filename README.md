# json-e
json-e is a javascript object prarmetrization module written for embedding context in a javascript object. It supports 
following features

## inteface

This module exposes following interface

```javascript
// template is js object to be rendered
// context provides functions/properties to be used
var par = Parameterize(template1, context1); //constructor
par.setNewTemplate(template2); //replaces template1 with template2
par.setNewContext(context2); //replaces context1 with context2
par.getTemplate(); //returns current template
par.getContext(); //returns current context
par.render(); //renders template using context
```

## substitution
It follows this "{{ expression }}" syntax. expression can be anything javascript eval can
digest and provide a context object.

```javascript
//substitution
//propert access
var template = {a: "{{ foo.bar }}"};

var context = {foo: {
  bar: "zoo"
}};

var par = new Parameterize(template, context);
par.render();
console.log(par.getTemplate());

/*
output > {a: "zoo"};
*/
```

```javascript
//substitution
//function evaluation
var template = {a: "{{ foo.bar() }}"};

var context = {foo: {
  bar: function() {return 1;}
}};

var par = new Parameterize(template, context);
par.render();
console.log(par.getTemplate());

/*
output > {a: "1"};
*/
```


## evaluation

It follows this "${ expression }" or {$eval: expression} syntax. expression can be anything javascript eval can
digest and provide a context object.

```javascript
var template = {a: "${ foo.bar }"};

var context = {foo: {
  bar: 123
}};

var par = new Parameterize(template, context);
par.render();
console.log(par.getTemplate());

/*
output > {a: 123};
*/
```

```javascript
var template = {a: "${ foo.bar() }"};

var context = {foo: {
  bar: function() {return 1;}
}};

var par = new Parameterize(template, context);
par.render();
console.log(par.getTemplate());

/*
output > {a: 1};
*/
```

```javascript
var template = {a: : {$eval: "{{ foo.bar() }}"}};

var context = {foo: {
  bar: function() {return 1;}
}};

var par = new Parameterize(template, context);
par.render();
console.log(par.getTemplate());

/*
output > {a: "1"};
*/
```

```javascript
var template = {a: {$eval: "${ foo.bar() }"}};

var context = {foo: {
  bar: function() {return 1;}
}};

var par = new Parameterize(template, context);
par.render();
console.log(par.getTemplate());

/*
output > {a: 1};
*/
```



## array access

We can access array elements using $array_name(index) syntax

```javascript
var template = {image_version: "{{task.$images(0).$versions(0)}}", name: "{{task.$images(0).name}}"};
var context = {task: {
          images: [{versions: ["12.10", ], name: "ubuntu"}]
}};
var par = new Parameterize(template, context);
par.render();
console.log(par.getTemplate());

/*
output > {image_version: "12.10", name: "ubuntu"}
*/
```



## $if construct

We can use $if contruct to choose between two different objects for evaluation


```javascript
var template = {a: {
  $if: "${ key1 < key2 }",
  $then: "${ foo.func1() }",
  $else: "${ foo.func2() }"
}};

var context = {foo: {
  func1: function() {return 1;},
  func2: function() {return 2;}
}, key1: 1, key2: 2};

var par = new Parameterize(template, context);
par.render();
console.log(par.getTemplate());

/*
output > {a: 1};
*/
```

$then and $else also supports substitution and recursive object evaluation. Following is an example for recursive object evaluation

```javascript
var template = {a: {
  $if: "${ key1 > key2 }",
  $then: {b: "${ foo.func1() }"},
  $else: {b: "${ foo.func2() }"}
}};

var context = {foo: {
  func1: function() {return 1;},
  func2: function() {return 2;}
}, key1: 1, key2: 2};

var par = new Parameterize(template, context);
par.render();
console.log(par.getTemplate());

/*
output > {a: {b: 1}};
*/
```

## $switch construct
this construct can be used in the following ways

```javascript
var template = {a: {
  "$switch": "{{ 'case' + a }}",
  case1: "foo",
  case2: "bar"
}};

var context = {a: "1"};
var par = new Parameterize(template, context);
par.render();
console.log(par.getTemplate());

/*
output > {a: "foo"};
*/
```

```javascript
var template = {a: {
  "$switch": "{{ 'case' + a }}",
  caseA: {b:1}
}};

var context = {a: "A"};
var par = new Parameterize(template, context);
par.render();
console.log(par.getTemplate());

/*
output > {a: {b: 1}};
*/
```

instead of js object we can use ${ expression } syntax as case value.

## Note

This module provides recursive evaluation of js objects and arrays for templates,
along with deep property access from the context.

For more info checkout src/tests.js
