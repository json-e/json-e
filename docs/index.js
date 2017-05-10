import jsone from "../lib";

$(function() {
    //hang on event of form with id=myform
    $("button").click(function(e) {
        //prevent Default functionality
        e.preventDefault();

        var template = $("#template").val();
        var context = $("#context").val();

        eval("template" + "=" + template);
        eval("context" + "=" + context);

        var output = jsone(template, context);

        $("textarea").val(JSON.stringify(output));

        return false;
    });

});
