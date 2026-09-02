[![Logo](https://webmachinelearning.github.io/webmachinelearning-logo.png)](https://webmachinelearning.github.io/)

# API промптов

[Черновик отчета сообщества](https://www.w3.org/standards/types/#CG-DRAFT), 11 августа 2026 года

Более подробная информация о данном документе

Текущая версия:

[https://webmachinelearning.github.io/prompt-api](https://webmachinelearning.github.io/prompt-api)

Отслеживание проблем:

[GitHub](https://github.com/webmachinelearning/prompt-api/issues/)

Редактор:

[Reilly Grant](mailto:reillyg@google.com) ([Google](https://www.google.com))

Бывший редактор:

[Domenic Denicola](https://domenic.me/) ([Google](https://www.google.com/)) [d@domenic.me](mailto:d@domenic.me)

[Copyright](https://www.w3.org/policies/#copyright) © 2026 участники спецификации Prompt API, опубликованной [Web Machine Learning Community Group](https://www.w3.org/community/webmachinelearning/) под [W3C Community Contributor License Agreement (CLA)](https://www.w3.org/community/about/agreements/cla/). Доступна человекочитаемая [сводка](http://www.w3.org/community/about/agreements/cla-deed/).

* * *

## Аннотация

API для подсказок предоставляет веб-страницам возможность напрямую запрашивать язык модели

## Статус этого документа

Эта спецификация была опубликована [Web Machine Learning Community Group](https://www.w3.org/community/webmachinelearning/). Это не является стандартом W3C и не находится на пути к стандартам W3C. Обратите внимание, что в рамках [W3C Community Contributor License Agreement (CLA)](https://www.w3.org/community/about/agreements/cla/) существует ограниченная возможность отказаться и применяются другие условия. Узнайте больше о [W3C Community and Business Groups](http://www.w3.org/community/).

## Введение[](#intro)

API подсказок предоставляет веб-страницам возможность напрямую запрашивать язык, предоставленный браузером. Он предоставляет единый JavaScript API, который абстрагирует конкретные детали модели (например, шаблонизацию или токенизацию). Используя встроенные языковые модели, он обеспечивает преимущества, такие как локальная обработка чувствительных данных, использование в оффлайн-режиме, совместное использование моделей и снижение затрат по сравнению с подходами на основе облачных сервисов или собственных моделей.

## Зависимости[](#dependencies)

Это спецификация зависит от стандартов Инфраструктуры. [\[INFRA\]](#biblio-infra "Infra Standard")

Как и во всем остальном веб-платформе, человеческие языки в этих API идентифицируются с помощью тегов языка BCP 47, таких как "`ja`", "`en-US`", "`sr-Cyrl`" или "`de-CH-1901-x-phonebk-extended`". Конкретные алгоритмы, используемые для проверки, приведения к канонической форме и сопоставления тегов языка, те же, что и в спецификации ECMAScript Internationalization API, которая в свою очередь делегирует часть своей обработки языку разметки данных локали Unicode (LDML). [\[BCP47\]](#biblio-bcp47 "Tags for Identifying Languages") [\[ECMA-402\]](#biblio-ecma-402 "ECMAScript Internationalization API Specification") [\[UTS35\]](#biblio-uts35 "Unicode Locale Data Markup Language (LDML)").

Эти API являются частью семейства API, которые в будущем будут работать с использованием моделей машинного обучения, и которые имеют общие идиомы поверхности API и шаблоны спецификаций. В настоящее время текст спецификации для этих общих частей находится в [Writing Assistance APIs § 5 Shared infrastructure](https://webmachinelearning.github.io/writing-assistance-apis/#supporting), а общие соображения по конфиденциальности и безопасности обсуждаются в [Writing Assistance APIs § 6 Privacy considerations](https://webmachinelearning.github.io/writing-assistance-apis/#privacy) и [Writing Assistance APIs § 7 Security considerations](https://webmachinelearning.github.io/writing-assistance-apis/#security). Реализация этих API требует реализации этой общей инфраструктуры и соблюдения указанных соображений по конфиденциальности и безопасности. Однако это не требует реализации или предоставления фактических API для помощи в написании текста. [\[WRITING-ASSISTANCE-APIS\]](#biblio-writing-assistance-apis "Writing Assistance APIs")

## 3\. API[](#api)

```webidl
[Exposed=Window, SecureContext]
interface LanguageModel : EventTarget {
  static Promise<LanguageModel> create(optional LanguageModelCreateOptions options = {});
  static Promise<Availability> availability(optional LanguageModelCreateCoreOptions options = {});
  // **EXPERIMENTAL**: Only available in extension and experimental contexts.
  static Promise<LanguageModelParams?> params();

  // These will throw "NotSupportedError" DOMExceptions if role = "system"
  Promise<DOMString> prompt(
    LanguageModelPrompt input,
    optional LanguageModelPromptOptions options = {}
  );
  ReadableStream promptStreaming(
    LanguageModelPrompt input,
    optional LanguageModelPromptOptions options = {}
  );
  Promise<undefined> append(
    LanguageModelPrompt input,
    optional LanguageModelAppendOptions options = {}
  );

  Promise<double> measureContextUsage(
    LanguageModelPrompt input,
    optional LanguageModelPromptOptions options = {}
  );
  readonly attribute double contextUsage;
  readonly attribute unrestricted double contextWindow;
  attribute EventHandler oncontextoverflow;

  // **DEPRECATED**: This method is only available in extension contexts.
  Promise<double> measureInputUsage(
    LanguageModelPrompt input,
    optional LanguageModelPromptOptions options = {}
  );
  // **DEPRECATED**: This attribute is only available in extension contexts.
  readonly attribute double inputUsage;
  // **DEPRECATED**: This attribute is only available in extension contexts.
  readonly attribute unrestricted double inputQuota;
  // **DEPRECATED**: This attribute is only available in extension contexts.
  attribute EventHandler onquotaoverflow;

  // **DEPRECATED**: This attribute is only available in extension contexts.
  readonly attribute unsigned long topK;
  // **DEPRECATED**: This attribute is only available in extension contexts.
  readonly attribute float temperature;

  // **EXPERIMENTAL**: Only available in experimental contexts.
  readonly attribute LanguageModelSamplingMode samplingMode;

  Promise<LanguageModel> clone(optional LanguageModelCloneOptions options = {});
};
LanguageModel includes DestroyableModel;

// **DEPRECATED**: Only available in extension contexts.
[Exposed=Window, SecureContext]
interface LanguageModelParams {
  readonly attribute unsigned long defaultTopK;
  readonly attribute unsigned long maxTopK;
  readonly attribute float defaultTemperature;
  readonly attribute float maxTemperature;
};

callback LanguageModelToolFunction = Promise<DOMString> (any... arguments);

// A description of a tool call that a language model can invoke.
dictionary LanguageModelTool {
  required DOMString name;
  required DOMString description;
  // JSON schema for the input parameters.
  required object inputSchema;
  // The function to be invoked by user agent on behalf of language model.
  required LanguageModelToolFunction execute;
};

dictionary LanguageModelCreateCoreOptions {
  // Note: these two have custom out-of-range handling behavior, not in the IDL layer.
  // They are unrestricted double so as to allow +Infinity without failing.
  // **DEPRECATED**: Only available in extension contexts.
  unrestricted double topK;
  // **DEPRECATED**: Only available in extension contexts.
  unrestricted double temperature;

  // **EXPERIMENTAL**: Only available in experimental contexts.
  LanguageModelSamplingMode samplingMode;

  // The expected types and languages for the session.
  sequence<LanguageModelExpected> expectedInputs;
  sequence<LanguageModelExpected> expectedOutputs;

  // Tools that the language model can use.
  // **EXPERIMENTAL**: Only available in experimental contexts.
  sequence<LanguageModelTool> tools;
};

dictionary LanguageModelCreateOptions : LanguageModelCreateCoreOptions {
  AbortSignal signal;
  CreateMonitorCallback monitor;

  sequence<LanguageModelMessage> initialPrompts;
};

dictionary LanguageModelPromptOptions {
  object responseConstraint;
  boolean omitResponseConstraintInput = false;
  AbortSignal signal;
};

dictionary LanguageModelAppendOptions {
  AbortSignal signal;
};

dictionary LanguageModelCloneOptions {
  AbortSignal signal;
};

dictionary LanguageModelExpected {
  required LanguageModelMessageType type;
  sequence<DOMString> languages;
};

// The argument to the prompt() method and others like it

typedef (
  sequence<LanguageModelMessage>
  // Shorthand for `[{ role: "user", content: [{ type: "text", value: providedValue }] }]`
  or DOMString
) LanguageModelPrompt;

dictionary LanguageModelMessage {
  required LanguageModelMessageRole role;

  // The DOMString branch is shorthand for `[{ type: "text", value: providedValue }]`
  required (DOMString or sequence<LanguageModelMessageContent>) content;

  boolean prefix = false;
};

dictionary LanguageModelMessageContent {
  required LanguageModelMessageType type;
  required LanguageModelMessageValue value;
};

enum LanguageModelSamplingMode { "most-predictable", "predictable", "slightly-predictable", "balanced", "slightly-creative", "creative", "most-creative" };

enum LanguageModelMessageRole { "system", "user", "assistant" };

enum LanguageModelMessageType { "text", "image", "audio", "tool-call", "tool-response" };

typedef (
  ImageBitmapSource
  or AudioBuffer
  or BufferSource
  or DOMString
) LanguageModelMessageValue;
```

### 3.1. Создание[](#language-model-creation)

Статический **`create(options)`** метод выполняет следующие шаги:

1.  Возвращает результат [создания объекта AI модель](https://webmachinelearning.github.io/writing-assistance-apis/#create-an-ai-model-object) с учетом параметров, "`[language-model](#permissiondef-language-model)`", [валидация и канонизация параметров модели языка](#validate-and-canonicalize-language-model-options), [вычисление доступности параметров модели языка](#compute-language-model-options-availability), [скачивание модели языка](#download-the-language-model), [инициализация модели языка](#initialize-the-language-model), [создание объекта модели языка](#create-a-language-model-object) и false.
    

Чтобы **валидировать и канонизировать параметры модели языка** с учетом `[LanguageModelCreateCoreOptions](#dictdef-languagemodelcreatecoreoptions)` параметров, выполните следующие шаги. Они изменяют параметры на месте для канонизации и удаления дубликатов языковых тегов, и выбрасывают исключение, если какие-либо из них недопустимы.

1.  Если options\["`[expectedInputs](#dom-languagemodelcreatecoreoptions-expectedinputs)`"\] [существует](https://infra.spec.whatwg.org/#map-exists), то [для каждого](https://infra.spec.whatwg.org/#list-iterate) expected из options\["`[expectedInputs](#dom-languagemodelcreatecoreoptions-expectedinputs)`"\]:
    
    1.  Если expected\["`[languages](#dom-languagemodelexpected-languages)`"\] [существует](https://infra.spec.whatwg.org/#map-exists), то [проверьте и приведите языковые теги к канонической форме](https://webmachinelearning.github.io/writing-assistance-apis/#validate-and-canonicalize-language-tags), используя expected и "`[languages](#dom-languagemodelexpected-languages)`".
        
2.  Если options\["`[expectedOutputs](#dom-languagemodelcreatecoreoptions-expectedoutputs)`"\] [существует](https://infra.spec.whatwg.org/#map-exists), то [для каждого](https://infra.spec.whatwg.org/#list-iterate) expected из options\["`[expectedOutputs](#dom-languagemodelcreatecoreoptions-expectedoutputs)`"\]:
    
    1.  Если ожидаемое\["`[languages](#dom-languagemodelexpected-languages)`"\] [существует](https://infra.spec.whatwg.org/#map-exists), то [проверьте и приведите языковые теги к канонической форме](https://webmachinelearning.github.io/writing-assistance-apis/#validate-and-canonicalize-language-tags), используя ожидаемое и "`[languages](#dom-languagemodelexpected-languages)`".
        
3.  Если options\["`[initialPrompts](#dom-languagemodelcreateoptions-initialprompts)`"\] [существует](https://infra.spec.whatwg.org/#map-exists), то:
    
    1.  Пусть expectedInputs будет options\["`[expectedInputs](#dom-languagemodelcreatecoreoptions-expectedinputs)`"\], если он [существует](https://infra.spec.whatwg.org/#map-exists); в противном случае — пустым [списком](https://infra.spec.whatwg.org/#list).
        
    2.  Пусть expectedInputTypes будет результатом [получения ожидаемых типов содержимого](#get-the-expected-content-types), переданных expectedInputs.
        
    3.  Выполните [валидацию и канонизацию промпта](#validate-and-canonicalize-a-prompt), задав параметры\["`[initialPrompts](#dom-languagemodelcreateoptions-initialprompts)`"\], expectedInputTypes и false.
        

Чтобы **скачать язык модели**, задав `[LanguageModelCreateCoreOptions](#dictdef-languagemodelcreatecoreoptions)` параметры:

1.  [Утверждение](https://infra.spec.whatwg.org/#assert): эти шаги выполняются [параллельно](https://html.spec.whatwg.org/multipage/infrastructure.html#in-parallel).
    
2.  Запустите процесс загрузки всего, что агенту пользователя нужно для формирования промпта языковой модели в соответствии с параметрами. Это может включать базовую AI модель, тонкую настройку для конкретных языков или значений параметров, или другие ресурсы.
    
3.  Если процесс загрузки не может быть запущен по какой-либо причине, верните false.
    
4.  Верните true.
    

Чтобы **инициализировать языковую модель**, задав `[LanguageModelCreateOptions](#dictdef-languagemodelcreateoptions)` параметры:

1.  [Assert](https://infra.spec.whatwg.org/#assert): эти шаги выполняются [параллельно](https://html.spec.whatwg.org/multipage/infrastructure.html#in-parallel).
    
2.  Пусть availability будет результатом [compute language model options availability](#compute-language-model-options-availability), полученного с использованием опций.
    
    1.  Если availability равно null или `[unavailable](https://webmachinelearning.github.io/writing-assistance-apis/#dom-availability-unavailable)`, то вернуть [информацию об ошибке DOMException](https://webmachinelearning.github.io/writing-assistance-apis/#domexception-error-information), у которой [имя](https://webmachinelearning.github.io/writing-assistance-apis/#domexception-error-information-name) равно "`[NotSupportedError](https://webidl.spec.whatwg.org/#notsupportederror)`" и которая содержит соответствующие сведения в [сведениях](https://webmachinelearning.github.io/writing-assistance-apis/#domexception-error-information-details).
        
3.  Выполните любые необходимые операции инициализации для AI-модели, лежащей в основе функций подсказок агента пользователя.
    
    Это может включать загрузку соответствующей модели и любые необходимые тонкие настройки для поддержки опций в память.
    
    1.  Если options\["`[initialPrompts](#dom-languagemodelcreateoptions-initialprompts)`"\] [существует](https://infra.spec.whatwg.org/#map-exists), то:
        
        1.  Пусть expectedInputs будет равно options\["`[expectedInputs](#dom-languagemodelcreatecoreoptions-expectedinputs)`"\], если оно [существует](https://infra.spec.whatwg.org/#map-exists); в противном случае — пустому [списку](https://infra.spec.whatwg.org/#list).
            
        2.  Пусть expectedInputTypes будет результатом [получения ожидаемых типов содержимого](#get-the-expected-content-types), заданных expectedInputs.
            
        3.  Пусть initialMessages будет результатом [валидации и канонизации подсказки](#validate-and-canonicalize-a-prompt), заданной options\["`[initialPrompts](#dom-languagemodelcreateoptions-initialprompts)`"\], expectedInputTypes и false.
            
        4.  Загрузите initialMessages в окно контекста модели.
            
    2.  Если options\["`[tools](#dom-languagemodelcreatecoreoptions-tools)`"\] [существует](https://infra.spec.whatwg.org/#map-exists), загрузите options\["`[tools](#dom-languagemodelcreatecoreoptions-tools)`"\] в окно контекста модели.
        
4.  Если инициализация завершилась неудачно из-за того, что процесс загрузки опций привел к использованию всего окна контекста модели, тогда:
    
    1.  Пусть requested — это объем окна контекста, необходимый для кодирования опций. Кодирование опций в качестве входных данных [определяется реализацией](https://infra.spec.whatwg.org/#implementation-defined).
        
    2.  Пусть maximum — это максимальный размер окна контекста, который поддерживает агент пользователя.
        
    3.  [Утверждение](https://infra.spec.whatwg.org/#assert): requested больше, чем maximum. (Таким образом мы попали в эту ветку ошибки.)
        
    4.  Вернуть информацию об ошибке превышения квоты [quota exceeded error information](https://webmachinelearning.github.io/writing-assistance-apis/#quota-exceeded-error-information), у которой [requested](https://webidl.spec.whatwg.org/#quotaexceedederror-requested) равно запрошенному, а [quota](https://webidl.spec.whatwg.org/#quotaexceedederror-quota) равно максимальной.
        
5.  Если инициализация завершилась неудачно по любой другой причине, вернуть информацию об ошибке [DOMException error information](https://webmachinelearning.github.io/writing-assistance-apis/#domexception-error-information), у которой [name](https://webmachinelearning.github.io/writing-assistance-apis/#domexception-error-information-name) равно "`[OperationError](https://webidl.spec.whatwg.org/#operationerror)`" и у которой [details](https://webmachinelearning.github.io/writing-assistance-apis/#domexception-error-information-details) содержат соответствующие детали.
    
6.  Вернуть null.
    

Чтобы **создать объект языковой модели**, учитывая [realm](https://tc39.es/ecma262/multipage/executable-code-and-execution-contexts.html#realm) realm и `[LanguageModelCreateOptions](#dictdef-languagemodelcreateoptions)` параметры:

1.  [Assert](https://infra.spec.whatwg.org/#assert): эти шаги выполняются на [event loop](https://html.spec.whatwg.org/multipage/webappapis.html#concept-agent-event-loop) [surrounding agent](https://tc39.es/ecma262/multipage/executable-code-and-execution-contexts.html#surrounding-agent) realm.
    
2.  Пусть contextWindowSize — это объём окна контекста, доступного агенту пользователя для этой модели. (Это значение [определено реализацией](https://infra.spec.whatwg.org/#implementation-defined), и может быть +∞, если нет конкретных ограничений, кроме, например, памяти пользователя или ограничений строк JavaScript.)
    
3.  Пусть initialMessages — это пустой [список](https://infra.spec.whatwg.org/#list) `[LanguageModelMessage](#dictdef-languagemodelmessage)`ов.
    
4.  Пусть initialMessagesUsage будет равно 0.
    
5.  Если options\["`[initialPrompts](#dom-languagemodelcreateoptions-initialprompts)`"\] [существует](https://infra.spec.whatwg.org/#map-exists), то:
    
    1.  Пусть expectedInputs будет равно options\["`[expectedInputs](#dom-languagemodelcreatecoreoptions-expectedinputs)`"\], если оно [существует](https://infra.spec.whatwg.org/#map-exists); в противном случае — пустому [списку](https://infra.spec.whatwg.org/#list).
        
    2.  Пусть expectedInputTypes будет результатом [получения ожидаемых типов содержимого](#get-the-expected-content-types), заданных expectedInputs.
        
    3.  Установите initialMessages как результат [валидации и канонизации призыва](#validate-and-canonicalize-a-prompt), заданный options\["`[initialPrompts](#dom-languagemodelcreateoptions-initialprompts)`"\], expectedInputTypes и false.
        
    4.  Установите initialMessagesUsage как результат [измерения использования контекста модели языка](#measure-language-model-context-usage), заданный initialMessages и options\["`[signal](#dom-languagemodelcreateoptions-signal)`"\].
        
6.  Возвращает новый объект `[LanguageModel](#languagemodel)`, созданный в realm, с
    
    [исходные сообщения](#languagemodel-initial-messages)
    
    initialMessages
    
    [top K](#languagemodel-top-k)
    
    options\["`[topK](#dom-languagemodelcreatecoreoptions-topk)`"\], если он [существует](https://infra.spec.whatwg.org/#map-exists); иначе значение, [определенное реализацией](https://infra.spec.whatwg.org/#implementation-defined)
    
    [температура](#languagemodel-temperature)
    
    options\["`[temperature](#dom-languagemodelcreatecoreoptions-temperature)`"\], если он [существует](https://infra.spec.whatwg.org/#map-exists); иначе значение, [определенное реализацией](https://infra.spec.whatwg.org/#implementation-defined)
    
    [ожидаемые входные данные](#languagemodel-expected-inputs)
    
    options\["`[expectedInputs](#dom-languagemodelcreatecoreoptions-expectedinputs)`"\], если он [существует](https://infra.spec.whatwg.org/#map-exists); иначе пустой [список](https://infra.spec.whatwg.org/#list)
    
    [ожидаемые выходные данные](#languagemodel-expected-outputs)
    
    options\["`[ожидаемые выводы](#dom-languagemodelcreatecoreoptions-expectedoutputs)`"\], если он [существует](https://infra.spec.whatwg.org/#map-exists); в противном случае пустой [список](https://infra.spec.whatwg.org/#list)
    
    [инструменты](#languagemodel-tools)
    
    options\["`[инструменты](#dom-languagemodelcreatecoreoptions-tools)`"\], если он [существует](https://infra.spec.whatwg.org/#map-exists); в противном случае пустой [список](https://infra.spec.whatwg.org/#list)
    
    [размер окна контекста](#languagemodel-context-window-size)
    
    contextWindowSize
    
    [текущее использование контекста](#languagemodel-current-context-usage)
    
    initialMessagesUsage
    

### 3.2. Доступность[](#language-model-availability)

Статический **`availability(options)`** метод шаги:

1.  Верните результат вычисления доступности модели ИИ, учитывая параметры, "`[language-model](#permissiondef-language-model)`", [валидацию и канонизацию параметров модели языка](#validate-and-canonicalize-language-model-options), и [вычисление доступности параметров модели языка](#compute-language-model-options-availability).
    

Чтобы **вычислить доступность параметров модели языка** на основе параметров `[LanguageModelCreateCoreOptions](#dictdef-languagemodelcreatecoreoptions)`, выполните следующие шаги. Они возвращают либо значение `[Availability](https://webmachinelearning.github.io/writing-assistance-apis/#enumdef-availability)`, либо null, а также изменяют параметры на месте, чтобы обновить языковые теги до их лучших совпадений.

1.  [Assert](https://infra.spec.whatwg.org/#assert): данный алгоритм выполняется [в параллельном режиме](https://html.spec.whatwg.org/multipage/infrastructure.html#in-parallel).
    
2.  Пусть availability будет [доступностью неопций языковой модели](#language-model-non-options-availability).
    
3.  Если availability равно null, то вернуть null.
    
4.  Пусть availabilities будет [списком](https://infra.spec.whatwg.org/#list), содержащим availability.
    
5.  Пусть inputPartition будет результатом [получения раздела доступности языковых моделей](https://webmachinelearning.github.io/writing-assistance-apis/#get-the-language-availabilities-partition), заданного с целью использования языковой модели для текста на этом языке.
    
6.  Пусть outputPartition будет результатом [получения раздела доступности языковых моделей](https://webmachinelearning.github.io/writing-assistance-apis/#get-the-language-availabilities-partition), заданного с целью генерации вывода языковой модели на этом языке.
    
7.  Если options\["`[expectedInputs](#dom-languagemodelcreatecoreoptions-expectedinputs)`"\] [существует](https://infra.spec.whatwg.org/#map-exists), то [для каждого](https://infra.spec.whatwg.org/#list-iterate) expected из options\["`[expectedInputs](#dom-languagemodelcreatecoreoptions-expectedinputs)`"\]:
    
    1.  Если expected\["`[languages](#dom-languagemodelexpected-languages)`"\] [существует](https://infra.spec.whatwg.org/#map-exists), то:
        
        1.  Пусть inputLanguageAvailability — это результат [вычисления доступности языка](https://webmachinelearning.github.io/writing-assistance-apis/#compute-language-availability), полученный с использованием expected\["`[languages](#dom-languagemodelexpected-languages)`"\] и inputPartition.
            
        2.  [Добавьте](https://infra.spec.whatwg.org/#list-append) inputLanguageAvailability в availabilities.
            
    2.  Пусть inputTypeAvailability — это [доступность типа содержимого языковой модели](#language-model-content-type-availability), полученная с использованием expected\["`[type](#dom-languagemodelexpected-type)`"\] и true.
        
    3.  [Добавить](https://infra.spec.whatwg.org/#list-append) inputTypeAvailability в availabilities.
        
8.  Если options\["`[expectedOutputs](#dom-languagemodelcreatecoreoptions-expectedoutputs)`"\] [существует](https://infra.spec.whatwg.org/#map-exists), то [для каждого](https://infra.spec.whatwg.org/#list-iterate) expected из options\["`[expectedOutputs](#dom-languagemodelcreatecoreoptions-expectedoutputs)`"\]:
    
    1.  Если expected\["`[languages](#dom-languagemodelexpected-languages)`"\] [существует](https://infra.spec.whatwg.org/#map-exists), то:
        
        1.  Пусть outputLanguageAvailability будет результатом [вычисления доступности языка](https://webmachinelearning.github.io/writing-assistance-apis/#compute-language-availability), полученного с использованием expected\["`[languages](#dom-languagemodelexpected-languages)`"\] и outputPartition.
            
        2.  [Добавить](https://infra.spec.whatwg.org/#list-append) outputLanguageAvailability в availabilities.
            
    2.  Пусть outputTypeAvailability будет [доступностью типа содержимого языковой модели](#language-model-content-type-availability), заданной ожидаемым\["`[type](#dom-languagemodelexpected-type)`"\] и false.
        
    3.  [Добавьте](https://infra.spec.whatwg.org/#list-append) outputTypeAvailability в availabilities.
        
9.  Верните [минимальную доступность](https://webmachinelearning.github.io/writing-assistance-apis/#availability-minimum-availability), заданную availabilities.
    

**Доступность неопций языковой модели** определяется следующими шагами. Они возвращают значение `[Availability](https://webmachinelearning.github.io/writing-assistance-apis/#enumdef-availability)` или null.

1.  [Утверждение](https://infra.spec.whatwg.org/#assert): этот алгоритм выполняется [параллельно](https://html.spec.whatwg.org/multipage/infrastructure.html#in-parallel).
    
2.  Если при попытке определить, может ли агент пользователя [поддерживать](https://webmachinelearning.github.io/writing-assistance-apis/#model-availability-currently-supports) подсказку языковой модели, возникает какая-либо ошибка, которую агент пользователя считает временной (такой что повторный запрос может перестать вызывать такую ошибку), то верните null.
    
3.  Если агент пользователя [в настоящее время поддерживает](https://webmachinelearning.github.io/writing-assistance-apis/#model-availability-currently-supports) подсказку языковой модели, то верните "`[available](https://webmachinelearning.github.io/writing-assistance-apis/#dom-availability-available)`".
    
4.  Если агент пользователя считает, что сможет [поддерживать](https://webmachinelearning.github.io/writing-assistance-apis/#model-availability-currently-supports) подсказку языковой модели, но только после завершения уже идущей загрузки, то верните "`[downloading](https://webmachinelearning.github.io/writing-assistance-apis/#dom-availability-downloading)`".
    
5.  Если агент пользователя считает, что сможет [поддерживать](https://webmachinelearning.github.io/writing-assistance-apis/#model-availability-currently-supports) подсказку языковой модели, но только после выполнения загрузки, которая в настоящее время не выполняется, то вернуть "`[downloadable](https://webmachinelearning.github.io/writing-assistance-apis/#dom-availability-downloadable)`".
    
6.  В противном случае вернуть "`[unavailable](https://webmachinelearning.github.io/writing-assistance-apis/#dom-availability-unavailable)`".
    

**Доступность типа содержимого языковой модели**, определяемая для типа `[LanguageModelMessageType](#enumdef-languagemodelmessagetype)` и булевого значения isInput, определяется следующими шагами. Они возвращают значение `[Availability](https://webmachinelearning.github.io/writing-assistance-apis/#enumdef-availability)`.

1.  [Утверждение](https://infra.spec.whatwg.org/#assert): этот алгоритм выполняется [параллельно](https://html.spec.whatwg.org/multipage/infrastructure.html#in-parallel).
    
2.  Если агент пользователя [в настоящее время поддерживает](https://webmachinelearning.github.io/writing-assistance-apis/#model-availability-currently-supports) тип в качестве входных данных, если isInput равно true, или в качестве выходных данных, если isInput равно false, то вернуть "`[available](https://webmachinelearning.github.io/writing-assistance-apis/#dom-availability-available)`".
    
3.  Если агент пользователя считает, что сможет [поддержать](https://webmachinelearning.github.io/writing-assistance-apis/#model-availability-currently-supports) тип таким образом, но только после завершения загрузки, которая уже идёт, то вернуть "`[downloading](https://webmachinelearning.github.io/writing-assistance-apis/#dom-availability-downloading)`"
    
4.  Если агент пользователя считает, что сможет [поддерживать](https://webmachinelearning.github.io/writing-assistance-apis/#model-availability-currently-supports) тип таким образом, но только после выполнения загрузки, которая в настоящее время не выполняется, то вернуть "`[downloadable](https://webmachinelearning.github.io/writing-assistance-apis/#dom-availability-downloadable)`".
    
5.  В противном случае вернуть "`[unavailable](https://webmachinelearning.github.io/writing-assistance-apis/#dom-availability-unavailable)`".
    

### 3.3. Класс `[LanguageModel](#languagemodel)`[](#the-languagemodel-class)

Каждый `[LanguageModel](#languagemodel)` имеет **исходные сообщения**, список `[LanguageModelMessage](#dictdef-languagemodelmessage)`s, устанавливаемый при создании.

Каждый `[LanguageModel](#languagemodel)` имеет **top K**, неотрицательное целое число, устанавливаемое при создании.

Каждый `[LanguageModel](#languagemodel)` имеет **температуру**, float, устанавливаемую при создании.

Каждый `[LanguageModel](#languagemodel)` имеет **ожидаемые входные данные**, список `[LanguageModelExpected](#dictdef-languagemodelexpected)`ов, заданный при создании.

Каждый `[LanguageModel](#languagemodel)` имеет **ожидаемые выходные данные**, список `[LanguageModelExpected](#dictdef-languagemodelexpected)`ов, заданный при создании.

Каждый `[LanguageModel](#languagemodel)` имеет **инструменты**, список `[LanguageModelTool](#dictdef-languagemodeltool)`ов, заданный при создании.

Каждый `[LanguageModel](#languagemodel)` имеет **размер окна контекста**, неограниченное число с плавающей точкой, заданное при создании.

Каждый `[LanguageModel](#languagemodel)` имеет **текущее использование контекста**, число с плавающей точкой, изначально равное 0.

* * *

Шаги для получения значения **`contextUsage`** — вернуть [это](https://webidl.spec.whatwg.org/#this)’s [текущее использование контекста](#languagemodel-current-context-usage).

Получатель **`inputUsage`** должен возвращать [это](https://webidl.spec.whatwg.org/#this)’s [текущее использование контекста](#languagemodel-current-context-usage).

Получатель **`contextWindow`** должен возвращать [это](https://webidl.spec.whatwg.org/#this)’s [размер окна контекста](#languagemodel-context-window-size).

Получатель **`inputQuota`** должен возвращать [это](https://webidl.spec.whatwg.org/#this)’s [размер окна контекста](#languagemodel-context-window-size).

Получатель **`topK`** должен возвращать [это](https://webidl.spec.whatwg.org/#this)’s [top K](#languagemodel-top-k).

Получатель **`temperature`** должен возвращать [это](https://webidl.spec.whatwg.org/#this)’s [температура](#languagemodel-temperature).

* * *

Ниже перечислены [обработчики событий](https://html.spec.whatwg.org/multipage/webappapis.html#event-handlers) (и соответствующие им [типы событий обработчиков событий](https://html.spec.whatwg.org/multipage/webappapis.html#event-handler-event-type)), которые должны поддерживаться всеми объектами `[LanguageModel](#languagemodel)` как [атрибуты IDL обработчика события](https://html.spec.whatwg.org/multipage/webappapis.html#event-handler-idl-attributes):

| [Обработчик события](https://html.spec.whatwg.org/multipage/webappapis.html#event-handlers) | [Тип события обработчика события](https://html.spec.whatwg.org/multipage/webappapis.html#event-handler-event-type) |
| --- | --- |
| **`oncontextoverflow`** | **`contextoverflow`** |
| **`onquotaoverflow`** | **`quotaoverflow`** |

* * *

Метод **`prompt(input, options)`** выполняет следующие шаги:

1.  Пусть responseConstraint будет options\["`[responseConstraint](#dom-languagemodelpromptoptions-responseconstraint)`"\], если он [существует](https://infra.spec.whatwg.org/#map-exists); в противном случае null.
    
2.  Пусть omitResponseConstraintInput будет опциями\["`[omitResponseConstraintInput](#dom-languagemodelpromptoptions-omitresponseconstraintinput)`"\].
    
3.  Пусть operation будет шагом алгоритма, который принимает аргументы chunkProduced, done, error и stopProducing, и выполняет следующие шаги:
    
    1.  Пусть prefillSuccess будет результатом [prefilling](#prefill), заданным [this](https://webidl.spec.whatwg.org/#this), input, omitResponseConstraintInput, responseConstraint, error и stopProducing.
        
    2.  Если prefillSuccess равно true, то [generate](#generate) заданный [this](https://webidl.spec.whatwg.org/#this), responseConstraint, chunkProduced, done, error и stopProducing.
        
4.  Вернуть результат [получения агрегированного результата AI-модели](https://webmachinelearning.github.io/writing-assistance-apis/#get-an-aggregated-ai-model-result), заданный [this](https://webidl.spec.whatwg.org/#this), options и operation.
    

Метод **`promptStreaming(input, options)`** выполняет следующие шаги:

1.  Пусть responseConstraint будет options\["`[responseConstraint](#dom-languagemodelpromptoptions-responseconstraint)`"\], если он [существует](https://infra.spec.whatwg.org/#map-exists); в противном случае null.
    
2.  Пусть omitResponseConstraintInput будет options\["`[omitResponseConstraintInput](#dom-languagemodelpromptoptions-omitresponseconstraintinput)`"\].
    
3.  Пусть operation будет алгоритмическим шагом, который принимает аргументы chunkProduced, done, error и stopProducing, и выполняет следующие шаги:
    
    1.  Пусть prefillSuccess будет результатом [prefilling](#prefill), заданным [this](https://webidl.spec.whatwg.org/#this), input, omitResponseConstraintInput, responseConstraint, error и stopProducing.
        
    2.  Если prefillSuccess равно true, то [generate](#generate), заданный [this](https://webidl.spec.whatwg.org/#this), responseConstraint, chunkProduced, done, error и stopProducing.
        
4.  Верните результат [получения результата потоковой AI модели](https://webmachinelearning.github.io/writing-assistance-apis/#get-a-streaming-ai-model-result), учитывая [это](https://webidl.spec.whatwg.org/#this), параметры и операцию.
    

Метод **`append(input, options)`** выполняет следующие шаги:

1.  Пусть operation будет алгоритмическим шагом, который принимает аргументы chunkProduced, done, error и stopProducing, и выполняет следующие шаги:
    
    chunkProduced никогда не вызывается, потому что алгоритм [prefilling](#prefill) не генерирует чанки.
    
    1.  Пусть prefillSuccess будет результатом [prefilling](#prefill), полученным при передаче [этого](https://webidl.spec.whatwg.org/#this), input, false, null, error и stopProducing.
        
    2.  Если prefillSuccess равно true и done не равно null, выполните done.
        
2.  Верните результат [получения агрегированного результата AI модели](https://webmachinelearning.github.io/writing-assistance-apis/#get-an-aggregated-ai-model-result), учитывая [это](https://webidl.spec.whatwg.org/#this), параметры и операцию.
    

Метод **`measureContextUsage(input, options)`** выполняет следующие шаги:

1.  Если options\["`[omitResponseConstraintInput](#dom-languagemodelpromptoptions-omitresponseconstraintinput)`"\] равно true и options\["`[responseConstraint](#dom-languagemodelpromptoptions-responseconstraint)`"\] не [существует](https://infra.spec.whatwg.org/#map-exists), то выбросить исключение "`[TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror)`" `[DOMException](https://webidl.spec.whatwg.org/#idl-DOMException)`.
    
2.  Пусть expectedInputTypes будет результатом [получения ожидаемых типов содержимого](#get-the-expected-content-types), переданных [this](https://webidl.spec.whatwg.org/#this)’s [ожидаемые входные данные](#languagemodel-expected-inputs).
    
3.  Пусть messages будет результатом [валидации и канонизации промпта](#validate-and-canonicalize-a-prompt), переданных input, expectedInputTypes и false.
    
4.  Если options\["`[responseConstraint](#dom-languagemodelpromptoptions-responseconstraint)`"\] [существует](https://infra.spec.whatwg.org/#map-exists) и не является null, а также options\["`[omitResponseConstraintInput](#dom-languagemodelpromptoptions-omitresponseconstraintinput)`"\] равно false, то реализации могут вставить [определённое реализацией](https://infra.spec.whatwg.org/#implementation-defined) `[LanguageModelMessage](#dictdef-languagemodelmessage)` в сообщения для направления поведения модели.
    
5.  Пусть measureUsage будет шагом алгоритма, который принимает аргумент stopMeasuring и возвращает результат [измерения использования контекста языковой модели](#measure-language-model-context-usage), заданный сообщениями и stopMeasuring.
    
6.  Вернуть результат [измерения использования входных данных AI-модели](https://webmachinelearning.github.io/writing-assistance-apis/#measure-ai-model-input-usage), заданный [this](https://webidl.spec.whatwg.org/#this), options и measureUsage.
    

**`measureInputUsage(input, options)`** метод шаги:

1.  Вернуть результат выполнения шагов метода `[measureContextUsage()](#dom-languagemodel-measurecontextusage)` с заданным входными данными и параметрами.
    

Шаги метода **`clone(options)`**:

1.  Вернуть результат [клонирования языковой модели](#clone-a-language-model), заданного [this](https://webidl.spec.whatwg.org/#this) и параметров.
    

#### 3.3.1. Предзаполнение и генерация[](#language-model-prompting)

Для **предзаполнения** задано:

-   модель `[LanguageModel](#languagemodel)`,
    
-   входные данные `[LanguageModelPrompt](#typedefdef-languagemodelprompt)`,
    
-   булево значение omitResponseConstraintInput,
    
-   объект или null responseConstraint,
    
-   алгоритм или null error, который принимает [информацию об ошибке](https://webmachinelearning.github.io/writing-assistance-apis/#error-information) и возвращает ничего, а также
    
-   алгоритм или null stopPrefilling, который не принимает аргументов и возвращает булево значение,
    

выполнить следующие шаги:

1.  [Assert](https://infra.spec.whatwg.org/#assert): данный алгоритм выполняется [параллельно](https://html.spec.whatwg.org/multipage/infrastructure.html#in-parallel).
    
2.  Пусть messages — результат [валидации и канонизации приглашения](#validate-and-canonicalize-a-prompt), заданного входными данными, ожидаемыми типами ввода и true, если текущее использование контекста модели [превышает 0](#languagemodel-current-context-usage), иначе false.
    
    Если это вызывает исключение e, то:
    
    1.  Если error не равно null, выполните error с [информацией об ошибке DOMException](https://webmachinelearning.github.io/writing-assistance-apis/#domexception-error-information), у которой [имя](https://webmachinelearning.github.io/writing-assistance-apis/#domexception-error-information-name) совпадает с [именем](https://webidl.spec.whatwg.org/#domexception-name) e и у которой [подробности](https://webmachinelearning.github.io/writing-assistance-apis/#domexception-error-information-details) содержат соответствующие детали.
        
    2.  Верните false.
        
3.  Если responseConstraint не равен null и omitResponseConstraintInput равно false, то реализации могут вставить [определённое реализацией](https://infra.spec.whatwg.org/#implementation-defined) `[LanguageModelMessage](#dictdef-languagemodelmessage)` в сообщения для направления поведения модели.
    
4.  Пусть requested будет результатом [измерения использования контекста языковой модели](#measure-language-model-context-usage), заданным сообщениями и stopPrefilling.
    
5.  Если requested равно null, то вернуть false.
    
6.  Если requested является [информацией об ошибке](https://webmachinelearning.github.io/writing-assistance-apis/#error-information), то:
    
    1.  Если error не равно null, выполнить error с аргументом requested.
        
    2.  Вернуть false.
        
7.  [Утверждение](https://infra.spec.whatwg.org/#assert): requested является числом.
    
8.  Если [текущее использование контекста](#languagemodel-current-context-usage) модели + requested превышает [размер окна контекста](#languagemodel-context-window-size) модели, то:
    
    1.  Если error не равно null, то:
        
        1.  Пусть errorInfo будет [информацией об ошибке превышения квоты](https://webmachinelearning.github.io/writing-assistance-apis/#quota-exceeded-error-information) с [запрашиваемым](https://webidl.spec.whatwg.org/#quotaexceedederror-requested) значением, равным текущему использованию контекста модели + запрашиваемое, и [квотой](https://webidl.spec.whatwg.org/#quotaexceedederror-quota), равной размеру окна контекста модели.
            
        2.  Выполните ошибку, используя errorInfo.
            
    2.  Верните false.
        
9.  Пусть expectedInputTypes будет результатом [получения ожидаемых типов содержимого](#get-the-expected-content-types), полученного на основе [ожидаемых входных данных](#languagemodel-expected-inputs) модели.
    
10.  В [определённом реализацией](https://infra.spec.whatwg.org/#implementation-defined) способе обновите внутреннее состояние подлежащей модели, чтобы включить сообщения.
     
     Процесс должен использовать [исходные сообщения](#languagemodel-initial-messages) модели, [top K](#languagemodel-top-k) модели, [температуру](#languagemodel-temperature) модели, [ожидаемые входы](#languagemodel-expected-inputs) модели, [ожидаемые выходы](#languagemodel-expected-outputs) модели и [инструменты](#languagemodel-tools) модели для определения того, как обновляется состояние.
     
     Процесс должен соответствовать рекомендациям, приведённым в [§ 4 Рассмотрение конфиденциальности](#privacy) и [§ 5 Рассмотрение безопасности](#security).
     
     Если во время этого процесса stopPrefilling возвращает true, то вернуть false.
     
     Если во время предварительного заполнения произошла ошибка:
     
     1.  Пусть ошибка будет представлена как [информация об ошибке](https://webmachinelearning.github.io/writing-assistance-apis/#error-information) errorInfo в соответствии с рекомендациями, приведёнными в [§ 3.3.4 Ошибки](#language-model-errors).
         
     2.  Если ошибка не равна null, выполнить ошибку, заданную errorInfo.
         
     3.  Вернуть false.
         
11.  Установите [текущее использование контекста модели](#languagemodel-current-context-usage) модели равным [текущему использованию контекста модели](#languagemodel-current-context-usage) + запрошенное значение.
     
12.  Вернуть true.
     

Чтобы **сгенерировать** заданное:

-   модель `[LanguageModel](#languagemodel)`,
    
-   ограничение ответа в виде объекта или null,
    
-   алгоритм chunkProduced, который принимает [строку](https://infra.spec.whatwg.org/#string) и ничего не возвращает,
    
-   алгоритм done, который не принимает аргументов и ничего не возвращает,
    
-   алгоритм error, который принимает [информацию об ошибке](https://webmachinelearning.github.io/writing-assistance-apis/#error-information) и ничего не возвращает, и
    
-   алгоритм stopProducing, который не принимает аргументов и возвращает булево значение,
    

выполните следующие шаги:

1.  [Утверждение](https://infra.spec.whatwg.org/#assert): данный алгоритм выполняется [параллельно](https://html.spec.whatwg.org/multipage/infrastructure.html#in-parallel).
    
2.  В определённом [implementation-defined](https://infra.spec.whatwg.org/#implementation-defined) порядке, с учётом следующих рекомендаций, начните процесс генерации ответа от языковой модели на основе её текущего внутреннего состояния.
    
    Процесс должен использовать [initial messages](#languagemodel-initial-messages) модели, [top K](#languagemodel-top-k) модели, [temperature](#languagemodel-temperature) модели, [expected inputs](#languagemodel-expected-inputs) модели, [expected outputs](#languagemodel-expected-outputs) модели, [tools](#languagemodel-tools) модели и responseConstraint для управления поведением модели.
    
    Процесс подсказок должен соответствовать рекомендациям, приведённым в [§ 4 Privacy considerations](#privacy) и [§ 5 Security considerations](#security).
    
    Если [tools](#languagemodel-tools) модели не пусты, модель может использовать предоставленные инструменты, вызывая их функции execute.
    
3.  Пока true:
    
    1.  Дождитесь следующего фрагмента данных ответа, завершения процесса или того, что результат вызова stopProducing станет истинным.
        
    2.  Если такой фрагмент успешно создан:
        
        1.  Пусть он будет представлен как фрагмент [строки](https://infra.spec.whatwg.org/#string).
            
        2.  Если chunkProduced не равно null, выполните chunkProduced с параметром chunk.
            
    3.  В противном случае, если процесс завершён:
        
        1.  Если done не равно null, выполните done.
            
        2.  [Прервать](https://infra.spec.whatwg.org/#iteration-break).
            
    4.  В противном случае, если stopProducing возвращает true, тогда [прервать](https://infra.spec.whatwg.org/#iteration-break).
        
    5.  В противном случае, если произошла ошибка во время запроса:
        
        1.  Пусть ошибка будет представлена как [информация об ошибке](https://webmachinelearning.github.io/writing-assistance-apis/#error-information) errorInfo согласно руководству в [§ 3.3.4 Ошибки](#language-model-errors).
            
        2.  Если error не равно null, выполните error с параметром errorInfo.
            
        3.  [Прервать](https://infra.spec.whatwg.org/#iteration-break).
            

#### 3.3.2. Использование[](#language-model-usage)

Чтобы **измерить использование контекста языковой модели** при заданных:

-   списке [LanguageModelMessage](#dictdef-languagemodelmessage) сообщений,
    
-   алгоритме stopMeasuring, который не принимает аргументов и возвращает булево значение,
    

выполните следующие шаги:

1.  [Утверждение](https://infra.spec.whatwg.org/#assert): этот алгоритм выполняется [параллельно](https://html.spec.whatwg.org/multipage/infrastructure.html#in-parallel).
    
2.  Пусть inputToModel — это [определённый реализацией](https://infra.spec.whatwg.org/#implementation-defined) ввод, который будет отправлен подлежащей модели для [prefill](#prefill) заданных сообщений.
    
    Обычно это включает в себя кодирование всех входных данных, возможно, с использованием инженерии промптов или других обёрток, определённых реализацией.
    
    Если во время этого процесса stopMeasuring начинает возвращать true, верните null.
    
    Если во время этого процесса происходит ошибка, верните соответствующую информацию об ошибке [DOMException](https://webmachinelearning.github.io/writing-assistance-apis/#domexception-error-information) в соответствии с рекомендациями из раздела [§ 3.3.4 Errors](#language-model-errors).
    
3.  Верните количество использования контекста, необходимое для представления inputToModel при передаче его модели. Точная процедура вычисления является [implementation-defined](https://infra.spec.whatwg.org/#implementation-defined), но должна учитывать следующие ограничения.
    
    Использование контекста, возвращаемое функцией, должно быть неотрицательным и конечным. Оно должно быть приблизительно пропорциональным количеству данных в inputToModel.
    
    Это может быть количество токенов, необходимых для представления входных данных в схеме токенизации [языковой модели](https://arxiv.org/abs/2404.08335), или это может быть связано с размером данных в байтах.
    
    Если во время этого процесса stopMeasuring начинает возвращать true, вместо этого верните null.
    
    Если во время этого процесса происходит ошибка, вместо этого верните соответствующую [информацию об ошибке DOMException](https://webmachinelearning.github.io/writing-assistance-apis/#domexception-error-information) в соответствии с руководством в [§ 3.3.4 Ошибки](#language-model-errors).
    

#### 3.3.3. Параметры[](#language-model-options)

Чтобы **получить ожидаемые типы содержимого**, задав список `[LanguageModelExpected](#dictdef-languagemodelexpected)`s expectedContents:

1.  Пусть expectedTypes будет пустым [списком](https://infra.spec.whatwg.org/#list) `[LanguageModelMessageType](#enumdef-languagemodelmessagetype)`s.
    
2.  [Для каждого](https://infra.spec.whatwg.org/#list-iterate) expected из expectedContents:
    
    1.  Если expectedTypes не [содержит](https://infra.spec.whatwg.org/#list-contain) expected\["`[type](#dom-languagemodelexpected-type)`"\], тогда [добавьте](https://infra.spec.whatwg.org/#list-append) expected\["`[type](#dom-languagemodelexpected-type)`"\] в expectedTypes.
        
3.  Если expectedTypes не [содержит](https://infra.spec.whatwg.org/#list-contain) "`[text](#dom-languagemodelmessagetype-text)`", то [добавьте](https://infra.spec.whatwg.org/#list-append) "`[text](#dom-languagemodelmessagetype-text)`" в expectedTypes.
    
4.  Верните expectedTypes.
    

Чтобы **проверить и привести к канонической форме приглашение** на основе входного `[LanguageModelPrompt](#typedefdef-languagemodelprompt)`, списка `[LanguageModelMessageType](#enumdef-languagemodelmessagetype)`s expectedTypes и булева значения hasAppendedInput, выполните следующие шаги. Возвращаемое значение будет непустым [списком](https://infra.spec.whatwg.org/#list) `[LanguageModelMessage](#dictdef-languagemodelmessage)`s в их "длинной" форме.

1.  [Утверждение](https://infra.spec.whatwg.org/#assert): expectedTypes [содержит](https://infra.spec.whatwg.org/#list-contain) "`[text](#dom-languagemodelmessagetype-text)`".
    
2.  Если вход является [строкой](https://infra.spec.whatwg.org/#string), то вернуть « «\[ "`[role](#dom-languagemodelmessage-role)`" → "`[user](#dom-languagemodelmessagerole-user)`", "`[content](#dom-languagemodelmessage-content)`" → « «\[ "`[type](#dom-languagemodelmessagecontent-type)`" → "`[text](#dom-languagemodelmessagetype-text)`", "`[value](#dom-languagemodelmessagecontent-value)`" → input \]» », "`[prefix](#dom-languagemodelmessage-prefix)`" → false \]» ».
    
3.  [Утверждение](https://infra.spec.whatwg.org/#assert): вход является [списком](https://infra.spec.whatwg.org/#list) объектов `[LanguageModelMessage](#dictdef-languagemodelmessage)`.
    
4.  Если вход представляет собой пустой [список](https://infra.spec.whatwg.org/#list), то вернуть « «\[ "`[role](#dom-languagemodelmessage-role)`" → "`[user](#dom-languagemodelmessagerole-user)`", "`[content](#dom-languagemodelmessage-content)`" → « «\[ "`[type](#dom-languagemodelmessagecontent-type)`" → "`[text](#dom-languagemodelmessagetype-text)`", "`[value](#dom-languagemodelmessagecontent-value)`" → "" \]» », "`[prefix](#dom-languagemodelmessage-prefix)`" → false \]» ».
    
5.  Пусть messages будет пустым [списком](https://infra.spec.whatwg.org/#list) объектов `[LanguageModelMessage](#dictdef-languagemodelmessage)`.
    
6.  [Для каждого](https://infra.spec.whatwg.org/#list-iterate) сообщения из входных данных:
    
    1.  Если message\["`[content](#dom-languagemodelmessage-content)`"\] является [строкой](https://infra.spec.whatwg.org/#string), то установите message в «\[ "`[role](#dom-languagemodelmessage-role)`" → message\["`[role](#dom-languagemodelmessage-role)`"\], "`[content](#dom-languagemodelmessage-content)`" → « «\[ "`[type](#dom-languagemodelmessagecontent-type)`" → "`[text](#dom-languagemodelmessagetype-text)`", "`[value](#dom-languagemodelmessagecontent-value)`" → message\["`[content](#dom-languagemodelmessage-content)`"\] \]» », "`[prefix](#dom-languagemodelmessage-prefix)`" → message\["`[prefix](#dom-languagemodelmessage-prefix)`"\] \]».
        
    2.  Если message\["`[prefix](#dom-languagemodelmessage-prefix)`"\] является true, то:
        
        1.  Если message\["`[role](#dom-languagemodelmessage-role)`"\] не является "`[assistant](#dom-languagemodelmessagerole-assistant)`", то выбросьте исключение типа "`[SyntaxError](https://webidl.spec.whatwg.org/#syntaxerror)`" `[DOMException](https://webidl.spec.whatwg.org/#idl-DOMException)`.
            
        2.  Если сообщение не является последним элементом в messages, то выбросить исключение "`[SyntaxError](https://webidl.spec.whatwg.org/#syntaxerror)`" типа `[DOMException](https://webidl.spec.whatwg.org/#idl-DOMException)`.
            
    3.  Если message\["`[role](#dom-languagemodelmessage-role)`"\] равно "`[system](#dom-languagemodelmessagerole-system)`", то:
        
        1.  Если hasAppendedInput равно true, то выбросить исключение "`[TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror)`" типа `[DOMException](https://webidl.spec.whatwg.org/#idl-DOMException)`.
            
    4.  Если message\["`[content](#dom-languagemodelmessage-content)`"\] является пустым [list](https://infra.spec.whatwg.org/#list), то:
        
        1.  Пусть emptyContent будет новым объектом типа `[LanguageModelMessageContent](#dictdef-languagemodelmessagecontent)`, инициализированным с «\[ "`[type](#dom-languagemodelmessagecontent-type)`" → "`[text](#dom-languagemodelmessagetype-text)`", "`[value](#dom-languagemodelmessagecontent-value)`" → "" \]».
            
        2.  [append](https://infra.spec.whatwg.org/#list-append) пустойContent в message\["`[content](#dom-languagemodelmessage-content)`"\].
            
    5.  [Для каждого](https://infra.spec.whatwg.org/#list-iterate) content в message\["`[content](#dom-languagemodelmessage-content)`"\]:
        
        1.  Если message\["`[role](#dom-languagemodelmessage-role)`"\] является "`[assistant](#dom-languagemodelmessagerole-assistant)`" и content\["`[type](#dom-languagemodelmessagecontent-type)`"\] не является "`[text](#dom-languagemodelmessagetype-text)`", то бросить исключение "`[NotSupportedError](https://webidl.spec.whatwg.org/#notsupportederror)`" `[DOMException](https://webidl.spec.whatwg.org/#idl-DOMException)`.
            
        2.  Если content\["`[type](#dom-languagemodelmessagecontent-type)`"\] является "`[text](#dom-languagemodelmessagetype-text)`" и content\["`[value](#dom-languagemodelmessagecontent-value)`"\] не является [string](https://infra.spec.whatwg.org/#string), то выбросить "`[TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror)`" `[DOMException](https://webidl.spec.whatwg.org/#idl-DOMException)`.
            
        3.  Если content\["`[type](#dom-languagemodelmessagecontent-type)`"\] является "`[image](#dom-languagemodelmessagetype-image)`", то:
            
            1.  Если expectedTypes не [содержит](https://infra.spec.whatwg.org/#list-contain) "`[image](#dom-languagemodelmessagetype-image)`", то выбросить "`[NotSupportedError](https://webidl.spec.whatwg.org/#notsupportederror)`" `[DOMException](https://webidl.spec.whatwg.org/#idl-DOMException)`.
                
            2.  Если content\["`[value](#dom-languagemodelmessagecontent-value)`"\] не является `[ImageBitmapSource](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#imagebitmapsource)` или `[BufferSource](https://webidl.spec.whatwg.org/#BufferSource)`, то выбросить "`[TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror)`" `[DOMException](https://webidl.spec.whatwg.org/#idl-DOMException)`.
                
        4.  Если content\["`[type](#dom-languagemodelmessagecontent-type)`"\] равно "`[audio](#dom-languagemodelmessagetype-audio)`", то:
            
            1.  Если expectedTypes не [содержит](https://infra.spec.whatwg.org/#list-contain) "`[audio](#dom-languagemodelmessagetype-audio)`", то выбросить "`[NotSupportedError](https://webidl.spec.whatwg.org/#notsupportederror)`" `[DOMException](https://webidl.spec.whatwg.org/#idl-DOMException)`.
                
            2.  Если содержимое\["`[value](#dom-languagemodelmessagecontent-value)`"\] не является `[AudioBuffer](https://webaudio.github.io/web-audio-api/#AudioBuffer)`, `[BufferSource](https://webidl.spec.whatwg.org/#BufferSource)` или `[Blob](https://w3c.github.io/FileAPI/#dfn-Blob)`, то выбросить исключение "`[TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror)`" `[DOMException](https://webidl.spec.whatwg.org/#idl-DOMException)`.
                
    6.  Пусть contentWithContiguousTextCollapsed будет пустым [списком](https://infra.spec.whatwg.org/#list) объектов `[LanguageModelMessageContent](#dictdef-languagemodelmessagecontent)`.
        
    7.  Пусть lastTextContent будет null.
        
    8.  [Для каждого](https://infra.spec.whatwg.org/#list-iterate) content в message\["`[content](#dom-languagemodelmessage-content)`"\]:
        
        1.  Если content\["`[type](#dom-languagemodelmessagecontent-type)`"\] является "`[text](#dom-languagemodelmessagetype-text)`":
            
            1.  Если lastTextContent равно null:
                
                1.  [Добавить](https://infra.spec.whatwg.org/#list-append) content в contentWithContiguousTextCollapsed.
                    
                2.  Установите lastTextContent в значение content.
                    
            2.  В противном случае установите lastTextContent["`[value](#dom-languagemodelmessagecontent-value)`"] в виде конкатенации lastTextContent["`[value](#dom-languagemodelmessagecontent-value)`"] и content["`[value](#dom-languagemodelmessagecontent-value)`"].
                
                Не добавляется пробел или другие символы. Таким образом, « «[ "`[type](#dom-languagemodelmessagecontent-type)`" → "`[text](#dom-languagemodelmessagetype-text)`", "`foo`" ]», «[ "`[type](#dom-languagemodelmessagecontent-type)`" → "`[text](#dom-languagemodelmessagetype-text)`", "`bar`" ]» » канонизируется в « «[ "`[type](#dom-languagemodelmessagecontent-type)`" → "`[text](#dom-languagemodelmessagetype-text)`", "`foobar`" ]».
                
        2.  В противном случае:
            
            1.  [Добавьте](https://infra.spec.whatwg.org/#list-append) content в contentWithContiguousTextCollapsed.
                
            2.  Установите lastTextContent в null.
                
        3.  Установите message["`[content](#dom-languagemodelmessage-content)`"] в значение contentWithContiguousTextCollapsed.
            
    9.  [Добавить](https://infra.spec.whatwg.org/#list-append) сообщение в messages.
        
    10.  Установить hasAppendedInput в true.
         
7.  Если messages [пустой](https://infra.spec.whatwg.org/#list-is-empty), то сгенерировать исключение "`[SyntaxError](https://webidl.spec.whatwg.org/#syntaxerror)`" типа `[DOMException](https://webidl.spec.whatwg.org/#idl-DOMException)`.
    
8.  Вернуть messages.
    

#### 3.3.4. Ошибки[](#language-model-errors)

Когда запрос не удается, могут быть выявлены следующие возможные причины для веб-разработчика. В этой таблице перечислены возможные `[DOMException](https://webidl.spec.whatwg.org/#idl-DOMException)` [имена](https://webidl.spec.whatwg.org/#domexception-name) и случаи, в которых реализация должна их использовать:

| `[DOMException](https://webidl.spec.whatwg.org/#idl-DOMException)` [имя](https://webidl.spec.whatwg.org/#domexception-name) | Сценарии |
| --- | --- |
| "`[NotAllowedError](https://webidl.spec.whatwg.org/#notallowederror)`" | 
Запрос отключен по выбору пользователя или политике пользователя.

 |
| "`[NotReadableError](https://webidl.spec.whatwg.org/#notreadableerror)`" | 

Выходные данные модели были отфильтрованы агентом пользователя, например, потому что было обнаружено, что они вредоносны, неточны или бессмысленны.

 |
| "`[NotSupportedError](https://webidl.spec.whatwg.org/#notsupportederror)`" | 

Входные данные для обработки были на языке, который агент пользователя не поддерживает, или не были предоставлены должным образом в вызове `[create()](#dom-languagemodel-create)`.

Выходные данные модели оказались на языке, который агент пользователя не поддерживает (например, потому что агент пользователя не провёл достаточное количество тестов на качество для этого языка).

 |
| "`[UnknownError](https://webidl.spec.whatwg.org/#unknownerror)`" | 

Все остальные сценарии, включая случаи, когда агент пользователя считает, что не может побудить модель и одновременно выполнить требования, указанные в [§ 4 Privacy considerations](#privacy) или [§ 5 Security considerations](#security). Или, если агент пользователь предпочитает не раскрывать причину сбоя.

 |

Эта таблица не предоставляет полный список исключений, которые могут быть возвращены через API промптов. Она содержит только те исключения, которые могут возникнуть на определённых [implementation-defined](https://infra.spec.whatwg.org/#implementation-defined) шагах.

Чтобы **создать копию языковой модели** при наличии `[LanguageModel](#languagemodel)` модели и `[LanguageModelCloneOptions](#dictdef-languagemodelcloneoptions)` параметров:

1.  Пусть global будет [relevant global object](https://html.spec.whatwg.org/multipage/webappapis.html#concept-relevant-global) модели.
    
2.  [Assert](https://infra.spec.whatwg.org/#assert): global является объектом `[Window](https://html.spec.whatwg.org/multipage/nav-history-apis.html#window)`.
    
3.  Если глобальный объект имеет [связанный документ](https://html.spec.whatwg.org/multipage/nav-history-apis.html#concept-document-window), который не является [полностью активным](https://html.spec.whatwg.org/multipage/document-sequences.html#fully-active), то верните [отклонённое обещание](https://webidl.spec.whatwg.org/#a-promise-rejected-with) с ошибкой "`[InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror)`" типа `[DOMException](https://webidl.spec.whatwg.org/#idl-DOMException)`.
    
4.  Пусть signals будет « [сигналом](https://dom.spec.whatwg.org/#abortcontroller-signal) у [контроллера прерывания разрушения модели](https://webmachinelearning.github.io/writing-assistance-apis/#destroyablemodel-destruction-abort-controller) модели ».
    
5.  Если options\["`signal`"\] [существует](https://infra.spec.whatwg.org/#map-exists), то [добавьте](https://infra.spec.whatwg.org/#set-append) его в signals.
    
6.  Пусть compositeSignal будет результатом [создания зависимого сигнала отмены](https://dom.spec.whatwg.org/#create-a-dependent-abort-signal), полученного с использованием сигналов и `[AbortSignal](https://dom.spec.whatwg.org/#abortsignal)` и модели’s [relevant realm](https://html.spec.whatwg.org/multipage/webappapis.html#concept-relevant-realm).
    
7.  Если compositeSignal [отменён](https://dom.spec.whatwg.org/#abortsignal-aborted), то верните [обещание, отклонённое с](https://webidl.spec.whatwg.org/#a-promise-rejected-with) [причиной отмены](https://dom.spec.whatwg.org/#abortsignal-abort-reason) compositeSignal.
    
8.  Пусть signal будет options\["`[signal](#dom-languagemodelcloneoptions-signal)`"\], если он [существует](https://infra.spec.whatwg.org/#map-exists); в противном случае null.
    
9.  Если signal не равен null и [отменён](https://dom.spec.whatwg.org/#abortsignal-aborted), то верните обещание, отклонённое с [причиной отмены](https://dom.spec.whatwg.org/#abortsignal-abort-reason) signal.
    
10.  Пусть promise будет [новым обещанием](https://webidl.spec.whatwg.org/#a-new-promise), созданным в [связанном мире](https://html.spec.whatwg.org/multipage/webappapis.html#concept-relevant-realm) модели.
     
11.  Пусть abortedDuringOperation будет false.
     
     Эта переменная будет записана из [очереди событий](https://html.spec.whatwg.org/multipage/webappapis.html#event-loop), но будет считываться [параллельно](https://html.spec.whatwg.org/multipage/infrastructure.html#in-parallel).
     
12.  [Добавьте следующие шаги прерывания](https://dom.spec.whatwg.org/#abortsignal-add) в compositeSignal:
     
     1.  Установите abortedDuringOperation в true.
         
     2.  [Отклоните](https://webidl.spec.whatwg.org/#reject) promise с помощью [причины прерывания](https://dom.spec.whatwg.org/#abortsignal-abort-reason) compositeSignal.
         
13.  [Параллельно](https://html.spec.whatwg.org/multipage/infrastructure.html#in-parallel):
     
     1.  [Запланируйте глобальную задачу](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-global-task) в [источнике задач AI](https://webmachinelearning.github.io/writing-assistance-apis/#ai-task-source), чтобы выполнить следующие шаги:
         
         1.  Если abortedDuringOperation равно true, вернитесь.
             
         2.  Пусть clonedModel будет новым объектом `[LanguageModel](#languagemodel)` с:
             
             -   [исходными сообщениями](#languagemodel-initial-messages), установленными как у модели [исходные сообщения](#languagemodel-initial-messages).
                 
             -   [top K](#languagemodel-top-k) установлено как у модели [top K](#languagemodel-top-k).
                 
             -   [температура](#languagemodel-temperature) установлена как у модели [температура](#languagemodel-temperature).
                 
             -   [ожидаемые входные данные](#languagemodel-expected-inputs) установлены как у модели [ожидаемые входные данные](#languagemodel-expected-inputs).
                 
             -   [ожидаемые выходные данные](#languagemodel-expected-outputs) установлены как у модели [ожидаемые выходные данные](#languagemodel-expected-outputs).
                 
             -   [инструменты](#languagemodel-tools) установлены как у модели [инструменты](#languagemodel-tools).
                 
             -   [размер контекстного окна](#languagemodel-context-window-size) установлен в размер контекстного окна модели [размер контекстного окна](#languagemodel-context-window-size).
                 
             -   [текущее использование контекста](#languagemodel-current-context-usage) установлено в текущее использование контекста модели [текущее использование контекста](#languagemodel-current-context-usage).
                 
         3.  В [определённом реализацией](https://infra.spec.whatwg.org/#implementation-defined) порядке скопируйте любое другое состояние из модели в clonedModel.
             
         4.  Если операция копирования завершится неудачно:
             
             1.  [Отклоните](https://webidl.spec.whatwg.org/#reject) промис с помощью "`[OperationError](https://webidl.spec.whatwg.org/#operationerror)`" `[DOMException](https://webidl.spec.whatwg.org/#idl-DOMException)`.
                 
             2.  Вернуться.
                 
         5.  [Разрешить](https://webidl.spec.whatwg.org/#resolve) промис с clonedModel.
             
14.  Вернуть промис.
     

### 3.4. Интеграция политики разрешений[](#permissions-policy)

Доступ к API промптов ограничен через [функцию, контролируемую политикой](https://w3c.github.io/webappsec-permissions-policy/#policy-controlled-feature) "**`language-model`**", которая имеет [список разрешённых по умолчанию](https://w3c.github.io/webappsec-permissions-policy/#policy-controlled-feature-default-allowlist) `['self'](https://w3c.github.io/webappsec-permissions-policy/#default-allowlist-self)`.

## 4\. Рассмотрение конфиденциальности[](#privacy)

Пожалуйста, см. [Writing Assistance APIs § 6 Рассмотрение конфиденциальности](https://webmachinelearning.github.io/writing-assistance-apis/#privacy) для обсуждения вопросов конфиденциальности, касающихся API промптов. Этот текст был написан с учётом применимости ко всем API, использующим ту же инфраструктуру, как указано в [§ 2 Зависимости](#dependencies).

## 5\. Рассмотрение безопасности[](#security)

Обсуждение вопросов безопасности для API prompt см. в разделе [Writing Assistance APIs § 7 Security considerations](https://webmachinelearning.github.io/writing-assistance-apis/#security). Этот текст был написан с учётом применимости ко всем API, использующим ту же инфраструктуру, как указано в [§ 2 Dependencies](#dependencies).

## Index[](#index)

### Термины, определённые в этой спецификации[](#index-defined-here)

-   [append(input)](#dom-languagemodel-append), в разделе § 3.3
-   [append(input, options)](#dom-languagemodel-append), в разделе § 3.3
-   ["assistant"](#dom-languagemodelmessagerole-assistant), в разделе § 3
-   ["audio"](#dom-languagemodelmessagetype-audio), в разделе § 3
-   [availability()](#dom-languagemodel-availability), в разделе § 3.2
-   [availability(options)](#dom-languagemodel-availability), в разделе § 3.2
-   ["balanced"](#dom-languagemodelsamplingmode-balanced), в разделе § 3
-   [clone()](#dom-languagemodel-clone), в разделе § 3.3
-   [клонирование модели языка](#clone-a-language-model), в разделе § 3.3.4
-   [clone(options)](#dom-languagemodel-clone), в разделе § 3.3
-   [настройки доступности вычислительной языковой модели](#compute-language-model-options-availability), в § 3.2
-   [содержимое](#dom-languagemodelmessage-content), в § 3
-   [переполнение контекста](#eventdef-languagemodel-contextoverflow), в § 3.3
-   [использование контекста](#dom-languagemodel-contextusage), в § 3.3
-   [окно контекста](#dom-languagemodel-contextwindow), в § 3.3
-   [размер окна контекста](#languagemodel-context-window-size), в § 3.3
-   [create()](#dom-languagemodel-create), в § 3.1
-   [создание объекта языковой модели](#create-a-language-model-object), в § 3.1
-   [create(options)](#dom-languagemodel-create), в § 3.1
-   ["creative"](#dom-languagemodelsamplingmode-creative), в § 3
-   [текущее использование контекста](#languagemodel-current-context-usage), в § 3.3
-   [defaultTemperature](#dom-languagemodelparams-defaulttemperature), в § 3
-   [defaultTopK](#dom-languagemodelparams-defaulttopk), в § 3
-   [описание](#dom-languagemodeltool-description), в § 3
-   [скачайте языковую модель](#download-the-language-model), в § 3.1
-   [выполнить](#dom-languagemodeltool-execute), в § 3
-   [ожидаемые входные данные](#languagemodel-expected-inputs), в § 3.3
-   [expectedInputs](#dom-languagemodelcreatecoreoptions-expectedinputs), в § 3
-   [ожидаемые выходные данные](#languagemodel-expected-outputs), в § 3.3
-   [expectedOutputs](#dom-languagemodelcreatecoreoptions-expectedoutputs), в § 3
-   [создать](#generate), в § 3.3.1
-   [получить ожидаемые типы содержимого](#get-the-expected-content-types), в § 3.3.3
-   ["image"](#dom-languagemodelmessagetype-image), в § 3
-   [инициализировать модель языка](#initialize-the-language-model), в § 3.1
-   [исходные сообщения](#languagemodel-initial-messages), в § 3.3
-   [initialPrompts](#dom-languagemodelcreateoptions-initialprompts), в § 3
-   [inputQuota](#dom-languagemodel-inputquota), в § 3.3
-   [inputSchema](#dom-languagemodeltool-inputschema), в § 3
-   [inputUsage](#dom-languagemodel-inputusage), в § 3.3
-   [language-model](#permissiondef-language-model), в § 3.4
-   [LanguageModel](#languagemodel), в § 3
-   [LanguageModelAppendOptions](#dictdef-languagemodelappendoptions), в § 3
-   [LanguageModelCloneOptions](#dictdef-languagemodelcloneoptions), в § 3
-   [доступность типа содержимого языковой модели](#language-model-content-type-availability), в § 3.2
-   [LanguageModelCreateCoreOptions](#dictdef-languagemodelcreatecoreoptions), в § 3
-   [LanguageModelCreateOptions](#dictdef-languagemodelcreateoptions), в § 3
-   [LanguageModelExpected](#dictdef-languagemodelexpected), в § 3
-   [LanguageModelMessage](#dictdef-languagemodelmessage), в § 3
-   [LanguageModelMessageContent](#dictdef-languagemodelmessagecontent), в § 3
-   [LanguageModelMessageRole](#enumdef-languagemodelmessagerole), в § 3
-   [LanguageModelMessageType](#enumdef-languagemodelmessagetype), в § 3
-   [LanguageModelMessageValue](#typedefdef-languagemodelmessagevalue), в § 3
-   [доступность неопций языковой модели](#language-model-non-options-availability), в § 3.2
-   [LanguageModelParams](#languagemodelparams), в § 3
-   [LanguageModelPrompt](#typedefdef-languagemodelprompt), в § 3
-   [LanguageModelPromptOptions](#dictdef-languagemodelpromptoptions), в § 3
-   [LanguageModelSamplingMode](#enumdef-languagemodelsamplingmode), в § 3
-   [LanguageModelTool](#dictdef-languagemodeltool), в § 3
-   [LanguageModelToolFunction](#callbackdef-languagemodeltoolfunction), в § 3
-   [languages](#dom-languagemodelexpected-languages), в § 3
-   [maxTemperature](#dom-languagemodelparams-maxtemperature), в § 3
-   [maxTopK](#dom-languagemodelparams-maxtopk), в § 3
-   [measureContextUsage(input)](#dom-languagemodel-measurecontextusage), в § 3.3
-   [measureContextUsage(input, options)](#dom-languagemodel-measurecontextusage), в § 3.3
-   [measureInputUsage(input)](#dom-languagemodel-measureinputusage), в § 3.3
-   [measureInputUsage(input, options)](#dom-languagemodel-measureinputusage), в § 3.3
-   [измерение использования контекста языковой модели](#measure-language-model-context-usage), в § 3.3.2
-   [monitor](#dom-languagemodelcreateoptions-monitor), в § 3
-   ["most-creative"](#dom-languagemodelsamplingmode-most-creative), в § 3
-   ["most-predictable"](#dom-languagemodelsamplingmode-most-predictable), в § 3
-   [name](#dom-languagemodeltool-name), в § 3
-   [omitResponseConstraintInput](#dom-languagemodelpromptoptions-omitresponseconstraintinput), в § 3
-   [oncontextoverflow](#dom-languagemodel-oncontextoverflow), в § 3.3
-   [onquotaoverflow](#dom-languagemodel-onquotaoverflow), в § 3.3
-   [params()](#dom-languagemodel-params), в § 3
-   ["predictable"](#dom-languagemodelsamplingmode-predictable), в § 3
-   [prefill](#prefill), в § 3.3.1
-   [prefix](#dom-languagemodelmessage-prefix), в § 3
-   [prompt(input)](#dom-languagemodel-prompt), в § 3.3
-   [prompt(input, options)](#dom-languagemodel-prompt), в § 3.3
-   [promptStreaming(input)](#dom-languagemodel-promptstreaming), в § 3.3
-   [promptStreaming(input, options)](#dom-languagemodel-promptstreaming), в § 3.3
-   [quotaoverflow](#eventdef-languagemodel-quotaoverflow), в § 3.3
-   [responseConstraint](#dom-languagemodelpromptoptions-responseconstraint), в § 3
-   [role](#dom-languagemodelmessage-role), в § 3
-   samplingMode
    -   [атрибут для LanguageModel](#dom-languagemodel-samplingmode), в § 3
    -   [член словаря для LanguageModelCreateCoreOptions](#dom-languagemodelcreatecoreoptions-samplingmode), в § 3
-   signal
    -   [член словаря для LanguageModelAppendOptions](#dom-languagemodelappendoptions-signal), в § 3
    -   [член словаря для LanguageModelCloneOptions](#dom-languagemodelcloneoptions-signal), в § 3
    -   [член словаря для LanguageModelCreateOptions](#dom-languagemodelcreateoptions-signal), в § 3
    -   [член словаря для LanguageModelPromptOptions](#dom-languagemodelpromptoptions-signal), в § 3
-   ["slightly-creative"](#dom-languagemodelsamplingmode-slightly-creative), в § 3
-   ["slightly-predictable"](#dom-languagemodelsamplingmode-slightly-predictable), в § 3
-   ["system"](#dom-languagemodelmessagerole-system), в § 3
-   temperature
    -   [атрибут для LanguageModel](#dom-languagemodel-temperature), в § 3.3
    -   [dfn для LanguageModel](#languagemodel-temperature), в § 3.3
    -   [член словаря для LanguageModelCreateCoreOptions](#dom-languagemodelcreatecoreoptions-temperature), в § 3
-   ["text"](#dom-languagemodelmessagetype-text), в § 3
-   ["tool-call"](#dom-languagemodelmessagetype-tool-call), в § 3
-   ["tool-response"](#dom-languagemodelmessagetype-tool-response), в § 3
-   инструменты
    -   [dfn для LanguageModel](#languagemodel-tools), в § 3.3
    -   [член словаря для LanguageModelCreateCoreOptions](#dom-languagemodelcreatecoreoptions-tools), в § 3
-   топ K, в § 3.3
-   topK
    -   [атрибут для LanguageModel](#dom-languagemodel-topk), в § 3.3
    -   [член словаря для LanguageModelCreateCoreOptions](#dom-languagemodelcreatecoreoptions-topk), в § 3
-   тип
    -   [член словаря для LanguageModelExpected](#dom-languagemodelexpected-type), в § 3
    -   [член словаря для LanguageModelMessageContent](#dom-languagemodelmessagecontent-type), в § 3
-   ["user"](#dom-languagemodelmessagerole-user), в § 3
-   [валидация и канонизация подсказки](#validate-and-canonicalize-a-prompt), в § 3.3.3
-   [валидация и канонизация параметров языковой модели](#validate-and-canonicalize-language-model-options), в § 3.1
-   [валидация и канонизация подсказки](#validate-and-canonicalize-a-prompt), в § 3.3.3
-   [value](#dom-languagemodelmessagecontent-value), в § 3

### Термины, определённые ссылкой[](#index-defined-elsewhere)

-   \[DOM\] определяет следующие термины:
    -   AbortSignal
    -   EventTarget
    -   причина отмены
    -   отменено
    -   добавить
    -   создать зависимый сигнал отмены
    -   signal
-   \[ECMASCRIPT\] определяет следующие термины:
    -   realm
    -   окружающий агент
-   \[FileAPI\] определяет следующие термины:
    -   Blob
-   \[HTML\] определяет следующие термины:
    -   EventHandler
    -   ImageBitmapSource
    -   Window
    -   связанный документ
    -   обработчик события
    -   тип события обработчика событий
    -   атрибут IDL обработчика событий
    -   цикл событий
    -   цикл событий (для агента)
    -   полностью активный
    -   параллельно
    -   запланировать глобальную задачу
    -   связанный глобальный объект
    -   связанный realm
-   \[INFRA\] определяет следующие термины:
    -   добавить (для списка)
    -   добавить (для множества)
    -   утверждение
    -   прервать
    -   содержать
    -   существовать
    -   для каждого /no_think

</think>
    -   определено реализацией
    -   пустой
    -   список
    -   строка
-   \[PERMISSIONS-POLICY-1\] определяет следующие термины:
    -   'self'
    -   список по умолчанию
    -   функция, управляемая политикой
-   \[STREAMS\] определяет следующие термины:
    -   ReadableStream
-   \[WEBAUDIO-1.0\] определяет следующие термины:
    -   AudioBuffer
-   \[WEBIDL\] определяет следующие термины:
    -   BufferSource
    -   DOMException
    -   DOMString
    -   Exposed
    -   InvalidStateError
    -   NotAllowedError
    -   NotReadableError
    -   NotSupportedError
    -   OperationError
    -   Promise
    -   SecureContext
    -   SyntaxError
    -   TypeError
    -   UnknownError
    -   новая промис-объект
    -   отклонённый промис с
    -   любой
    -   булево значение
    -   double
    -   float
    -   имя
    -   объект
    -   квота
    -   отклонить
    -   запрошенный
    -   выполнить
    -   последовательность
    -   это
    -   неопределённое значение
    -   неограниченный double
    -   unsigned long
-   \[WRITING-ASSISTANCE-APIS\] определяет следующие термины:
    -   "доступен"
    -   "скачиваемый"
    -   "скачивается"
    -   "недоступен"
    -   Доступность
    -   CreateMonitorCallback
    -   DestroyableModel
    -   источник задачи ИИ
    -   может поддерживать
    -   вычислить доступность модели ИИ
    -   вычислить доступность языка
    -   создать объект модели ИИ
    -   в настоящее время поддерживает
    -   контроллер прерывания уничтожения
    -   подробности
    -   информация об ошибке DOMException
    -   информация об ошибке
    -   получить результат потоковой передачи AI-модели
    -   получить агрегированный результат AI-модели
    -   получить раздел доступности языков
    -   измерить использование входных данных AI-модели
    -   минимальная доступность
    -   имя
    -   информация об ошибке превышения квоты
    -   поддержка
    -   валидировать и привести языковые теги к канонической форме

## Ссылки[](#references)

### Нормативные ссылки[](#normative)

[DOM]

Anne van Kesteren. [DOM Standard](https://dom.spec.whatwg.org/). Living Standard. URL: [https://dom.spec.whatwg.org/](https://dom.spec.whatwg.org/)

[ECMA-402]

[ECMAScript Internationalization API Specification](https://tc39.es/ecma402/). URL: [https://tc39.es/ecma402/](https://tc39.es/ecma402/)

[ECMASCRIPT]

[ECMAScript Language Specification](https://tc39.es/ecma262/multipage/). URL: [https://tc39.es/ecma262/multipage/](https://tc39.es/ecma262/multipage/)

[FileAPI]

Marijn Kruisselbrink. [File API](https://w3c.github.io/FileAPI/). URL: [https://w3c.github.io/FileAPI/](https://w3c.github.io/FileAPI/)

[HTML]

Anne van Kesteren; и др. [HTML Standard](https://html.spec.whatwg.org/multipage/). Living Standard. URL: [https://html.spec.whatwg.org/multipage/](https://html.spec.whatwg.org/multipage/)

\[INFRA\]

Anne van Kesteren; Domenic Denicola. [Infra Standard](https://infra.spec.whatwg.org/). Living Standard. URL: [https://infra.spec.whatwg.org/](https://infra.spec.whatwg.org/)

\[PERMISSIONS-POLICY-1\]

Ian Clelland. [Permissions Policy](https://w3c.github.io/webappsec-permissions-policy/). URL: [https://w3c.github.io/webappsec-permissions-policy/](https://w3c.github.io/webappsec-permissions-policy/)

\[STREAMS\]

Adam Rice; и др. [Streams Standard](https://streams.spec.whatwg.org/). Living Standard. URL: [https://streams.spec.whatwg.org/](https://streams.spec.whatwg.org/)

\[WEBAUDIO-1.0\]

Paul Adenot; Hongchan Choi. [Web Audio API](https://webaudio.github.io/web-audio-api/). URL: [https://webaudio.github.io/web-audio-api/](https://webaudio.github.io/web-audio-api/)

\[WEBIDL\]

Эдгар Чен; Тимоти Гу. [Web IDL Standard](https://webidl.spec.whatwg.org/). Живой стандарт. URL: [https://webidl.spec.whatwg.org/](https://webidl.spec.whatwg.org/)

\[WRITING-ASSISTANCE-APIS\]

[Writing Assistance APIs](https://webmachinelearning.github.io/writing-assistance-apis/). Чертёж сообщества. URL: [https://webmachinelearning.github.io/writing-assistance-apis/](https://webmachinelearning.github.io/writing-assistance-apis/)

### Ненормативные ссылки[](#informative)

\[BCP47\]

А. Филлипс, ред.; М. Дэвис, ред.. [Теги для идентификации языков](https://www.rfc-editor.org/info/rfc5646/). Сентябрь 2009. Лучшая текущая практика. URL: [https://www.rfc-editor.org/info/rfc5646/](https://www.rfc-editor.org/info/rfc5646/)

\[UTS35\]

Марк Дэвис; и др. [Unicode Locale Data Markup Language (LDML)](https://www.unicode.org/reports/tr35/tr35-61/tr35.html). 23 октября 2020. Unicode Technical Standard #35. URL: [https://www.unicode.org/reports/tr35/tr35-61/tr35.html](https://www.unicode.org/reports/tr35/tr35-61/tr35.html)

## IDL Index[](#idl-index)

```webidl
[Exposed=Window, SecureContext]
interface LanguageModel : EventTarget {
  static Promise<LanguageModel> create(optional LanguageModelCreateOptions options = {});
  static Promise<Availability> availability(optional LanguageModelCreateCoreOptions options = {});
  // **EXPERIMENTAL**: Only available in extension and experimental contexts.
  static Promise<LanguageModelParams?> params();

  // These will throw "NotSupportedError" DOMExceptions if role = "system"
  Promise<DOMString> prompt(
    LanguageModelPrompt input,
    optional LanguageModelPromptOptions options = {}
  );
  ReadableStream promptStreaming(
    LanguageModelPrompt input,
    optional LanguageModelPromptOptions options = {}
  );
  Promise<undefined> append(
    LanguageModelPrompt input,
    optional LanguageModelAppendOptions options = {}
  );

  Promise<double> measureContextUsage(
    LanguageModelPrompt input,
    optional LanguageModelPromptOptions options = {}
  );
  readonly attribute double contextUsage;
  readonly attribute unrestricted double contextWindow;
  attribute EventHandler oncontextoverflow;

  // **DEPRECATED**: This method is only available in extension contexts.
  Promise<double> measureInputUsage(
    LanguageModelPrompt input,
    optional LanguageModelPromptOptions options = {}
  );
  // **DEPRECATED**: This attribute is only available in extension contexts.
  readonly attribute double inputUsage;
  // **DEPRECATED**: This attribute is only available in extension contexts.
  readonly attribute unrestricted double inputQuota;
  // **DEPRECATED**: This attribute is only available in extension contexts.
  attribute EventHandler onquotaoverflow;

  // **DEPRECATED**: This attribute is only available in extension contexts.
  readonly attribute unsigned long topK;
  // **DEPRECATED**: This attribute is only available in extension contexts.
  readonly attribute float temperature;

  // **EXPERIMENTAL**: Only available in experimental contexts.
  readonly attribute LanguageModelSamplingMode samplingMode;

  Promise<LanguageModel> clone(optional LanguageModelCloneOptions options = {});
};
LanguageModel includes DestroyableModel;

// **DEPRECATED**: Only available in extension contexts.
[Exposed=Window, SecureContext]
interface LanguageModelParams {
  readonly attribute unsigned long defaultTopK;
  readonly attribute unsigned long maxTopK;
  readonly attribute float defaultTemperature;
  readonly attribute float maxTemperature;
};

callback LanguageModelToolFunction = Promise<DOMString> (any... arguments);

// A description of a tool call that a language model can invoke.
dictionary LanguageModelTool {
  required DOMString name;
  required DOMString description;
  // JSON schema for the input parameters.
  required object inputSchema;
  // The function to be invoked by user agent on behalf of language model.
  required LanguageModelToolFunction execute;
};

dictionary LanguageModelCreateCoreOptions {
  // Note: these two have custom out-of-range handling behavior, not in the IDL layer.
  // They are unrestricted double so as to allow +Infinity without failing.
  // **DEPRECATED**: Only available in extension contexts.
  unrestricted double topK;
  // **DEPRECATED**: Only available in extension contexts.
  unrestricted double temperature;

  // **EXPERIMENTAL**: Only available in experimental contexts.
  LanguageModelSamplingMode samplingMode;

  // The expected types and languages for the session.
  sequence<LanguageModelExpected> expectedInputs;
  sequence<LanguageModelExpected> expectedOutputs;

  // Tools that the language model can use.
  // **EXPERIMENTAL**: Only available in experimental contexts.
  sequence<LanguageModelTool> tools;
};

dictionary LanguageModelCreateOptions : LanguageModelCreateCoreOptions {
  AbortSignal signal;
  CreateMonitorCallback monitor;

  sequence<LanguageModelMessage> initialPrompts;
};

dictionary LanguageModelPromptOptions {
  object responseConstraint;
  boolean omitResponseConstraintInput = false;
  AbortSignal signal;
};

dictionary LanguageModelAppendOptions {
  AbortSignal signal;
};

dictionary LanguageModelCloneOptions {
  AbortSignal signal;
};

dictionary LanguageModelExpected {
  required LanguageModelMessageType type;
  sequence<DOMString> languages;
};

// The argument to the prompt() method and others like it

typedef (
  sequence<LanguageModelMessage>
  // Shorthand for `[{ role: "user", content: [{ type: "text", value: providedValue }] }]`
  or DOMString
) LanguageModelPrompt;

dictionary LanguageModelMessage {
  required LanguageModelMessageRole role;

  // The DOMString branch is shorthand for `[{ type: "text", value: providedValue }]`
  required (DOMString or sequence<LanguageModelMessageContent>) content;

  boolean prefix = false;
};

dictionary LanguageModelMessageContent {
  required LanguageModelMessageType type;
  required LanguageModelMessageValue value;
};

enum LanguageModelSamplingMode { "most-predictable", "predictable", "slightly-predictable", "balanced", "slightly-creative", "creative", "most-creative" };

enum LanguageModelMessageRole { "system", "user", "assistant" };

enum LanguageModelMessageType { "text", "image", "audio", "tool-call", "tool-response" };

typedef (
  ImageBitmapSource
  or AudioBuffer
  or BufferSource
  or DOMString
) LanguageModelMessageValue;
```