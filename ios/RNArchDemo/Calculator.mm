// Calculator.mm
//
// Implementação iOS do TurboModule Calculator.
//
// O arquivo é .mm (Objective-C++) porque a infraestrutura de TurboModule
// usa C++ internamente. RCT_EXPORT_MODULE registra o módulo com o
// TurboModuleRegistry sob o nome "Calculator" — o mesmo da spec TS.

#import "Calculator.h"

@implementation Calculator

RCT_EXPORT_MODULE()

- (NSNumber *)add:(double)a b:(double)b
{
  return @(a + b);
}

- (void)multiplyAsync:(double)a
                    b:(double)b
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    @try {
      double result = a * b;
      resolve(@(result));
    } @catch (NSException *e) {
      reject(@"CALC_ERROR", e.reason, nil);
    }
  });
}

- (facebook::react::ModuleConstants<JS::NativeCalculator::Constants>)constantsToExport
{
  return [self getConstants];
}

- (facebook::react::ModuleConstants<JS::NativeCalculator::Constants>)getConstants
{
  return facebook::react::typedConstants<JS::NativeCalculator::Constants>({
      .PI = M_PI,
      .E = M_E,
  });
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeCalculatorSpecJSI>(params);
}

@end
