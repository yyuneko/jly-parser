import { _Set, getKeys } from "./util";
const EPSILON = Symbol("epsilon");
const END = Symbol("end");

class Token {
  type: any;
  value: any;
  lineno: number;
  lexPos: number;
  constructor(type: any, value: any, lineno: number, lexPos: number) {
    this.type = type;
    this.value = value;
    this.lineno = lineno;
    this.lexPos = lexPos;
  }
}
class NonTerminal {
  nullable: boolean;
  symbol: symbol | string;
  productions: Production[];
  first: (symbol | string)[];
  follows: (symbol | string)[];
  constructor(symbol: symbol | string) {
    this.symbol = symbol;
    this.productions = [];
    this.first = [];
    this.follows = [];
    this.nullable = false;
  }

  toString() {
    return `${this.symbol.toString()}
        ${this.nullable ? "nullable" : "not nullable"}
        Firsts: ${this.first.join(", ")}
        Follows: ${this.follows.join(", ")}
        Productions:
         ${this.productions.join("\n ")}`;
  }
}

class Production {
  id: number;
  handle: string[];
  nullable: boolean;
  precedence: number;
  symbol: symbol | string;
  func?: (symbols: any) => void;
  constructor(
    id: number,
    symbol: symbol | string,
    handle: string | string[],
    func?: (symbols: any) => void,
    precedence?: number,
  ) {
    this.id = id;
    this.func = func;
    this.symbol = symbol;
    this.nullable = false;
    this.precedence = precedence ?? 0;
    if (typeof handle === "string") {
      this.handle = handle.split(/\s+/).filter((item) => item);
    } else {
      this.handle = handle.map((item) => {
        if (item.trim().includes(" ")) {
          throw TypeError(`${item} should not contain space`);
        }
        return item.trim();
      });
    }
  }

  eq(production: Production) {
    return this.toString() === production.toString();
  }

  toString() {
    return this.symbol.toString() + " -> " + this.handle.join(" ");
  }
}

/**
 * @brief LR 分析表中的项目
 */
class Item {
  id: number;
  dotPosition: number;
  //   predecessor: number;
  production: Production;
  //   follows: (symbol | string)[];
  constructor(production: Production, dotPosition: number /*, follows: (symbol | string)[], predecessor: number*/) {
    // this.follows = follows;
    this.production = production;
    this.dotPosition = dotPosition;
    // this.predecessor = predecessor;
    this.id = parseInt(production.id + "a" + this.dotPosition, 36);
  }

  eq(item: Item) {
    return this.id === item.id;
  }

  lookAhead() {
    return new Item(this.production, this.dotPosition + 1 /*, this.follows, this.predecessor*/);
  }

  toString() {
    return `${this.production.symbol.toString()} -> ${this.production.handle
      .slice(0, this.dotPosition)
      .join(" ")} · ${this.production.handle.slice(this.dotPosition).join(" ")}`;
  }
}

/**
 * @brief LR 分析表中的项集闭包
 */
class ItemSet extends _Set {
  hash: { [index: number]: boolean };
  constructor() {
    super();
    this.hash = {};
  }

  add(...items: Item[]) {
    for (let item of items) {
      this.hash[item.id] = true;
    }
    super._add(...items);
  }

  has(item: Item) {
    return this.hash[item.id];
  }

  valueOf() {
    return this.items
      .map((item) => item.id)
      .sort()
      .join("|");
  }

  copy() {
    let ret = new ItemSet();
    ret.add(...(this.items as Item[]));
    ret.hash = Object.create(this.hash);
    return ret;
  }

  toString() {
    return `\t${this.items.map((item) => item.toString()).join("\n\t")}`;
  }
}

class LRTable {
  actions: { [symbol: symbol | string]: { accept?: true; shift?: number; reduce?: number; goto?: number } }[];
  stateNumbersMap: { [state: string]: number };
  states: ItemSet[];
  constructor() {
    this.actions = [];
    this.stateNumbersMap = {};
    this.states = [];
  }

  accept(state: number) {
    this.actions[state][END] = { accept: true };
  }

  shift(fromState: number, toState: number, terminal: symbol | string) {
    if (typeof fromState === "string") fromState = this.stateNumbersMap[fromState];
    if (typeof toState === "string") toState = this.stateNumbersMap[toState];
    if (this.actions[fromState][terminal]) {
      this.actions[fromState][terminal].shift = toState;
    } else {
      this.actions[fromState][terminal] = { shift: toState };
    }
  }

  reduce(fromState: number, terminal: symbol | string, productionId: number) {
    if (typeof fromState === "string") fromState = this.stateNumbersMap[fromState];
    if (this.actions[fromState][terminal]) {
      this.actions[fromState][terminal].reduce = productionId;
    } else {
      this.actions[fromState][terminal] = { reduce: productionId };
    }
  }

  goto(fromState: number, toState: number, nonterminal: symbol | string) {
    if (typeof fromState === "string") fromState = this.stateNumbersMap[fromState];
    if (typeof toState === "string") toState = this.stateNumbersMap[toState];
    this.actions[fromState][nonterminal] = { goto: toState };
  }

  get size() {
    return getKeys(this.stateNumbersMap).length;
  }

  addItemSet(itemSet: ItemSet) {
    const id = itemSet.valueOf();
    if (!id) return false;
    if (this.stateNumbersMap[id]) return this.stateNumbersMap[id];
    this.stateNumbersMap[id] = this.size;
    this.states[this.stateNumbersMap[id]] = itemSet;
    this.actions[this.stateNumbersMap[id]] = {};
    return this.stateNumbersMap[id];
  }

  toString() {
    return `${this.states
      .map((state, index) => {
        return "state " + index + "\n" + state.toString();
      })
      .join("\n\n")}`;
  }
}

export { Token, EPSILON, END, NonTerminal, Production, Item, ItemSet, LRTable };
