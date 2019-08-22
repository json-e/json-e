use regex;

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
    fn new(ignore: String, patterns: HashMap<String, String>, token_types: Vec<String>) {
        let components: Vec<String> = vec![format!("({})", ignore)];

        let regex = regex::Regex::new(components.join("|"));

        Tokenizer { token_types, regex }
    }
}