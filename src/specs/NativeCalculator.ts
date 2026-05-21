/**
 * Spec do TurboModule "Calculator".
 *
 * Esta spec é a fonte da verdade: o codegen lê este arquivo durante o build
 * e gera os contratos nativos (interface Java/Kotlin no Android, protocol
 * Objective-C no iOS) que o módulo nativo precisa implementar.
 *
 * - Convenção: arquivo deve começar com "Native" e estar referenciado em
 *   codegenConfig.jsSrcsDir no package.json.
 * - Tipos suportados: number, string, boolean, Object, Array, Promise<T>,
 *   void, e tuplas/objetos serializáveis. Veja a doc de codegen no RN.
 */

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  // Síncrono: graças ao JSI, podemos retornar valor sem Promise.
  add(a: number, b: number): number;

  // Assíncrono: útil quando o trabalho real é pesado e precisa rodar fora
  // da JS thread.
  multiplyAsync(a: number, b: number): Promise<number>;

  // Constantes expostas pelo módulo (ex: PI calculado em nativo).
  getConstants(): { PI: number; E: number };
}

export default TurboModuleRegistry.getEnforcing<Spec>('Calculator');
