use regex;
use std::collections::HashMap;
use std::fmt::Write;

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
    pub fn new(ignore: String, patterns: HashMap<String, String>, token_types: Vec<String>) -> Tokenizer {
        let re = Tokenizer::build_regex_string(ignore, patterns, &token_types).unwrap();

        let regex = regex::Regex::new(&re).unwrap();

        Tokenizer { token_types, regex }
    }

    fn build_regex_string(ignore: String, patterns: HashMap<String, String>, token_types: &[String]) -> Result<String, std::fmt::Error> {
        let mut re = String::new();

        write!(&mut re, "^(?:")?;

        write!(&mut re, "({})", ignore)?;

        for t in token_types {
            match patterns.get(t) {
                Some(p) => write!(&mut re, "|({})", p)?,
                None => write!(&mut re, "|({})", regex::escape(t))?
            }
        }

        write!(&mut re, ")")?;

        Ok(re)
    }

    pub fn tokenize(self: &mut Self, source: String, offset: usize) {
        let token = Token{
            token_type: "".to_string(),
            value: "".to_string(),
            start: 0,
            end: offset,
        };
        //let tokens = vec![];
    }

//    fn next(self: &mut Self, source: String, offset: usize) {
//        let mut m: regex::Captures;
//        let i: usize;
//
//        loop {
//            m = match self.regex.captures(&source[offset..]) {
//                None => {
//                    if (&source[offset..] != "") {
//                        panic!(format!("unexpected EOF for {} at {}", &source, &source[offset..]));
//                    }
//                },
//                Some(ref match) => {
//                },
//            }
//        }
//    }
}

mod tests {
    use crate::tokenizer::Tokenizer;
    use std::collections::HashMap;

    #[test]
    fn build_regex_positive_string() {
        let re = Tokenizer::build_regex_string(
            "ign".to_string(),
            HashMap::new(),
            &vec!["abc".to_string(), "def".to_string()]
        ).unwrap();

        assert_eq!(re, "^(?:(ign)|(abc)|(def))")
    }

    #[test]
    fn build_regex_positive_hashmap() {
        let mut hashmap = HashMap::new();
        hashmap.insert("number".to_string(), "[0-9]+".to_string());
        hashmap.insert("identifier".to_string(), "[a-z]+".to_string());

        let re = Tokenizer::build_regex_string(
            "ign".to_string(),
            hashmap,
            &vec!["number".to_string(), "identifier".to_string()]
        ).unwrap();

        assert_eq!(re, "^(?:(ign)|([0-9]+)|([a-z]+))")
    }

    #[test]
    fn build_regex_positive_escape() {
        let re = Tokenizer::build_regex_string(
            "ign".to_string(),
            HashMap::new(),
            &vec!["*+?".to_string()]
        ).unwrap();

        assert_eq!(re, "^(?:(ign)|(\\*\\+\\?))")
    }

    #[test]
    fn constructor_positive() {
        let t = Tokenizer::new(
            "ign".to_string(),
            HashMap::new(),
            vec!["*+?".to_string()]
        );
    }

}