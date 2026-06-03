import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveSchematicNets, type SchConnection } from "../src/schematic-nets.js";

const pin = (sym: string, p: string) => ({ kind: "pin" as const, sym, pin: p });
const free = (key: string) => ({ kind: "free" as const, key });
const broken = (key: string) => ({ kind: "broken" as const, key });

test("two pins on one wire form a single connected net", () => {
  const conns: SchConnection[] = [{ id: "w1", a: pin("R1", "1"), b: pin("U1", "3") }];
  const { nets, netOfConn, connectedPins } = deriveSchematicNets(conns);
  assert.equal(nets.length, 1);
  assert.deepEqual(nets[0].pins.sort(), ["R1.1", "U1.3"]);
  assert.equal(nets[0].hasFree, false);
  assert.equal(nets[0].shorts.length, 0);
  assert.equal(netOfConn.get("w1"), 0);
  assert.ok(connectedPins.has("R1.1") && connectedPins.has("U1.3"));
});

test("a chain of wires merges into one net", () => {
  const conns: SchConnection[] = [
    { id: "w1", a: pin("A", "1"), b: pin("B", "1") },
    { id: "w2", a: pin("B", "1"), b: pin("C", "1") },
  ];
  const { nets } = deriveSchematicNets(conns);
  assert.equal(nets.length, 1);
  assert.deepEqual(nets[0].pins.sort(), ["A.1", "B.1", "C.1"]);
});

test("a two-pin part wired across itself is flagged as a short", () => {
  const conns: SchConnection[] = [{ id: "w1", a: pin("R1", "1"), b: pin("R1", "2") }];
  const { nets } = deriveSchematicNets(conns, ["R1"]);
  assert.deepEqual(nets[0].shorts, ["R1"]);
});

test("the same two pins are not a short when the part is not two-pin", () => {
  const conns: SchConnection[] = [{ id: "w1", a: pin("U1", "1"), b: pin("U1", "2") }];
  const { nets } = deriveSchematicNets(conns, []); // U1 not declared two-pin
  assert.equal(nets[0].shorts.length, 0);
});

test("a floating end marks its net as floating", () => {
  const conns: SchConnection[] = [{ id: "w1", a: pin("R1", "1"), b: free("120,80") }];
  const { nets, netOfConn } = deriveSchematicNets(conns);
  assert.equal(nets[netOfConn.get("w1")!].hasFree, true);
});

test("broken stubs never merge with each other", () => {
  const conns: SchConnection[] = [
    { id: "w1", a: pin("A", "1"), b: broken("w1:b") },
    { id: "w2", a: pin("B", "1"), b: broken("w2:b") },
  ];
  const { nets } = deriveSchematicNets(conns);
  assert.equal(nets.length, 2);
  assert.ok(nets.every((n) => n.hasBroken));
});

test("two wires meeting at a shared pin collapse to one net (junction)", () => {
  const conns: SchConnection[] = [
    { id: "w1", a: pin("U1", "1"), b: pin("J", "1") },
    { id: "w2", a: pin("J", "1"), b: pin("U2", "1") },
  ];
  const { nets } = deriveSchematicNets(conns);
  assert.equal(nets.length, 1);
  assert.equal(nets[0].connIds.length, 2);
});
