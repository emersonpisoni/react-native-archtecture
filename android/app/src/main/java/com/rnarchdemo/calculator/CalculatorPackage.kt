package com.rnarchdemo.calculator

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * BaseReactPackage is the modern replacement for ReactPackage in the New
 * Architecture: it exposes TurboModules lazily (only instantiated the first
 * time JS requests them).
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
