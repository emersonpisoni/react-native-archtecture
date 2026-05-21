package com.rnarchdemo.calculator

import com.facebook.fbreact.specs.NativeCalculatorSpec
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule

/**
 * Implementação Android do TurboModule Calculator.
 *
 * NativeCalculatorSpec é GERADO pelo codegen a partir de
 * src/specs/NativeCalculator.ts no momento do build. Não tente importar
 * antes de rodar `./gradlew generateCodegenArtifactsFromSchema` ou
 * simplesmente buildar o app.
 */
@ReactModule(name = CalculatorModule.NAME)
class CalculatorModule(reactContext: ReactApplicationContext) :
    NativeCalculatorSpec(reactContext) {

  override fun getName(): String = NAME

  override fun add(a: Double, b: Double): Double = a + b

  override fun multiplyAsync(a: Double, b: Double, promise: Promise) {
    // Em produção, despache para um Executor/coroutine se for pesado.
    Thread {
      try {
        val result = a * b
        promise.resolve(result)
      } catch (e: Exception) {
        promise.reject("CALC_ERROR", e)
      }
    }.start()
  }

  override fun getTypedExportedConstants(): Map<String, Any> =
      mapOf(
          "PI" to Math.PI,
          "E" to Math.E,
      )

  companion object {
    const val NAME = "Calculator"
  }
}
