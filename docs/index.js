"use strict";

var _lib = require("../lib");

var _lib2 = _interopRequireDefault(_lib);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

$(function() {
    //hang on event of form with id=myform
    $("form").submit(function(e) {
        //prevent Default functionality
        e.preventDefault();

        var template = $("#template").val();
        var context = $("#context").val();

        eval("template" + "=" + template);
        eval("context" + "=" + context);

        var output = (0, _lib2.default)(template, context);

        $("textarea").val(JSON.stringify(output));

        return false;
    });

});
