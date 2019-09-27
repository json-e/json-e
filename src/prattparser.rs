use crate::tokenizer::Tokenizer;
use std::collections::HashMap;

pub struct PrattParser<'a> {
    tokenizer: Tokenizer<'a>,
    precedence_map: HashMap<&'a str, usize>,
}

impl<'a> PrattParser<'a> {
    pub fn new<F, G>(
        ignore: &str,
        patterns: HashMap<&str, &str>,
        token_types: Vec<&'a str>,
        precedence: Vec<Vec<&'a str>>,
        prefix_rules: HashMap<&str, F>,
        infix_rules: HashMap<&str, G>,
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
        }
    }
}

struct Context {}
