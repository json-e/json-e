# json-e
json-e is a javascript object prarmetrization module written for embedding context in a javascript object. It supports 
following features

## substitution
It follows this "{{ expression }}" syntax

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

It follows this "${ expression }" or {$eval: expression} syntax.

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
