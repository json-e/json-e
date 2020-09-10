/// A node in the AST.  Minimal interpretation is done to construct this tree, so most nodes
/// contain &str references to their content, for parsing only during evaluation.
#[derive(Debug, Eq, PartialEq, Clone)]
pub(crate) enum Node<'a> {
    /// Literal number
    Number(&'a str),

    /// Literal string
    String(&'a str),

    /// Literal identifier
    Ident(&'a str),

    /// JSON literal (null, true, false)
    Literal(&'a str),

    /// Array Literal
    Array(Vec<Node<'a>>),

    /// Object Literal
    Object(Vec<(&'a str, Node<'a>)>),

    /// Unary operation
    Un(&'a str, Box<Node<'a>>),

    /// Binary operation
    Op(Box<Node<'a>>, &'a str, Box<Node<'a>>),

    /// Index operation (`x[y]`)
    Index(Box<Node<'a>>, Box<Node<'a>>),

    /// Slice operation (`w[x:y]`)
    Slice(Box<Node<'a>>, Option<Box<Node<'a>>>, Option<Box<Node<'a>>>),

    /// Dot operation
    Dot(Box<Node<'a>>, &'a str),

    /// Function invocation
    Func(Box<Node<'a>>, Vec<Node<'a>>),
}
