# Playground

This page executes JSON-e live in your browser.

```yaml,jsone-playground
template:
  message:
    $eval: payload.message_body
context:
  payload:
    message_body: "Hello, world!"
result:
  message: Hello, world!
```
