import Lexer from "jly-lexer";
import { Token, EPSILON, END, NonTerminal, Production, Item, ItemSet, LRTable } from "./types";
import { getKeys } from "./util";
type operators = { 0: "left" | "right"; [index: number]: string; [prop: string]: any }[];
type bnfItem = {
  handle: string | string[];
  func?: (symbols: { lexer: typeof Lexer; parser: Parser; length: number; [index: number]: any }) => void;
};
type bnf = {
  [nonterminal: string | symbol]: bnfItem | bnfItem[];
};
interface grammar {
  startSymbol: string;
  tokens: string | string[];
  operators?: operators;
  bnf: bnf;
}
interface options {
  type: string;
  debug: boolean;
}
class Parser {
  options: options;
  lexer?: typeof Lexer;
  startSymbol?: string;
  artificialStartSymbol?: NonTerminal;
  productions: Production[];
  operators: {
    [operator: string]: { precedence: number; associativity: "left" | "right" };
  };
  nonterminals: { [nontermial: symbol | string]: NonTerminal };
  symbols: (symbol | string)[];
  terminals: string[];
  lrtable?: LRTable;
  stateStack?: number[];
  symbolStack?: any[];
  log?: {
    stateStack: string;
    symbolStack: string;
    action: string;
  }[];
  constructor(grammar: grammar, options: options) {
    this.options = options;
    this.lexer = undefined;
    this.startSymbol = undefined;
    this.productions = [];
    this.operators = {};
    this.nonterminals = {};
    this.symbols = [];
    this.terminals = [];
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
      for (let i = 0; i < prod.handle.length; ++i) {
        const symbol = prod.handle[i];
        if (this.terminals.includes(symbol)) {
          ret.add(symbol);
          break;
        }
        first[symbol].forEach((item) => {
          if (item !== EPSILON) ret.add(item);
        });
        if (!this.nonterminals[symbol].nullable) break;
        else if (i === prod.handle.length - 1) {
          ret.add(EPSILON);
        }
      }
      return ret;
    };
    for (let symbol of getKeys(this.nonterminals)) {
      first[symbol] = new Set();
    }
    while (true) {
      const oldSize = getKeys(first)
        .map((item) => first[item].size)
        .sort()
        .toString();
      for (let prod of this.productions) {
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
              if (item !== EPSILON) follow[prod.handle[i]].add(item);
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
    for (let symbol of getKeys(this.nonterminals)) {
      follow[symbol] = new Set();
    }
    this.artificialStartSymbol && follow[this.artificialStartSymbol.symbol].add(END);
    while (true) {
      let oldSize = getKeys(follow)
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
    const first = this.firsts();
    // get set of follows
    const follow = this.follows();
    const getClosure = (initItemSet: ItemSet) => {
      let closure = initItemSet.copy();
      for (let i = 0; i < closure.size; i++) {
        const item = closure.items[i];
        if (this.nonterminals.hasOwnProperty(item.production.handle[item.dotPosition])) {
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
      let closure = new ItemSet();
      for (let i = 0; i < itemSet.size; ++i) {
        let item = itemSet.items[i];
        if (item.production.handle[item.dotPosition] === symbol) {
          closure.add(item.lookAhead());
        }
      }
      return getClosure(closure);
    };
    // get sets of closure
    let itemSet = new ItemSet();
    this.artificialStartSymbol && itemSet.add(new Item(this.artificialStartSymbol.productions[0], 0));
    this.lrtable.addItemSet(getClosure(itemSet));
    for (let i = 0; i < this.lrtable.size; ++i) {
      itemSet = this.lrtable.states[i];
      for (let j = 0; j < itemSet.size; ++j) {
        let item = itemSet.items[j];
        if (item.dotPosition === item.production.handle.length) {
          follow[item.production.symbol].forEach((symbol) => {
            this.lrtable?.reduce(i, symbol, item.production.id);
          });
        }
      }
      for (let symbol of this.symbols) {
        /**
         * if `goto(itemSet, symbol)` is empty or exists in lrtable, then ignore, otherwise add to lrtable
         */
        let nextItemSet = this.lrtable.addItemSet(goto(itemSet, symbol));
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
    if (input === null || typeof input === "undefined") throw TypeError("input must be not null or undefined");
    if (typeof input !== "string") throw TypeError("input must be a string");
    if (!(this.lexer instanceof Lexer)) throw TypeError("lexer of this parser is undefined or not instance of Lexer");
    this.lexer.input(input);
    const getToken = this.lexer.lex.bind(this.lexer);
    this.stateStack = [0];
    this.symbolStack = [];
    this.log = [];
    let terminal, reduce, shift;
    while (true) {
      // if previous action is `reduce`, then use previous `terminal`, because action `reduce` doesn't consume `terminal`
      if (reduce === undefined) {
        let type: string | symbol = getToken();
        if (type === "EOF") {
          type = END;
        }
        terminal = new Token(type, this.lexer.yytext, this.lexer.lineno, this.lexer.lex_pos);
      }
      ({ shift, reduce } = this.lrtable?.actions[this.stateStack[this.stateStack.length - 1]][terminal?.type] ?? {});
      if (shift !== undefined && reduce !== undefined) {
        throw Error(`reduce: ${reduce} / shift: ${shift} conflict`);
      } else {
        if (shift !== undefined) {
          this.stateStack.push(shift);
          terminal && this.symbolStack.push(terminal);
          this.log.push({
            stateStack: this.stateStack.join(" "),
            symbolStack: this.symbolStack
              .map((symbol) => {
                return symbol.type || symbol.toString();
              })
              .join(" "),
            action: `shift ${shift}`,
          });
        } else if (reduce !== undefined) {
          const len = this.productions[reduce].handle.length;
          this.stateStack.splice(this.stateStack.length - len, len);
          let slice = this.symbolStack.splice(this.symbolStack.length - len, len);
          let p = this.productionProxy(slice);
          if (typeof this.productions[reduce].func === "function") {
            this.productions[reduce].func?.(p);
            const symbolAfterReduce = p[0];
            this.symbolStack.push(symbolAfterReduce);
          } else {
            p[0] = { type: this.productions[reduce].symbol, children: slice };
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
                return symbol.type || symbol.toString();
              })
              .join(" "),
            action: `reduce ${this.productions[reduce].toString()}`,
          });
        }
      }
      if (terminal?.type === END && this.symbolStack.length === 1) {
        return this.symbolStack[0];
      }
    }
  }

  productionProxy(inputs: any[]): any {
    let proxy = {
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
          throw RangeError(`Number is the only valid property name`);
        }
      },
    });
  }

  processGrammar(grammar: grammar) {
    if (!grammar.tokens) this.terminals = [];
    else if (typeof grammar.tokens === "string") {
      this.terminals = grammar.tokens.split(/\s+/).filter((token) => token);
    } else if (Array.isArray(grammar.tokens)) {
      this.terminals = grammar.tokens;
    } else {
      throw TypeError("tokens of grammar must be a string or array");
    }
    this.symbols.push(...this.terminals);
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
    if (!operators) operators = [];
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
        if (this.operators[sym])
          this.productions[this.productions.length - 1].precedence = Math.max(
            this.productions[this.productions.length - 1].precedence,
            this.operators[sym].precedence,
          );
      });
    };
    const getCustomPrecedence = (handle: string): [string, number] => {
      let handleWithoutPrec = handle.split("%prec");
      if (handleWithoutPrec.length > 2) {
        throw SyntaxError(`'${handle}' is invalid`);
      }
      if (handleWithoutPrec.length === 2) {
        let precedenceLevel = handleWithoutPrec[1].trim();
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
    for (let symbol of getKeys(bnf)) {
      if (this.terminals.includes(symbol as string)) {
        throw Error(`'${symbol.toString()}' can't be defined as a nonterminal as it is a terminal`);
      }
      const lenOfProductionsBefore = this.productions.length;
      this.nonterminals[symbol] = new NonTerminal(symbol);
      if (!Array.isArray(bnf[symbol])) {
        bnf[symbol] = [bnf[symbol] as bnfItem];
      }
      for (let prod of bnf[symbol] as bnfItem[]) {
        if (!Array.isArray(prod.handle)) {
          prod.handle = [prod.handle as string];
        }
        prod.handle.forEach((item) => {
          let [handleWithoutPrec, prec] = getCustomPrecedence(item);
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
export { Production, Parser };
