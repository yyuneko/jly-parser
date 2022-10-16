# Usage

```typescript
type grammar = {
    startSymbol: string;
    tokens: (string[]) | string;
    operators: {
        0: "left" | "right",
        [index: number]: string
    }[];// e.g. [["left","A","B","C"],["right","D"]]
    bnf: {
        [nonterminal: string]: {
            handle: (string[]) | string;
            func?: (symbols: any) => void;
        }[]
    }
}
```
example:

See [example](./test)
