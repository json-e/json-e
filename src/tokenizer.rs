use regex;
use std::collections::HashMap;

struct Tokenizer {
    token_types: Vec<String>,
    regex: regex::Regex
}

struct Token {
    token_type: String,
    value: String,
    start: usize,
    end: usize
}

impl Tokenizer {
    fn new(ignore: String, patterns: HashMap<String, String>, token_types: Vec<String>) -> Tokenizer {
        let components: Vec<String> = vec![format!("({})", ignore)];

        let regex = regex::Regex::new(&components.join("|")).unwrap();

        Tokenizer { token_types, regex }
    }

    fn tokenize(self: &mut Self, source: String, offset: usize) {
        let token = Token{
            token_type: "".to_string(),
            value: "".to_string(),
            start: 0,
            end: offset,
        };
        //let tokens = vec![];
    }

    fn next(self: &mut Self, source: String, offset: usize) {
        let mut m: regex::Captures;
        let i: usize;

        loop {
            m = match self.regex.captures(&source[offset..]) {
                None => {
                    if (&source[offset..] != "") {
                        panic!(format!("unexpected EOF for {} at {}", &source, &source[offset..]));
                    }
                },
                Some(ref match) => {
                },
            }
        }
    }
}
