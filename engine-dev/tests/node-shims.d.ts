declare module "node:test" {
  type TestFunction = () => void | Promise<void>;
  export default function test(name: string, functionUnderTest: TestFunction): void;
}

declare module "node:assert/strict" {
  interface AssertionApi {
    equal(actual: unknown, expected: unknown, message?: string): void;
    notEqual(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
    ok(value: unknown, message?: string): asserts value;
    match(value: string, expression: RegExp, message?: string): void;
    throws(functionUnderTest: () => unknown, expected?: unknown): void;
    rejects(functionUnderTest: Promise<unknown> | (() => Promise<unknown>), expected?: unknown): Promise<void>;
  }
  const assert: AssertionApi;
  export default assert;
}
