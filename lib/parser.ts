/* eslint-disable @typescript-eslint/no-explicit-any */
import Lexer from "jly-lexer";
import { Token, EPSILON, END, NonTerminal, Production, Item, ItemSet, LRTable } from "./types";
import { getKeys } from "./util";
type operators = { 0: "left" | "right"; [index: number]: string; [prop: string]: any }[];
export type symbolStack = { lexer: Lexer; parser: Parser; length: number; [index: number]: any };
type bnfItem = {
  handle: string | string[];
  func?: (symbols: symbolStack) => void;
};
type bnf = {
  [nonterminal: string | symbol]: bnfItem | bnfItem[];
};
interface Grammar {
  bnf: bnf;
  startSymbol: string;
  operators?: operators;
  tokens: string | string[];
}
interface Options {
  type: string;
  debug: boolean;
}
class Parser {
  options: Options;
  lrtable?: LRTable;
  symbolStack?: any[];
  terminals: string[];
  lexer?: typeof Lexer;
  startSymbol?: string;
  stateStack?: number[];
  executionStack?: any[];
  log?: {
    stateStack: string;
    symbolStack: string;
    action: string;
  }[];
  productions: Production[];
  symbols: (symbol | string)[];
  artificialStartSymbol?: NonTerminal;
  nonterminals: { [nontermial: symbol | string]: NonTerminal };
  operators: {
    [operator: string]: { precedence: number; associativity: "left" | "right" };
  };

  constructor(grammar: Grammar, options: Options) {
    this.symbols = [];
    this.terminals = [];
    this.operators = {};
    this.productions = [];
    this.nonterminals = {};
    this.options = options;
    this.processGrammar(grammar);
    this.buildLRTable();
  }

  get debug() {
    return this.options.debug || false;
  }

  get type() {
    return this.options.type || "slr";
  }

  firsts(): { [symbol: symbol | string]: (symbol | string)[] } {
    const first: { [symbol: symbol | string]: Set<symbol | string> } = {};
    const getFirst = (prod: Production) => {
      const ret: Set<symbol | string> = new Set();
      if (prod.handle.length === 0) {
        this.nonterminals[prod.symbol].nullable = true;
        ret.add(EPSILON);
      }
      for (let i = 0; i < prod.handle.length; ++i) {
        const symbol = prod.handle[i];
        if (this.terminals.includes(symbol)) {
          ret.add(symbol);
          break;
        }

        first[symbol].forEach((item) => {
          if (item !== EPSILON) {
            ret.add(item);
          }
        });
        if (!this.nonterminals[symbol].nullable) {
          break;
        } else if (i === prod.handle.length - 1) {
          ret.add(EPSILON);
        }
      }
      return ret;
    };
    for (const symbol of getKeys(this.nonterminals)) {
      first[symbol] = new Set();
    }
    while (true) {
      const oldSize = getKeys(first)
        .map((item) => first[item].size)
        .sort()
        .toString();
      for (const prod of this.productions) {
        getFirst(prod).forEach((item) => {
          first[prod.symbol].add(item);
        });
      }
      if (
        getKeys(first)
          .map((item) => first[item].size)
          .sort()
          .toString() === oldSize
      ) {
        break;
      }
    }
    const ret: { [symbol: symbol | string]: (symbol | string)[] } = {};
    getKeys(first).forEach((symbol) => {
      ret[symbol] = Array.from(first[symbol]);
    });
    this.firsts = () => {
      return ret;
    };
    return ret;
  }

  follows() {
    const follow: { [symbol: symbol | string]: Set<symbol | string> } = {};
    const getFollow = (prod: Production) => {
      if (this.nonterminals[prod.handle[prod.handle.length - 1]]) {
        follow[prod.symbol].forEach((item) => {
          follow[prod.handle[prod.handle.length - 1]].add(item);
        });
      }
      for (let i = prod.handle.length - 2; i >= 0; --i) {
        if (this.nonterminals[prod.handle[i]]) {
          if (this.terminals.includes(prod.handle[i + 1])) {
            follow[prod.handle[i]].add(prod.handle[i + 1]);
          } else {
            this.firsts()[prod.handle[i + 1]].forEach((item) => {
              if (item !== EPSILON) {
                follow[prod.handle[i]].add(item);
              }
            });
            if (this.nonterminals[prod.handle[i + 1]].nullable) {
              follow[prod.handle[i + 1]].forEach((item) => {
                follow[prod.handle[i]].add(item);
              });
            }
          }
        }
      }
    };
    for (const symbol of getKeys(this.nonterminals)) {
      follow[symbol] = new Set();
    }
    this.artificialStartSymbol && follow[this.artificialStartSymbol.symbol].add(END);
    while (true) {
      const oldSize = getKeys(follow)
        .map((item) => follow[item].size)
        .sort()
        .toString();
      this.productions.forEach(getFollow);
      if (
        getKeys(follow)
          .map((item) => follow[item].size)
          .sort()
          .toString() === oldSize
      ) {
        break;
      }
    }
    const ret: { [symbol: symbol | string]: (symbol | string)[] } = {};
    getKeys(follow).forEach((symbol) => {
      ret[symbol] = Array.from(follow[symbol]);
    });
    this.follows = () => {
      return ret;
    };
    return ret;
  }

  buildLRTable() {
    this.artificialStartSymbol = new NonTerminal(Symbol("artificial start symbol"));
    this.productions.unshift(new Production(0, this.artificialStartSymbol.symbol, this.startSymbol as string));
    this.artificialStartSymbol.productions.push(this.productions[0]);
    this.nonterminals[this.artificialStartSymbol.symbol] = this.artificialStartSymbol;
    this.symbols.unshift(this.artificialStartSymbol.symbol);
    switch (this.type) {
      case "slr": {
        this.buildLRTable4SLR();
        break;
      }
      /*  case "lr0": {
        this.buildLRTableLR0();
        break;
      }
      case "lr1": {
        this.buildLRTableLR1();
        break;
      }
      case "lalr": {
        this.buildLRTableLALR();
        break;
      }*/
      default: {
        console.warn(`${this.type} is not supported now`);
      }
    }
  }

  buildLRTable4SLR() {
    this.lrtable = new LRTable();
    // get set of firsts
    this.firsts();
    // get set of follows
    const follow = this.follows();

    const getClosure = (initItemSet: ItemSet) => {
      const closure = initItemSet.copy();
      for (let i = 0; i < closure.size; i++) {
        const item = closure.items[i];
        if (this.nonterminals[item.production.handle[item.dotPosition]]) {
          closure.add(
            ...this.nonterminals[item.production.handle[item.dotPosition]].productions.map((prod) => {
              return new Item(prod, 0);
            }),
          );
        }
      }
      return closure;
    };

    const goto = (itemSet: ItemSet, symbol: string | symbol) => {
      const closure = new ItemSet();
      for (let i = 0; i < itemSet.size; ++i) {
        const item = itemSet.items[i];
        if (item.production.handle[item.dotPosition] === symbol) {
          closure.add(item.lookAhead());
        }
      }
      return getClosure(closure);
    };

    // get sets of closure
    let itemSet = new ItemSet();
    if (this.artificialStartSymbol) {
      itemSet.add(new Item(this.artificialStartSymbol.productions[0], 0));
    }
    this.lrtable.addItemSet(getClosure(itemSet));
    for (let i = 0; i < this.lrtable.size; ++i) {
      itemSet = this.lrtable.states[i];
      for (let j = 0; j < itemSet.size; ++j) {
        const item = itemSet.items[j];
        if (item.dotPosition === item.production.handle.length) {
          follow[item.production.symbol].forEach((symbol) => {
            this.lrtable?.reduce(i, symbol, item.production.id);
          });
        }
      }
      for (const symbol of this.symbols) {
        /**
         * if `goto(itemSet, symbol)` is empty or exists in lrtable, then ignore, otherwise add to lrtable
         */
        const nextItemSet = this.lrtable.addItemSet(goto(itemSet, symbol));
        if (nextItemSet !== false) {
          if (this.lrtable.states[nextItemSet].has(this.lrtable.states[0].items[0].lookAhead())) {
            this.lrtable.accept(nextItemSet);
          }
          if (this.terminals.includes(symbol as string)) {
            this.lrtable.shift(i, nextItemSet, symbol);
            if (
              this.lrtable.actions[i][symbol].shift !== undefined &&
              this.lrtable.actions[i][symbol].reduce !== undefined
            ) {
              if (
                !this.operators[symbol as string] ||
                this.productions[this.lrtable.actions[i]?.[symbol]?.reduce as number].precedence <
                  this.operators[symbol as string].precedence
              ) {
                delete this.lrtable.actions[i][symbol].reduce;
              } else {
                delete this.lrtable.actions[i][symbol].shift;
              }
            }
          } else {
            this.lrtable.goto(i, nextItemSet, symbol);
          }
        }
      }
    }
  }

  buildLRTableLR0() {}

  buildLRTableLR1() {}

  buildLRTableLALR() {}

  parse(input: string) {
    if (input === null || typeof input === "undefined") {
      throw TypeError("input must be not null or undefined");
    }
    if (typeof input !== "string") {
      throw TypeError("input must be a string");
    }
    if (!(this.lexer instanceof Lexer)) {
      throw TypeError("lexer of this parser is undefined or not instance of Lexer");
    }
    this.lexer.input(input);
    const getToken = this.lexer.lex.bind(this.lexer);
    this.stateStack = [0];
    this.symbolStack = [];
    this.executionStack = [];
    this.log = [];
    let done = false;
    let terminal;
    let reduce;
    let shift;
    let accept;
    while (true) {
      let type;
      if (done) {
        type = END;
        terminal = new Token(type, this.lexer.yytext, this.lexer.lineno, this.lexer.lex_pos - this.lexer.yytext.length);
      } else if (reduce === undefined) {
        // if previous action is `reduce`, then use previous `terminal`, because action `reduce` doesn't consume `terminal`
        type = getToken();
        terminal = new Token(type, this.lexer.yytext, this.lexer.lineno, this.lexer.lex_pos - this.lexer.yytext.length);
      }
      ({ shift, reduce, accept } =
        this.lrtable?.actions[this.stateStack[this.stateStack.length - 1]][terminal?.type] ?? {});
      if (accept) {
        return this.executionStack[0];
      }
      if (shift !== undefined && reduce !== undefined) {
        throw Error(`reduce: ${reduce} / shift: ${shift} conflict`);
      } else {
        if (shift !== undefined) {
          if (terminal?.type === "EOF") {
            done = true;
          }
          this.stateStack.push(shift);
          if (terminal) {
            this.executionStack.push(terminal);
            this.symbolStack.push(terminal);
          }
          this.log.push({
            stateStack: this.stateStack.join(" "),
            symbolStack: this.symbolStack
              .map((symbol) => {
                if (typeof symbol.type === "symbol") return symbol.type.toString();
                return symbol.type || symbol.toString();
              })
              .join(" "),
            action: `shift ${shift}`,
          });
        } else if (reduce !== undefined) {
          const len = this.productions[reduce].handle.length;
          this.stateStack.splice(this.stateStack.length - len, len);
          this.symbolStack.splice(this.symbolStack.length - len, len);
          const slice = this.executionStack.splice(this.executionStack.length - len, len);
          const p = this.productionProxy(slice);
          if (typeof this.productions[reduce].func === "function") {
            this.productions[reduce].func?.(p);
            const executionResult = p[0];
            this.executionStack.push(executionResult);
            this.symbolStack.push(this.productions[reduce].symbol);
          } else {
            p[0] = { type: this.productions[reduce].symbol, children: slice };
            this.executionStack.push(p[0]);
            this.symbolStack.push(p[0]);
          }
          this.stateStack.push(
            this.lrtable?.actions[this.stateStack[this.stateStack.length - 1]][this.productions[reduce].symbol]
              .goto as number,
          );
          this.log.push({
            stateStack: this.stateStack.join(" "),
            symbolStack: this.symbolStack
              .map((symbol) => {
                if (typeof symbol.type === "symbol") return symbol.type.toString();
                return symbol.type || symbol.toString();
              })
              .join(" "),
            action: `reduce ${this.productions[reduce].toString()}`,
          });
        }
      }
    }
  }

  productionProxy(inputs: any[]): any {
    const proxy = {
      lexer: this.lexer,
      parser: this,
      symbolsOfProduction: [null, ...inputs],
    };
    return new Proxy(proxy, {
      get(target, key) {
        // only allow to access proxy.lexer, proxy.parser, and proxy.symbolsOfProduction
        if ((typeof key === "string" && /^\d+$/.test(key)) || typeof key === "number") {
          return target.symbolsOfProduction[Number(key)];
        }
        if (key === "length") {
          return target.symbolsOfProduction.length;
        }
        if (key === "lexer") {
          return target.lexer;
        }
        if (key === "parser") {
          return target.parser;
        }
        throw RangeError(
          `All property names include 'lexer', 'parser', number, 'length', '${key.toString()}' is not a valid property name.`,
        );
      },
      set(target, key, value) {
        if ((typeof key === "string" && /^\d+$/.test(key)) || typeof key === "number") {
          if (Number(key) >= target.symbolsOfProduction.length) {
            console.warn(`You are not allowed to write to index ${key}, cause it's out of range`);
            return false;
          }
          target.symbolsOfProduction[Number(key)] = value;
          return true;
        } else {
          throw RangeError("Number is the only valid property name");
        }
      },
    });
  }

  processGrammar(grammar: Grammar) {
    if (!grammar.tokens) {
      this.terminals = [];
    } else if (typeof grammar.tokens === "string") {
      this.terminals = grammar.tokens.split(/\s+/).filter((token) => token);
    } else if (Array.isArray(grammar.tokens)) {
      this.terminals = grammar.tokens;
    } else {
      throw TypeError("tokens of Grammar must be a string or array");
    }
    this.symbols.push(...this.terminals, END);
    this.processOperators(grammar.operators);
    this.processProductions(grammar.bnf);
    if (!grammar.startSymbol) {
      throw Error("startSymbol is required");
    } else if (!this.nonterminals[grammar.startSymbol as string]) {
      throw Error(`${grammar.startSymbol} is undefined or not a nonterminal`);
    } else {
      this.startSymbol = grammar.startSymbol;
    }
    return grammar;
  }

  processOperators(operators?: operators) {
    if (!operators) {
      operators = [];
    }
    if (!Array.isArray(operators)) {
      throw TypeError(`${operators} should be array`);
    }
    for (let i = 0; i < operators.length; ++i) {
      for (let j = 1; j < operators[i].length; ++j) {
        this.operators[operators[i][j]] = {
          precedence: i + 1,
          associativity: operators[i][0],
        };
      }
    }
  }

  processProductions(bnf: bnf) {
    this.symbols.push(...getKeys(bnf));

    const check = () => {
      this.productions[this.productions.length - 1].handle.forEach((sym) => {
        if (!this.symbols.includes(sym)) {
          throw RangeError(`'${sym}' is undefined in terminals`);
        }
        if (this.operators[sym]) {
          this.productions[this.productions.length - 1].precedence = Math.max(
            this.productions[this.productions.length - 1].precedence,
            this.operators[sym].precedence,
          );
        }
      });
    };

    const getCustomPrecedence = (handle: string | symbol): [string | symbol, number] => {
      if (typeof handle === "symbol") {
        return [handle, 0];
      }
      const handleWithoutPrec = handle.split("%prec");
      if (handleWithoutPrec.length > 2) {
        throw SyntaxError(`'${handle}' is invalid`);
      }
      if (handleWithoutPrec.length === 2) {
        const precedenceLevel = handleWithoutPrec[1].trim();
        if (precedenceLevel) {
          if (this.operators[precedenceLevel]) {
            return [handleWithoutPrec[0], this.operators[precedenceLevel].precedence];
          } else {
            throw RangeError(`precedence of \`${precedenceLevel}\` is undefined`);
          }
        } else {
          throw SyntaxError("`%prec` must be followed by a precedence name");
        }
      } else if (handleWithoutPrec.length === 1) {
        return [handleWithoutPrec[0], 0];
      }
      // never
      return ["", 0];
    };

    for (const symbol of getKeys(bnf)) {
      if (this.terminals.includes(symbol as string)) {
        throw Error(`'${symbol.toString()}' can't be defined as a nonterminal as it is a terminal`);
      }
      const lenOfProductionsBefore = this.productions.length;
      this.nonterminals[symbol] = new NonTerminal(symbol);
      if (!Array.isArray(bnf[symbol])) {
        bnf[symbol] = [bnf[symbol] as bnfItem];
      }
      for (const prod of bnf[symbol] as bnfItem[]) {
        if (!Array.isArray(prod.handle)) {
          prod.handle = [prod.handle as string];
        }
        prod.handle.forEach((item) => {
          const [handleWithoutPrec, prec] = getCustomPrecedence(item);
          this.productions.push(
            new Production(this.productions.length + 1, symbol, handleWithoutPrec, prod.func, prec),
          );
          check();
        });
      }
      this.nonterminals[symbol].productions = this.productions.slice(lenOfProductionsBefore);
    }
  }
}
export { Production, Parser, END };
