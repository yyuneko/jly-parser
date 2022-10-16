function getKeys(obj) {
    // eslint-disable-next-line no-prototype-builtins
    return Reflect.ownKeys(obj).filter(key => obj.propertyIsEnumerable(key));
}
class _Set {
    constructor() {
        this.items = [];
    }

    _add(...items) {
        for (const item of items) {
            if (this.indexOf(item) === -1) { this.items.push(item); }
        }
    }

    eq(otherSet) {
        return this.items.length === otherSet.items.length && this.subset(otherSet);
    }

    indexOf(item) {
        for (let i = 0; i < this.items.length; ++i) {
            if (item.eq?.(this.items[i])) { return i; }
        }
        return -1;
    }

    subset(otherSet) {
        for (const item of this.items) {
            if (otherSet.indexOf(item) === -1) { return false; }
        }
        return true;
    }

    join(separator) {
        return this.items.join(separator);
    }

    get size() {
        return this.items.length;
    }
}

export {
    getKeys, _Set
};