# Changelog

## [1.2.2](https://github.com/AvdienkoSergey/modelpact/compare/v1.2.1...v1.2.2) (2026-09-02)


### CI

* one run per change, none on release pull requests ([14b3266](https://github.com/AvdienkoSergey/modelpact/commit/14b32661162ad74be38365aa1a93e8125019640f))
* one run per change, none on release pull requests ([20a4e6f](https://github.com/AvdienkoSergey/modelpact/commit/20a4e6f8d3495aa405d821532e940fc6dbc4813b))

## [1.2.1](https://github.com/AvdienkoSergey/modelpact/compare/v1.2.0...v1.2.1) (2026-09-02)


### Documentation

* drop stale counts from helper comments ([2a0327c](https://github.com/AvdienkoSergey/modelpact/commit/2a0327c4d170e387f118d2ce25522af23097f2a8))


### Build System

* allow numbers in template literals ([5d85dfc](https://github.com/AvdienkoSergey/modelpact/commit/5d85dfc2d5eb1f51996a774c001a93619a74b818))

## [1.2.0](https://github.com/AvdienkoSergey/modelpact/compare/v1.1.1...v1.2.0) (2026-09-02)


### Features

* shared helpers for provider behaviour ([4d2f8a0](https://github.com/AvdienkoSergey/modelpact/commit/4d2f8a0a06d5bd364d039bb80899e06ef586639e))


### Bug Fixes

* drop the .types suffix from files that carry values ([f31918c](https://github.com/AvdienkoSergey/modelpact/commit/f31918cbf1714a03ccd349c2577ff6c25ca02c76))


### Documentation

* rewrite README as a pitch, with helper diagrams ([32baee3](https://github.com/AvdienkoSergey/modelpact/commit/32baee39398dd001beac3f6ae0a9601b1dd6aac6))

## [1.1.1](https://github.com/AvdienkoSergey/modelpact/compare/v1.1.0...v1.1.1) (2026-09-02)


### Bug Fixes

* jsonSchema пропускал Date, Map и RegExp ([7c81e44](https://github.com/AvdienkoSergey/modelpact/commit/7c81e44505634a6fc00125c467118c2fb6ea544b))


### CI

* проверки typecheck, lint и format на PR и на main ([b1ddad3](https://github.com/AvdienkoSergey/modelpact/commit/b1ddad3dae0185d8d181d33b2d068710157db545))
* прогонять vitest и playwright ([bfa644f](https://github.com/AvdienkoSergey/modelpact/commit/bfa644fe7519837952ba282efe13713cccf50fc5))

## [1.1.0](https://github.com/AvdienkoSergey/modelpact/compare/v1.0.0...v1.1.0) (2026-09-02)


### Features

* контракт провайдера языковой модели ([79bb1bc](https://github.com/AvdienkoSergey/modelpact/commit/79bb1bc53d14d15679c3c101e915ac0eec8389c3))


### Build System

* prettier, eslint и откат typescript до 6.0.3 ([eea8582](https://github.com/AvdienkoSergey/modelpact/commit/eea8582aabaf7462572a9309503eb9d3d8dfccf3))

## 1.0.0 (2026-09-02)


### Features

* add @types/dom-chromium-ai ([0af3fbe](https://github.com/AvdienkoSergey/modelpact/commit/0af3fbef976589982107037a5cf11ae00b51e858))


### Bug Fixes

* forbid omitResponseConstraintInput without responseConstraint ([d5ef3ca](https://github.com/AvdienkoSergey/modelpact/commit/d5ef3ca16f37cf9b5bb0b8e22926bc6cceb81292))
* tighten dom-chromium-ai types via patch-package ([875532f](https://github.com/AvdienkoSergey/modelpact/commit/875532f7803bab3ffc0ade9101db2188711b1b12))


### Documentation

* add Prompt API specification ([264ccbe](https://github.com/AvdienkoSergey/modelpact/commit/264ccbe5039026d05de9f9403e246b857fad477a))


### Build System

* tsconfig, vitest и строгий набор флагов ([0412adf](https://github.com/AvdienkoSergey/modelpact/commit/0412adf75ebc6b5dedb24268a300836e728a35e7))
