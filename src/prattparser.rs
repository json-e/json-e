use crate::tokenizer::Tokenizer;
use std::collections::HashMap;
use crate::tokenizer::Token;

pub struct PrattParser<'a> {
    tokenizer: Tokenizer<'a>,
    precedence_map: HashMap<&'a str, usize>,
    prefix_rules: HashMap<&'a str, fn(&Token) -> usize>,
    infix_rules: HashMap<&'a str, fn(&Token) -> usize>,
}

impl<'a> PrattParser<'a> {
    pub fn new(
        ignore: &str,
        patterns: HashMap<&str, &str>,
        token_types: Vec<&'a str>,
        precedence: Vec<Vec<&'a str>>,
        prefix_rules: HashMap<&'a str, fn(&Token) -> usize>,
        infix_rules: HashMap<&'a str, fn(&Token) -> usize>,
    ) -> PrattParser<'a> {
        let tokenizer = Tokenizer::new(ignore, patterns, token_types);
        let mut precedence_map: HashMap<&'a str, usize> = HashMap::new();

        for (i, row) in precedence.iter().enumerate() {
            for kind in row.iter() {
                precedence_map.insert(kind, i + 1);
            }
        }

        for kind in infix_rules.keys() {
            if !precedence_map.contains_key(kind) {
                // TODO: return a Result
                panic!("token must have a precedence");
            }
        }

        PrattParser {
            tokenizer,
            precedence_map,
            prefix_rules,
            infix_rules,
        }
    }
}

struct Context {}

mod tests {
    use crate::prattparser::PrattParser;
    use std::collections::HashMap;
    use crate::tokenizer::Token;

    #[test]
    fn positive_constructor() {
        let mut patterns = HashMap::new();
        patterns.insert("number", "[0-9]+");
        patterns.insert("identifier", "[a-z]+");
        patterns.insert("snowman", "☃");

        let mut prefix: HashMap<&str, fn(&Token) -> usize> = HashMap::new();
        prefix.insert("snowman", |token: &Token|{10});

        let mut infix: HashMap<&str, fn(&Token) -> usize> = HashMap::new();
        infix.insert("snowman", |token|{10});
        infix.insert("+", |token|{10});

        let pp = PrattParser::new(
            "[ ]+",
            patterns,
            vec!["number", "identifier", "+", "snowman"],
            vec![vec!["snowman"],vec!["+"]],
            prefix,
            infix
        );
    }
}
