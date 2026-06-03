/** Minimal string union-find, shared by the resolver and the flattener. */
export class UnionFind {
  private parent = new Map<string, string>();

  add(x: string) { if (!this.parent.has(x)) this.parent.set(x, x); }
  has(x: string) { return this.parent.has(x); }
  keys(): string[] { return [...this.parent.keys()]; }

  find(x: string): string {
    this.add(x);
    let r = x;
    while (this.parent.get(r) !== r) r = this.parent.get(r)!;
    let c = x; // path compression
    while (this.parent.get(c) !== r) { const n = this.parent.get(c)!; this.parent.set(c, r); c = n; }
    return r;
  }

  union(a: string, b: string) { this.parent.set(this.find(a), this.find(b)); }
}
