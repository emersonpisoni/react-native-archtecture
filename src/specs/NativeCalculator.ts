/**
 * TurboModule spec for "Calculator".
 *
 * This spec is the source of truth: codegen reads this file during the build
 * and generates the native contracts (Java/Kotlin interface on Android,
 * Objective-C protocol on iOS) that the native module must implement.
 *
 * - Convention: the file must start with "Native" and be referenced in
 *   codegenConfig.jsSrcsDir in package.json.
 * - Supported types: number, string, boolean, Object, Array, Promise<T>,
 *   void, and serializable tuples/objects. See the RN codegen docs.
 */

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  // Synchronous: thanks to JSI, we can return a value without a Promise.
  add(a: number, b: number): number;

  // Asynchronous: useful when the actual work is heavy and needs to run
  // off the JS thread.
  multiplyAsync(a: number, b: number): Promise<number>;

  // Constants exposed by the module (e.g. PI computed natively).
  getConstants(): { PI: number; E: number };
}

export default TurboModuleRegistry.getEnforcing<Spec>('Calculator');
