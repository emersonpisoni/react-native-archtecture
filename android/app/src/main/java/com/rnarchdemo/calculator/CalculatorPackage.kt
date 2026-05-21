package com.rnarchdemo.calculator

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * BaseReactPackage é o substituto moderno de ReactPackage para a Nova
 * Arquitetura: expõe TurboModules de forma lazy (só instancia quando o JS
 * pede pela primeira vez).
 */
class CalculatorPackage : BaseReactPackage() {

  override fun getModule(
      name: String,
      reactContext: ReactApplicationContext,
  ): NativeModule? =
      if (name == CalculatorModule.NAME) CalculatorModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
      ReactModuleInfoProvider {
        mapOf(
            CalculatorModule.NAME to
                ReactModuleInfo(
                    CalculatorModule.NAME,
                    CalculatorModule::class.java.name,
                    /* canOverrideExistingModule = */ false,
                    /* needsEagerInit = */ false,
                    /* isCxxModule = */ false,
                    /* isTurboModule = */ true,
                ),
        )
      }
}
