# Changelog

## [1.7.0](https://github.com/AvdienkoSergey/modelpact/compare/v1.6.0...v1.7.0) (2026-09-03)


### Features

* **demo:** a chat that uses every promise the contract makes ([b258f44](https://github.com/AvdienkoSergey/modelpact/commit/b258f443df1600547929d4774778bd4680a43a67))
* **demo:** the kind aliases where a UI actually wants them ([74fc797](https://github.com/AvdienkoSergey/modelpact/commit/74fc79737eef3511d9bc292352f80d3b71895191))
* **types:** name the three tag sets, without making them enums ([a67cb51](https://github.com/AvdienkoSergey/modelpact/commit/a67cb51c73f4e3c71608482b256be08e1406cbc2))


### Documentation

* **demo:** two screenshots of the chat ([fefdde3](https://github.com/AvdienkoSergey/modelpact/commit/fefdde34fc1ba985c5a6bf12090a5b31af44e8c7))
* **lifecycle:** the record is carried across a reload, not surviving one ([b7c89ae](https://github.com/AvdienkoSergey/modelpact/commit/b7c89ae45e5f8e0260e2487eca18c3c45ac10685))

## [1.6.0](https://github.com/AvdienkoSergey/modelpact/compare/v1.5.0...v1.6.0) (2026-09-03)


### Features

* **lifecycle:** a record of the conversation that survives a reload ([325e95a](https://github.com/AvdienkoSergey/modelpact/commit/325e95a3fd08e7db0f8748ee8f0365262316a763))
* **lifecycle:** a record of the conversation that survives a reload ([dd12e09](https://github.com/AvdienkoSergey/modelpact/commit/dd12e0903d171b66e7f0bf0781a884b22e5b0442))

## [1.5.0](https://github.com/AvdienkoSergey/modelpact/compare/v1.4.0...v1.5.0) (2026-09-03)


### Features

* **providers:** a way in from outside ([44c5e45](https://github.com/AvdienkoSergey/modelpact/commit/44c5e459430ef4a28328906dfb714e5dbaf4fc5c))
* **providers:** a way in from outside ([68f1ed2](https://github.com/AvdienkoSergey/modelpact/commit/68f1ed2de3318d50ee13a35f79ffa2988e7a0cf4))

## [1.4.0](https://github.com/AvdienkoSergey/modelpact/compare/v1.3.0...v1.4.0) (2026-09-03)


### Features

* **providers:** a mock with nothing behind it ([fcb3ec3](https://github.com/AvdienkoSergey/modelpact/commit/fcb3ec341df97703117f57401a5e904f27e00998))


### Refactoring

* **lifecycle:** five stages every provider runs on ([bee58a6](https://github.com/AvdienkoSergey/modelpact/commit/bee58a63d5f6d8855df034218bba52a74e0d5ad9))

## [1.3.0](https://github.com/AvdienkoSergey/modelpact/compare/v1.2.2...v1.3.0) (2026-09-02)


### Features

* **testing:** a contract suite shared by every provider ([0f0324a](https://github.com/AvdienkoSergey/modelpact/commit/0f0324a4e6e3e693fe0d94978c2da9f035dbcac4))
* **testing:** a contract suite shared by every provider ([c5d0ff9](https://github.com/AvdienkoSergey/modelpact/commit/c5d0ff9da1dd66b65ed3579fa452c10bdb713510))


### Refactoring

* **testing:** drop non-null assertions from the suite ([b13617b](https://github.com/AvdienkoSergey/modelpact/commit/b13617bf342e5b5c8d0d39130845399268528f73))

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
