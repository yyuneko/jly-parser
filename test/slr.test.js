import Lexer from "jly-lexer";
import { Parser } from "../lib/parser";
import { describe, expect, test } from "@jest/globals";

describe("# test calculator", () => {
    let grammar = {
        startSymbol: "E",
        tokens: ["NUMBER", "PLUS", "MINUS", "MODULO", "TIMES", "DIVIDE", "LPAREN", "RPAREN"],
        operators: [["left", "PLUS", "MINUS"], ["left", "DIVIDE", "MODULO", "TIMES"], ["right", "L1"]],
        bnf: {
            "E": [{
                handle: ["E PLUS E", "E MINUS E", "E MODULO E", "E TIMES E", "E DIVIDE E"],
                func: function (symbols) {
                    switch (symbols[2].type) {
                        case "PLUS": {
                            symbols[0] = symbols[1] + symbols[3];
                            // symbols[0] = symbols[1] + parseFloat(symbols[3].value);
                            break;
                        }
                        case "MINUS": {
                            // symbols[0] = symbols[1] - parseFloat(symbols[3].value);
                            symbols[0] = symbols[1] - symbols[3];
                            break;
                        }
                        case "MODULO": {
                            // symbols[0] = symbols[1] % parseFloat(symbols[3].value);
                            symbols[0] = symbols[1] % symbols[3];
                            break;
                        }
                        case "TIMES": {
                            // symbols[0] = symbols[1] * parseFloat(symbols[3].value);
                            symbols[0] = symbols[1] * symbols[3];
                            break;
                        }
                        case "DIVIDE": {
                            // symbols[0] = symbols[1] / parseFloat(symbols[3].value);
                            symbols[0] = symbols[1] / symbols[3];
                            break;
                        }
                    }
                    console.log(`${symbols[1]} ${symbols[2].value} ${symbols[3]} = ${symbols[0]}`);
                }
            }, {
                handle: "NUMBER",
                func: function (symbols) {
                    symbols[0] = parseFloat(symbols[1].value);
                }
            }, {
                handle: "MINUS E %prec L1",
                func: function (symbols) {
                    symbols[0] = -symbols[2];
                }
            }, {
                handle: "LPAREN E RPAREN",
                func: function (symbols) {
                    symbols[0] = symbols[2];
                }
            }],
        }
    }
    let parser = new Parser(grammar, { type: "slr", debug: true });
    parser.lexer = new Lexer({
        macros: {
            "int": "(?:[0-9]|[1-9][0-9]+)",
            "exp": "(?:[eE][-+]?[0-9]+)",
            "frac": "(?:\\.[0-9]+)"
        },
        rules: [{
            r: "{int}{frac}?{exp}?\\b",
            name: "number",
            func: function (t) {
                return 'NUMBER';
            }
        }, {
            r: /\n/, name: "new_line", func: function (t) {
                t.lexer.lineno++;
            }
        }, {
            r: /\s+/, name: "skip", // if `name` is skip, the text that match this rule will be ignored
        }, { r: /\(/, name: "LPAREN" }, { r: /\)/, name: "RPAREN" }, {
            r: /\+/,
            name: "PLUS"
        }, {
            r: "-",
            name: "MINUS"
        }, {
            r: /\*/,
            name: "TIMES"
        }, {
            r: /\//,
            name: "DIVIDE"
        }, {
            r: "%",
            name: "MODULO"
        }],
        tokens: ["NUMBER", "PLUS", "MINUS", "MODULO", "TIMES", "DIVIDE", "LPAREN", "RPAREN"]
    })
    test("1+2/5*3=2.2", () => {
        expect(parser.parse("1+2/5*3")).toBe(2.2);
    })
    test("(1.3+2)*10%2=1", () => {
        expect(parser.parse("(1.3+2)*10%2")).toBe(1);
    })
    test("56/(2*3.5)=8", () => {
        expect(parser.parse("56/(2*3.5)")).toBe(8);
    })
    test("-23*2e2/5=-920", () => {
        expect(parser.parse("-23*2e2/5")).toBe(-920);
    })
})

describe("# test 2", () => {
    let grammar = {
        startSymbol: "MAIN",
        operators: [['left', 'LOR'],
        ['right', 'LAND'],
        ['left', 'EQ', 'NE'],
        ['left', 'GT', 'LT', 'GE', 'LE'],
        ['left', 'PLUS', 'MINUS'],
        ['right', 'TIMES'],
        ['left', 'MODULO', 'DIVIDE'],
        ['left', 'LPAREN', 'RPAREN', 'LBRACKET', 'RBRACKET'],
        ],
        tokens: [
            // Program
            'PROGRAM',

            // Operators (+,-,*,/,%,|,&,~,^,<<,>>, ||, &&, !, <, <=, >, >=, ==, !=)
            'PLUS', 'MINUS', 'TIMES', 'DIVIDE', 'MODULO',
            'OR', 'AND', 'NOT', 'XOR', 'LSHIFT', 'RSHIFT',
            'LOR', 'LAND', 'LNOT',
            'LT', 'LE', 'GT', 'GE', 'EQ', 'NE',

            // Assignment (=, *=, /=, %=, +=, -=, <<=, >>=, &=, ^=, |= , :=)
            'EQUALS', 'TIMESEQUAL', 'DIVEQUAL', 'MODEQUAL', 'PLUSEQUAL', 'MINUSEQUAL',
            'LSHIFTEQUAL', 'RSHIFTEQUAL', 'ANDEQUAL', 'XOREQUAL', 'OREQUAL', 'COLONEQUAL',

            // Increment/decrement (++,--)
            'INCREMENT', 'DECREMENT',

            // Delimeters ( ) [ ] { } , .. ; :
            'LPAREN', 'RPAREN',
            'LBRACKET', 'RBRACKET',
            'LBRACE', 'RBRACE',
            'COMMA', 'DPERIOD', 'SEMI',

            // Ellipsis (...)
            'ELLIPSIS',

            // Ternary operator (?)
            'TERNARY',

            'IGNORE',
            'INT',
            'FLOAT',
            'FOR',
            'IF',
            'ELSE',
            'WHILE',
            'IN',
            // Literals (identifier, integer=<NUM> , float=<REAL> constant, string constant, char const)
            'ID', 'NUM', 'REAL',
        ],
        bnf: {
            "MAIN": [{
                handle: "PROGRAM ID LBRACE STATEMENTS RBRACE"
            }],
            "TYPE": [{
                handle: ["INT", "FLOAT"]
            }],
            "DECLARATION": [{
                handle: "TYPE LIST_DECLARATION"
            }],
            "LIST_DECLARATION": [{
                handle: ["LIST_DECLARATION COMMA DECLARATION_FINAL", "DECLARATION_FINAL"]
            }],
            "DECLARATION_FINAL": [{
                handle: "TERNARY ID"
            }, {
                handle: "ID INDICES"
            }, {
                handle: "ID INDICES EQUALS EXPRESSION"
            }, {
                handle: "TERNARY ID EQUALS EXPRESSION"
            }],
            "INDICES": [{
                handle: ["ACCESSES", ""]
            }],
            "ACCESS": [{
                handle: ["LBRACKET EXPRESSION PLUS  RBRACKET", "LBRACKET EXPRESSION MINUS  RBRACKET", "LBRACKET EXPRESSION TIMES RBRACKET", "LBRACKET EXPRESSION DIVIDE RBRACKET", "LBRACKET EXPRESSION MODULO RBRACKET", "LBRACKET  TIMES EXPRESSION RBRACKET", "LBRACKET  DIVIDE EXPRESSION  RBRACKET", "LBRACKET  MODULO EXPRESSION  RBRACKET", "LBRACKET LAND EXPRESSION  RBRACKET", "LBRACKET LOR EXPRESSION  RBRACKET", "LBRACKET EXPRESSION LAND RBRACKET", "LBRACKET EXPRESSION LOR RBRACKET",]
            }, {
                handle: "LBRACKET EXPRESSION RBRACKET"
            }],
            "EXPRESSION": [{
                handle: ["EXPRESSION PLUS EXPRESSION", "EXPRESSION MINUS EXPRESSION", "EXPRESSION TIMES EXPRESSION", "EXPRESSION DIVIDE EXPRESSION", "EXPRESSION MODULO EXPRESSION",]
            }, {
                handle: ["EXPRESSION EQ EXPRESSION", "EXPRESSION NE EXPRESSION", "EXPRESSION GT EXPRESSION", "EXPRESSION LT EXPRESSION", "EXPRESSION GE EXPRESSION", "EXPRESSION LE EXPRESSION",]
            }, {
                handle: ["EXPRESSION LAND EXPRESSION", "EXPRESSION LOR EXPRESSION",]
            }, {
                handle: ["MINUS EXPRESSION", "LNOT EXPRESSION", "NOT EXPRESSION",]
            }, {
                handle: "LPAREN EXPRESSION RPAREN"
            }, {
                handle: ["ID", "ID ACCESSES",]
            }, {
                handle: "NUM"
            }, {
                handle: "REAL"
            }],
            "ACCESSES": [{
                handle: ["ACCESSES ACCESS", "ACCESS",]
            }],
            "STATEMENTS": [{
                handle: ["STATEMENTS STATEMENT", "",]
            }],
            "STATEMENT": [{
                handle: ["ASSIGNMENT SEMI", "DECLARATION SEMI", "IF_STATEMENT", "FOR_STATEMENT", "WHILE_STATEMENT",]
            }],
            "ASSIGNMENT": [{
                handle: ["ID INDICES COMPOUND EXPRESSION",]
            }],
            "COMPOUND": [{
                handle: ["EQUALS", "PLUSEQUAL", "MINUSEQUAL", "TIMESEQUAL", "DIVEQUAL", "MODEQUAL",]
            }],
            "BLOCK": [{ handle: ["LBRACE  STATEMENTS  RBRACE", "STATEMENT",] }],
            "IF_STATEMENT": [{ handle: ["IF LPAREN EXPRESSION RPAREN BLOCK ELSE_STATEMENT",] }],
            "ELSE_STATEMENT": [{ handle: ["ELSE BLOCK", "",] }],
            "FOR_STATEMENT": [{ handle: ["FOR LPAREN ID IN NUM DPERIOD NUM RPAREN BLOCK",] }],
            "WHILE_STATEMENT": [{ handle: ["WHILE LPAREN EXPRESSION RPAREN BLOCK",] }],


        }
    }
    let parser = new Parser(grammar, { type: "slr", debug: true });
    console.log(
        `Rules:\n\t${parser.productions.map((prod, index) => {
            return index + ": " + prod.toString()
        }).join('\n\t')}
First:\n\t${Reflect.ownKeys(parser.firsts()).map(key => {
            return key.toString() + ": " + parser.firsts()[key].map(item => item.toString()).join(", ");
        }).join('\n\t')}

Follow:\n\t${Reflect.ownKeys(parser.follows()).map(key => {
            return key.toString() + ": " + parser.follows()[key].map(item => item.toString()).join(", ");
        }).join('\n\t')}

States:\n${parser.lrtable.toString()}`)
    let lexData = {
        tokens: grammar.tokens,
        rules: [
            {
                "r": /(0)(\d+)/.toString().slice(1).slice(0, -1),
                "name": "NUM_OCT",
                func: function (t) {
                    t.lexer.yytext = parseInt(t.yytext, 8).toString();
                    return "NUM";
                }
            },
            {
                "r": /(0x)(\d+)/.toString().slice(1).slice(0, -1),
                "name": "NUM_HEX",
                func: function (t) {
                    t.lexer.yytext = parseInt(t.yytext, 16).toString();
                    return "NUM";
                }
            },
            {
                "r": /\d+\.\d+/.toString().slice(1).slice(0, -1),
                "name": "REAL"
            },
            {
                "r": /(\d+)/.toString().slice(1).slice(0, -1),
                "name": "NUM"
            },
            {
                "r": /(\/\/.*)(\n)/.toString().slice(1).slice(0, -1),
                "name": "CPPCOMMENT",
                func: function (t) {
                    t.lexer.lineno++;
                }
            },
            {
                "r": /\.\.\./.toString().slice(1).slice(0, -1),
                "name": "ELLIPSIS"
            },
            {
                "r": /\.\./.toString().slice(1).slice(0, -1),
                "name": "DPERIOD"
            },
            {
                "r": /\+\+/.toString().slice(1).slice(0, -1),
                "name": "INCREMENT"
            },
            {
                "r": /\|\|/.toString().slice(1).slice(0, -1),
                "name": "LOR"
            },
            {
                "r": /\*=/.toString().slice(1).slice(0, -1),
                "name": "TIMESEQUAL"
            },
            {
                "r": /\+=/.toString().slice(1).slice(0, -1),
                "name": "PLUSEQUAL"
            },
            {
                "r": /<<=/.toString().slice(1).slice(0, -1),
                "name": "LSHIFTEQUAL"
            },
            {
                "r": />>=/.toString().slice(1).slice(0, -1),
                "name": "RSHIFTEQUAL"
            },
            {
                "r": /\|=/.toString().slice(1).slice(0, -1),
                "name": "OREQUAL"
            },
            {
                "r": /\^=/.toString().slice(1).slice(0, -1),
                "name": "XOREQUAL"
            },
            {
                "r": /:=/.toString().slice(1).slice(0, -1),
                "name": "COLONEQUAL"
            },
            {
                "r": /\t| /.toString().slice(1).slice(0, -1),
                "name": "ignore_IGNORE",
                func: function () {
                }
            },
            {
                "r": "\\(",
                "name": "LPAREN"
            },
            {
                "r": "\\)",
                "name": "RPAREN"
            },
            {
                "r": "\\[",
                "name": "LBRACKET"
            },
            {
                "r": "\\]",
                "name": "RBRACKET"
            },
            {
                "r": "\\{",
                "name": "LBRACE"
            },
            {
                "r": "\\}",
                "name": "RBRACE"
            },
            {
                "r": "\\?",
                "name": "TERNARY"
            },
            {
                "r": /\/=/.toString().slice(1).slice(0, -1),
                "name": "DIVEQUAL"
            },
            {
                "r": "%=",
                "name": "MODEQUAL"
            },
            {
                "r": "-=",
                "name": "MINUSEQUAL"
            },
            {
                "r": "&=",
                "name": "ANDEQUAL"
            },
            {
                "r": "--",
                "name": "DECREMENT"
            },
            {
                "r": "\\+",
                "name": "PLUS"
            },
            {
                "r": "\\*",
                "name": "TIMES"
            },
            {
                "r": "\\|",
                "name": "OR"
            },
            {
                "r": "\\^",
                "name": "XOR"
            },
            {
                "r": "<<",
                "name": "LSHIFT"
            },
            {
                "r": ">>",
                "name": "RSHIFT"
            },
            {
                "r": "&&",
                "name": "LAND"
            },
            {
                "r": ",",
                "name": "COMMA"
            },
            {
                "r": ";",
                "name": "SEMI"
            },
            {
                "r": "=",
                "name": "EQUALS"
            },
            {
                "r": "-",
                "name": "MINUS"
            },
            {
                "r": "\/",
                "name": "DIVIDE"
            },
            {
                "r": "%",
                "name": "MODULO"
            },
            {
                "r": "&",
                "name": "AND"
            },
            {
                "r": "\\~",
                "name": "NOT"
            },
            {
                "r": "!",
                "name": "LNOT"
            },
            {
                "r": "<",
                "name": "LT"
            },
            {
                "r": ">",
                "name": "GT"
            },
            {
                "r": "<=",
                "name": "LE"
            },
            {
                "r": ">=",
                "name": "GE"
            },
            {
                "r": "==",
                "name": "EQ"
            },
            {
                "r": "!=",
                "name": "NE"
            },
            {
                "r": /\b[Pp][Rr][Oo][Gg][Rr][Aa][Mm]\b/.toString().slice(1).slice(0, -1),
                "name": "PROGRAM"
            },
            {
                "r": "\\b[Ii][Nn][Tt]\\b",
                "name": "INT"
            },
            {
                "r": "\\b[Ff][Ll][Oo][Aa][Tt]\\b",
                "name": "FLOAT"
            },
            {
                "r": "\\b[Ff][Oo][Rr]\\b",
                "name": "FOR"
            },
            {
                "r": "\\b[iI][fF]\\b",
                "name": "IF"
            },
            {
                "r": "\\b[Ee][Ll][Ss][Ee]\\b",
                "name": "ELSE"
            },
            {
                "r": "\\b[wW][hH][iI][lL][eE]\\b",
                "name": "WHILE"
            },
            {
                "r": "\\b[iI][nN]\\b",
                "name": "IN"
            },
            {
                "r": "\\n",
                "name": "newline",
                func: function (t) {
                    t.lexer.lineno++;
                }
            },
            {
                "r": /\b[A-Za-z_][A-Za-z0-9_]*\b/.toString().slice(1).slice(0, -1),
                "name": "ID"
            },
        ]
    }
    parser.lexer = new Lexer(lexData);
    try {
        parser.parse(`program test
      {
         int a[10][20], i, j, k;
         float? b;
         if(k>9 && i<=7){
            b=19.3;
         }else{
            a[3][0]=19;
            for(i in 1..20) a[3][i]=a[3][i-2]        ;
         }
         for(i in 1..20) a[3][i]=a[0][i-1];
            }
`);
    } catch (e) {
        console.error(e);
    } finally {
        console.table(parser.log);
    }
    console.table(parser.lrtable.actions)
})