[![Logo](https://webmachinelearning.github.io/webmachinelearning-logo.png)](https://webmachinelearning.github.io/)

# Prompt API

[Draft Community Group Report](https://www.w3.org/standards/types/#CG-DRAFT), 11 August 2026

More details about this document

This version:

[https://webmachinelearning.github.io/prompt-api](https://webmachinelearning.github.io/prompt-api)

Issue Tracking:

[GitHub](https://github.com/webmachinelearning/prompt-api/issues/)

Editor:

[Reilly Grant](mailto:reillyg@google.com) ([Google](https://www.google.com))

Former Editor:

[Domenic Denicola](https://domenic.me/) ([Google](https://www.google.com/)) [d@domenic.me](mailto:d@domenic.me)

[Copyright](https://www.w3.org/policies/#copyright) © 2026 the Contributors to the Prompt API Specification, published by the [Web Machine Learning Community Group](https://www.w3.org/community/webmachinelearning/) under the [W3C Community Contributor License Agreement (CLA)](https://www.w3.org/community/about/agreements/cla/). A human-readable [summary](http://www.w3.org/community/about/agreements/cla-deed/) is available.

* * *

## Abstract

The prompt API gives web pages the ability to directly prompt a language model

## Status of this document

This specification was published by the [Web Machine Learning Community Group](https://www.w3.org/community/webmachinelearning/). It is not a W3C Standard nor is it on the W3C Standards Track. Please note that under the [W3C Community Contributor License Agreement (CLA)](https://www.w3.org/community/about/agreements/cla/) there is a limited opt-out and other conditions apply. Learn more about [W3C Community and Business Groups](http://www.w3.org/community/).

## 1\. Introduction[](#intro)

The Prompt API gives web pages the ability to directly prompt a browser-provided language model. It provides a uniform JavaScript API that abstracts away specific details of the underlying model (such as templating or tokenization). By leveraging built-in language models, it offers benefits such as local processing of sensitive data, offline usage, model sharing, and reduced cost compared to cloud-based or bring-your-own-model approaches.

## 2\. Dependencies[](#dependencies)

This specification depends on the Infra Standard. [\[INFRA\]](#biblio-infra "Infra Standard")

As with the rest of the web platform, human languages are identified in these APIs by BCP 47 language tags, such as "`ja`", "`en-US`", "`sr-Cyrl`", or "`de-CH-1901-x-phonebk-extended`". The specific algorithms used for validation, canonicalization, and language tag matching are those from the ECMAScript Internationalization API Specification, which in turn defers some of its processing to Unicode Locale Data Markup Language (LDML). [\[BCP47\]](#biblio-bcp47 "Tags for Identifying Languages") [\[ECMA-402\]](#biblio-ecma-402 "ECMAScript Internationalization API Specification") [\[UTS35\]](#biblio-uts35 "Unicode Locale Data Markup Language (LDML)").

These APIs are part of a family of APIs expected to be powered by machine learning models, which share common API surface idioms and specification patterns. Currently, the specification text for these shared parts lives in [Writing Assistance APIs § 5 Shared infrastructure](https://webmachinelearning.github.io/writing-assistance-apis/#supporting), and the common privacy and security considerations are discussed in [Writing Assistance APIs § 6 Privacy considerations](https://webmachinelearning.github.io/writing-assistance-apis/#privacy) and [Writing Assistance APIs § 7 Security considerations](https://webmachinelearning.github.io/writing-assistance-apis/#security). Implementing these APIs requires implementing that shared infrastructure, and conforming to those privacy and security considerations. But it does not require implementing or exposing the actual writing assistance APIs. [\[WRITING-ASSISTANCE-APIS\]](#biblio-writing-assistance-apis "Writing Assistance APIs")

## 3\. The API[](#api)

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

### 3.1. Creation[](#language-model-creation)

The static **`create(options)`** method steps are:

1.  Return the result of [creating an AI model object](https://webmachinelearning.github.io/writing-assistance-apis/#create-an-ai-model-object) given options, "`[language-model](#permissiondef-language-model)`", [validate and canonicalize language model options](#validate-and-canonicalize-language-model-options), [compute language model options availability](#compute-language-model-options-availability), [download the language model](#download-the-language-model), [initialize the language model](#initialize-the-language-model), [create a language model object](#create-a-language-model-object), and false.
    

To **validate and canonicalize language model options** given a `[LanguageModelCreateCoreOptions](#dictdef-languagemodelcreatecoreoptions)` options, perform the following steps. They mutate options in place to canonicalize and deduplicate language tags, and throw an exception if any are invalid.

1.  If options\["`[expectedInputs](#dom-languagemodelcreatecoreoptions-expectedinputs)`"\] [exists](https://infra.spec.whatwg.org/#map-exists), then [for each](https://infra.spec.whatwg.org/#list-iterate) expected of options\["`[expectedInputs](#dom-languagemodelcreatecoreoptions-expectedinputs)`"\]:
    
    1.  If expected\["`[languages](#dom-languagemodelexpected-languages)`"\] [exists](https://infra.spec.whatwg.org/#map-exists), then [Validate and canonicalize language tags](https://webmachinelearning.github.io/writing-assistance-apis/#validate-and-canonicalize-language-tags) given expected and "`[languages](#dom-languagemodelexpected-languages)`".
        
2.  If options\["`[expectedOutputs](#dom-languagemodelcreatecoreoptions-expectedoutputs)`"\] [exists](https://infra.spec.whatwg.org/#map-exists), then [for each](https://infra.spec.whatwg.org/#list-iterate) expected of options\["`[expectedOutputs](#dom-languagemodelcreatecoreoptions-expectedoutputs)`"\]:
    
    1.  If expected\["`[languages](#dom-languagemodelexpected-languages)`"\] [exists](https://infra.spec.whatwg.org/#map-exists), then [Validate and canonicalize language tags](https://webmachinelearning.github.io/writing-assistance-apis/#validate-and-canonicalize-language-tags) given expected and "`[languages](#dom-languagemodelexpected-languages)`".
        
3.  If options\["`[initialPrompts](#dom-languagemodelcreateoptions-initialprompts)`"\] [exists](https://infra.spec.whatwg.org/#map-exists), then:
    
    1.  Let expectedInputs be options\["`[expectedInputs](#dom-languagemodelcreatecoreoptions-expectedinputs)`"\] if it [exists](https://infra.spec.whatwg.org/#map-exists); otherwise an empty [list](https://infra.spec.whatwg.org/#list).
        
    2.  Let expectedInputTypes be the result of [get the expected content types](#get-the-expected-content-types) given expectedInputs.
        
    3.  Perform [validating and canonicalizing a prompt](#validate-and-canonicalize-a-prompt) given options\["`[initialPrompts](#dom-languagemodelcreateoptions-initialprompts)`"\], expectedInputTypes, and false.
        

To **download the language model**, given a `[LanguageModelCreateCoreOptions](#dictdef-languagemodelcreatecoreoptions)` options:

1.  [Assert](https://infra.spec.whatwg.org/#assert): these steps are running [in parallel](https://html.spec.whatwg.org/multipage/infrastructure.html#in-parallel).
    
2.  Initiate the download process for everything the user agent needs to prompt a language model according to options. This could include a base AI model, fine-tunings for specific languages or option values, or other resources.
    
3.  If the download process cannot be started for any reason, then return false.
    
4.  Return true.
    

To **initialize the language model**, given a `[LanguageModelCreateOptions](#dictdef-languagemodelcreateoptions)` options:

1.  [Assert](https://infra.spec.whatwg.org/#assert): these steps are running [in parallel](https://html.spec.whatwg.org/multipage/infrastructure.html#in-parallel).
    
2.  Let availability be the result of [compute language model options availability](#compute-language-model-options-availability) given options.
    
    1.  If availability is null or `[unavailable](https://webmachinelearning.github.io/writing-assistance-apis/#dom-availability-unavailable)`, then return a [DOMException error information](https://webmachinelearning.github.io/writing-assistance-apis/#domexception-error-information) whose [name](https://webmachinelearning.github.io/writing-assistance-apis/#domexception-error-information-name) is "`[NotSupportedError](https://webidl.spec.whatwg.org/#notsupportederror)`" and whose [details](https://webmachinelearning.github.io/writing-assistance-apis/#domexception-error-information-details) contain appropriate detail.
        
3.  Perform any necessary initialization operations for the AI model backing the user agent’s prompting capabilities.
    
    This could include loading the appropriate model and any fine-tunings necessary to support options into memory.
    
    1.  If options\["`[initialPrompts](#dom-languagemodelcreateoptions-initialprompts)`"\] [exists](https://infra.spec.whatwg.org/#map-exists), then:
        
        1.  Let expectedInputs be options\["`[expectedInputs](#dom-languagemodelcreatecoreoptions-expectedinputs)`"\] if it [exists](https://infra.spec.whatwg.org/#map-exists); otherwise an empty [list](https://infra.spec.whatwg.org/#list).
            
        2.  Let expectedInputTypes be the result of [get the expected content types](#get-the-expected-content-types) given expectedInputs.
            
        3.  Let initialMessages be the result of [validating and canonicalizing a prompt](#validate-and-canonicalize-a-prompt) given options\["`[initialPrompts](#dom-languagemodelcreateoptions-initialprompts)`"\], expectedInputTypes, and false.
            
        4.  Load initialMessages into the model’s context window.
            
    2.  If options\["`[tools](#dom-languagemodelcreatecoreoptions-tools)`"\] [exists](https://infra.spec.whatwg.org/#map-exists), then load options\["`[tools](#dom-languagemodelcreatecoreoptions-tools)`"\] into the model’s context window.
        
4.  If initialization failed because the process of loading options resulted in using up all of the model’s context window, then:
    
    1.  Let requested be the amount of context window needed to encode options. The encoding of options as input is [implementation-defined](https://infra.spec.whatwg.org/#implementation-defined).
        
    2.  Let maximum be the maximum context window size that the user agent supports.
        
    3.  [Assert](https://infra.spec.whatwg.org/#assert): requested is greater than maximum. (That is how we reached this error branch.)
        
    4.  Return a [quota exceeded error information](https://webmachinelearning.github.io/writing-assistance-apis/#quota-exceeded-error-information) whose [requested](https://webidl.spec.whatwg.org/#quotaexceedederror-requested) is requested and [quota](https://webidl.spec.whatwg.org/#quotaexceedederror-quota) is maximum.
        
5.  If initialization failed for any other reason, then return a [DOMException error information](https://webmachinelearning.github.io/writing-assistance-apis/#domexception-error-information) whose [name](https://webmachinelearning.github.io/writing-assistance-apis/#domexception-error-information-name) is "`[OperationError](https://webidl.spec.whatwg.org/#operationerror)`" and whose [details](https://webmachinelearning.github.io/writing-assistance-apis/#domexception-error-information-details) contain appropriate detail.
    
6.  Return null.
    

To **create a language model object**, given a [realm](https://tc39.es/ecma262/multipage/executable-code-and-execution-contexts.html#realm) realm and a `[LanguageModelCreateOptions](#dictdef-languagemodelcreateoptions)` options:

1.  [Assert](https://infra.spec.whatwg.org/#assert): these steps are running on realm’s [surrounding agent](https://tc39.es/ecma262/multipage/executable-code-and-execution-contexts.html#surrounding-agent)’s [event loop](https://html.spec.whatwg.org/multipage/webappapis.html#concept-agent-event-loop).
    
2.  Let contextWindowSize be the amount of context window that is available to the user agent for this model. (This value is [implementation-defined](https://infra.spec.whatwg.org/#implementation-defined), and may be +∞ if there are no specific limits beyond, e.g., the user’s memory, or the limits of JavaScript strings.)
    
3.  Let initialMessages be an empty [list](https://infra.spec.whatwg.org/#list) of `[LanguageModelMessage](#dictdef-languagemodelmessage)`s.
    
4.  Let initialMessagesUsage be 0.
    
5.  If options\["`[initialPrompts](#dom-languagemodelcreateoptions-initialprompts)`"\] [exists](https://infra.spec.whatwg.org/#map-exists), then:
    
    1.  Let expectedInputs be options\["`[expectedInputs](#dom-languagemodelcreatecoreoptions-expectedinputs)`"\] if it [exists](https://infra.spec.whatwg.org/#map-exists); otherwise an empty [list](https://infra.spec.whatwg.org/#list).
        
    2.  Let expectedInputTypes be the result of [get the expected content types](#get-the-expected-content-types) given expectedInputs.
        
    3.  Set initialMessages to the result of [validating and canonicalizing a prompt](#validate-and-canonicalize-a-prompt) given options\["`[initialPrompts](#dom-languagemodelcreateoptions-initialprompts)`"\], expectedInputTypes, and false.
        
    4.  Set initialMessagesUsage to the result of [measure language model context usage](#measure-language-model-context-usage) given initialMessages, and options\["`[signal](#dom-languagemodelcreateoptions-signal)`"\].
        
6.  Return a new `[LanguageModel](#languagemodel)` object, created in realm, with
    
    [initial messages](#languagemodel-initial-messages)
    
    initialMessages
    
    [top K](#languagemodel-top-k)
    
    options\["`[topK](#dom-languagemodelcreatecoreoptions-topk)`"\] if it [exists](https://infra.spec.whatwg.org/#map-exists); otherwise an [implementation-defined](https://infra.spec.whatwg.org/#implementation-defined) value
    
    [temperature](#languagemodel-temperature)
    
    options\["`[temperature](#dom-languagemodelcreatecoreoptions-temperature)`"\] if it [exists](https://infra.spec.whatwg.org/#map-exists); otherwise an [implementation-defined](https://infra.spec.whatwg.org/#implementation-defined) value
    
    [expected inputs](#languagemodel-expected-inputs)
    
    options\["`[expectedInputs](#dom-languagemodelcreatecoreoptions-expectedinputs)`"\] if it [exists](https://infra.spec.whatwg.org/#map-exists); otherwise an empty [list](https://infra.spec.whatwg.org/#list)
    
    [expected outputs](#languagemodel-expected-outputs)
    
    options\["`[expectedOutputs](#dom-languagemodelcreatecoreoptions-expectedoutputs)`"\] if it [exists](https://infra.spec.whatwg.org/#map-exists); otherwise an empty [list](https://infra.spec.whatwg.org/#list)
    
    [tools](#languagemodel-tools)
    
    options\["`[tools](#dom-languagemodelcreatecoreoptions-tools)`"\] if it [exists](https://infra.spec.whatwg.org/#map-exists); otherwise an empty [list](https://infra.spec.whatwg.org/#list)
    
    [context window size](#languagemodel-context-window-size)
    
    contextWindowSize
    
    [current context usage](#languagemodel-current-context-usage)
    
    initialMessagesUsage
    

### 3.2. Availability[](#language-model-availability)

The static **`availability(options)`** method steps are:

1.  Return the result of [computing AI model availability](https://webmachinelearning.github.io/writing-assistance-apis/#compute-ai-model-availability) given options, "`[language-model](#permissiondef-language-model)`", [validate and canonicalize language model options](#validate-and-canonicalize-language-model-options), and [compute language model options availability](#compute-language-model-options-availability).
    

To **compute language model options availability** given a `[LanguageModelCreateCoreOptions](#dictdef-languagemodelcreatecoreoptions)` options, perform the following steps. They return either an `[Availability](https://webmachinelearning.github.io/writing-assistance-apis/#enumdef-availability)` value or null, and they mutate options in place to update language tags to their best-fit matches.

1.  [Assert](https://infra.spec.whatwg.org/#assert): this algorithm is running [in parallel](https://html.spec.whatwg.org/multipage/infrastructure.html#in-parallel).
    
2.  Let availability be the [language model non-options availability](#language-model-non-options-availability).
    
3.  If availability is null, then return null.
    
4.  Let availabilities be a [list](https://infra.spec.whatwg.org/#list) containing availability.
    
5.  Let inputPartition be the result of [getting the language availabilities partition](https://webmachinelearning.github.io/writing-assistance-apis/#get-the-language-availabilities-partition) given the purpose of prompting a language model with text in that language.
    
6.  Let outputPartition be the result of [getting the language availabilities partition](https://webmachinelearning.github.io/writing-assistance-apis/#get-the-language-availabilities-partition) given the purpose of producing language model output in that language.
    
7.  If options\["`[expectedInputs](#dom-languagemodelcreatecoreoptions-expectedinputs)`"\] [exists](https://infra.spec.whatwg.org/#map-exists), then [for each](https://infra.spec.whatwg.org/#list-iterate) expected of options\["`[expectedInputs](#dom-languagemodelcreatecoreoptions-expectedinputs)`"\]:
    
    1.  If expected\["`[languages](#dom-languagemodelexpected-languages)`"\] [exists](https://infra.spec.whatwg.org/#map-exists), then:
        
        1.  Let inputLanguageAvailability be the result of [computing language availability](https://webmachinelearning.github.io/writing-assistance-apis/#compute-language-availability) given expected\["`[languages](#dom-languagemodelexpected-languages)`"\] and inputPartition.
            
        2.  [Append](https://infra.spec.whatwg.org/#list-append) inputLanguageAvailability to availabilities.
            
    2.  Let inputTypeAvailability be the [language model content type availability](#language-model-content-type-availability) given expected\["`[type](#dom-languagemodelexpected-type)`"\] and true.
        
    3.  [Append](https://infra.spec.whatwg.org/#list-append) inputTypeAvailability to availabilities.
        
8.  If options\["`[expectedOutputs](#dom-languagemodelcreatecoreoptions-expectedoutputs)`"\] [exists](https://infra.spec.whatwg.org/#map-exists), then [for each](https://infra.spec.whatwg.org/#list-iterate) expected of options\["`[expectedOutputs](#dom-languagemodelcreatecoreoptions-expectedoutputs)`"\]:
    
    1.  If expected\["`[languages](#dom-languagemodelexpected-languages)`"\] [exists](https://infra.spec.whatwg.org/#map-exists), then:
        
        1.  Let outputLanguageAvailability be the result of [computing language availability](https://webmachinelearning.github.io/writing-assistance-apis/#compute-language-availability) given expected\["`[languages](#dom-languagemodelexpected-languages)`"\] and outputPartition.
            
        2.  [Append](https://infra.spec.whatwg.org/#list-append) outputLanguageAvailability to availabilities.
            
    2.  Let outputTypeAvailability be the [language model content type availability](#language-model-content-type-availability) given expected\["`[type](#dom-languagemodelexpected-type)`"\] and false.
        
    3.  [Append](https://infra.spec.whatwg.org/#list-append) outputTypeAvailability to availabilities.
        
9.  Return the [minimum availability](https://webmachinelearning.github.io/writing-assistance-apis/#availability-minimum-availability) given availabilities.
    

The **language model non-options availability** is given by the following steps. They return an `[Availability](https://webmachinelearning.github.io/writing-assistance-apis/#enumdef-availability)` value or null.

1.  [Assert](https://infra.spec.whatwg.org/#assert): this algorithm is running [in parallel](https://html.spec.whatwg.org/multipage/infrastructure.html#in-parallel).
    
2.  If there is some error attempting to determine whether the user agent [can support](https://webmachinelearning.github.io/writing-assistance-apis/#model-availability-currently-supports) prompting a language model, which the user agent believes to be transient (such that re-querying could stop producing such an error), then return null.
    
3.  If the user agent [currently supports](https://webmachinelearning.github.io/writing-assistance-apis/#model-availability-currently-supports) prompting a language model, then return "`[available](https://webmachinelearning.github.io/writing-assistance-apis/#dom-availability-available)`".
    
4.  If the user agent believes it will be able to [support](https://webmachinelearning.github.io/writing-assistance-apis/#model-availability-currently-supports) prompting a language model, but only after finishing a download that is already ongoing, then return "`[downloading](https://webmachinelearning.github.io/writing-assistance-apis/#dom-availability-downloading)`".
    
5.  If the user agent believes it will be able to [support](https://webmachinelearning.github.io/writing-assistance-apis/#model-availability-currently-supports) prompting a language model, but only after performing a not-currently-ongoing download, then return "`[downloadable](https://webmachinelearning.github.io/writing-assistance-apis/#dom-availability-downloadable)`".
    
6.  Otherwise, return "`[unavailable](https://webmachinelearning.github.io/writing-assistance-apis/#dom-availability-unavailable)`".
    

The **language model content type availability** given a `[LanguageModelMessageType](#enumdef-languagemodelmessagetype)` type and a boolean isInput, is given by the following steps. They return an `[Availability](https://webmachinelearning.github.io/writing-assistance-apis/#enumdef-availability)` value.

1.  [Assert](https://infra.spec.whatwg.org/#assert): this algorithm is running [in parallel](https://html.spec.whatwg.org/multipage/infrastructure.html#in-parallel).
    
2.  If the user agent [currently supports](https://webmachinelearning.github.io/writing-assistance-apis/#model-availability-currently-supports) type as an input if isInput is true, or as an output if isInput is false, then return "`[available](https://webmachinelearning.github.io/writing-assistance-apis/#dom-availability-available)`".
    
3.  If the user agent believes it will be able to [support](https://webmachinelearning.github.io/writing-assistance-apis/#model-availability-currently-supports) type as such, but only after finishing a download that is already ongoing, then return "`[downloading](https://webmachinelearning.github.io/writing-assistance-apis/#dom-availability-downloading)`".
    
4.  If the user agent believes it will be able to [support](https://webmachinelearning.github.io/writing-assistance-apis/#model-availability-currently-supports) type as such, but only after performing a not-currently-ongoing download, then return "`[downloadable](https://webmachinelearning.github.io/writing-assistance-apis/#dom-availability-downloadable)`".
    
5.  Otherwise, return "`[unavailable](https://webmachinelearning.github.io/writing-assistance-apis/#dom-availability-unavailable)`".
    

### 3.3. The `[LanguageModel](#languagemodel)` class[](#the-languagemodel-class)

Every `[LanguageModel](#languagemodel)` has an **initial messages**, a [list](https://infra.spec.whatwg.org/#list) of `[LanguageModelMessage](#dictdef-languagemodelmessage)`s, set during creation.

Every `[LanguageModel](#languagemodel)` has a **top K**, an unsigned long, set during creation.

Every `[LanguageModel](#languagemodel)` has a **temperature**, a float, set during creation.

Every `[LanguageModel](#languagemodel)` has an **expected inputs**, a [list](https://infra.spec.whatwg.org/#list) of `[LanguageModelExpected](#dictdef-languagemodelexpected)`s, set during creation.

Every `[LanguageModel](#languagemodel)` has an **expected outputs**, a [list](https://infra.spec.whatwg.org/#list) of `[LanguageModelExpected](#dictdef-languagemodelexpected)`s, set during creation.

Every `[LanguageModel](#languagemodel)` has a **tools**, a [list](https://infra.spec.whatwg.org/#list) of `[LanguageModelTool](#dictdef-languagemodeltool)`s, set during creation.

Every `[LanguageModel](#languagemodel)` has a **context window size**, an unrestricted double, set during creation.

Every `[LanguageModel](#languagemodel)` has a **current context usage**, a double, initially 0.

* * *

The **`contextUsage`** getter steps are to return [this](https://webidl.spec.whatwg.org/#this)’s [current context usage](#languagemodel-current-context-usage).

The **`inputUsage`** getter steps are to return [this](https://webidl.spec.whatwg.org/#this)’s [current context usage](#languagemodel-current-context-usage).

The **`contextWindow`** getter steps are to return [this](https://webidl.spec.whatwg.org/#this)’s [context window size](#languagemodel-context-window-size).

The **`inputQuota`** getter steps are to return [this](https://webidl.spec.whatwg.org/#this)’s [context window size](#languagemodel-context-window-size).

The **`topK`** getter steps are to return [this](https://webidl.spec.whatwg.org/#this)’s [top K](#languagemodel-top-k).

The **`temperature`** getter steps are to return [this](https://webidl.spec.whatwg.org/#this)’s [temperature](#languagemodel-temperature).

* * *

The following are the [event handlers](https://html.spec.whatwg.org/multipage/webappapis.html#event-handlers) (and their corresponding [event handler event types](https://html.spec.whatwg.org/multipage/webappapis.html#event-handler-event-type)) that must be supported, as [event handler IDL attributes](https://html.spec.whatwg.org/multipage/webappapis.html#event-handler-idl-attributes), by all `[LanguageModel](#languagemodel)` objects:

| [Event handler](https://html.spec.whatwg.org/multipage/webappapis.html#event-handlers) | [Event handler event type](https://html.spec.whatwg.org/multipage/webappapis.html#event-handler-event-type) |
| --- | --- |
| **`oncontextoverflow`** | **`contextoverflow`** |
| **`onquotaoverflow`** | **`quotaoverflow`** |

* * *

The **`prompt(input, options)`** method steps are:

1.  Let responseConstraint be options\["`[responseConstraint](#dom-languagemodelpromptoptions-responseconstraint)`"\] if it [exists](https://infra.spec.whatwg.org/#map-exists); otherwise null.
    
2.  Let omitResponseConstraintInput be options\["`[omitResponseConstraintInput](#dom-languagemodelpromptoptions-omitresponseconstraintinput)`"\].
    
3.  Let operation be an algorithm step which takes arguments chunkProduced, done, error, and stopProducing, and performs the following steps:
    
    1.  Let prefillSuccess be the result of [prefilling](#prefill) given [this](https://webidl.spec.whatwg.org/#this), input, omitResponseConstraintInput, responseConstraint, error, and stopProducing.
        
    2.  If prefillSuccess is true, then [generate](#generate) given [this](https://webidl.spec.whatwg.org/#this), responseConstraint, chunkProduced, done, error, and stopProducing.
        
4.  Return the result of [getting an aggregated AI model result](https://webmachinelearning.github.io/writing-assistance-apis/#get-an-aggregated-ai-model-result) given [this](https://webidl.spec.whatwg.org/#this), options, and operation.
    

The **`promptStreaming(input, options)`** method steps are:

1.  Let responseConstraint be options\["`[responseConstraint](#dom-languagemodelpromptoptions-responseconstraint)`"\] if it [exists](https://infra.spec.whatwg.org/#map-exists); otherwise null.
    
2.  Let omitResponseConstraintInput be options\["`[omitResponseConstraintInput](#dom-languagemodelpromptoptions-omitresponseconstraintinput)`"\].
    
3.  Let operation be an algorithm step which takes arguments chunkProduced, done, error, and stopProducing, and performs the following steps:
    
    1.  Let prefillSuccess be the result of [prefilling](#prefill) given [this](https://webidl.spec.whatwg.org/#this), input, omitResponseConstraintInput, responseConstraint, error, and stopProducing.
        
    2.  If prefillSuccess is true, then [generate](#generate) given [this](https://webidl.spec.whatwg.org/#this), responseConstraint, chunkProduced, done, error, and stopProducing.
        
4.  Return the result of [getting a streaming AI model result](https://webmachinelearning.github.io/writing-assistance-apis/#get-a-streaming-ai-model-result) given [this](https://webidl.spec.whatwg.org/#this), options, and operation.
    

The **`append(input, options)`** method steps are:

1.  Let operation be an algorithm step which takes arguments chunkProduced, done, error, and stopProducing, and performs the following steps:
    
    chunkProduced is never called because the [prefilling](#prefill) algorithm does not generate chunks.
    
    1.  Let prefillSuccess be the result of [prefilling](#prefill) given [this](https://webidl.spec.whatwg.org/#this), input, false, null, error, and stopProducing.
        
    2.  If prefillSuccess is true and done is not null, then perform done.
        
2.  Return the result of [getting an aggregated AI model result](https://webmachinelearning.github.io/writing-assistance-apis/#get-an-aggregated-ai-model-result) given [this](https://webidl.spec.whatwg.org/#this), options, and operation.
    

The **`measureContextUsage(input, options)`** method steps are:

1.  If options\["`[omitResponseConstraintInput](#dom-languagemodelpromptoptions-omitresponseconstraintinput)`"\] is true and options\["`[responseConstraint](#dom-languagemodelpromptoptions-responseconstraint)`"\] does not [exist](https://infra.spec.whatwg.org/#map-exists), then throw a "`[TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror)`" `[DOMException](https://webidl.spec.whatwg.org/#idl-DOMException)`.
    
2.  Let expectedInputTypes be the result of [get the expected content types](#get-the-expected-content-types) given [this](https://webidl.spec.whatwg.org/#this)’s [expected inputs](#languagemodel-expected-inputs).
    
3.  Let messages be the result of [validating and canonicalizing a prompt](#validate-and-canonicalize-a-prompt) given input, expectedInputTypes, and false.
    
4.  If options\["`[responseConstraint](#dom-languagemodelpromptoptions-responseconstraint)`"\] [exists](https://infra.spec.whatwg.org/#map-exists) and is not null and options\["`[omitResponseConstraintInput](#dom-languagemodelpromptoptions-omitresponseconstraintinput)`"\] is false, then implementations may insert an [implementation-defined](https://infra.spec.whatwg.org/#implementation-defined) `[LanguageModelMessage](#dictdef-languagemodelmessage)` to messages to guide the model’s behavior.
    
5.  Let measureUsage be an algorithm step which takes argument stopMeasuring, and returns the result of [measuring language model context usage](#measure-language-model-context-usage) given messages, and stopMeasuring.
    
6.  Return the result of [measuring AI model input usage](https://webmachinelearning.github.io/writing-assistance-apis/#measure-ai-model-input-usage) given [this](https://webidl.spec.whatwg.org/#this), options, and measureUsage.
    

The **`measureInputUsage(input, options)`** method steps are:

1.  Return the result of running the `[measureContextUsage()](#dom-languagemodel-measurecontextusage)` method steps given input and options.
    

The **`clone(options)`** method steps are:

1.  Return the result of [cloning a language model](#clone-a-language-model) given [this](https://webidl.spec.whatwg.org/#this) and options.
    

#### 3.3.1. Prefilling and generating[](#language-model-prompting)

To **prefill** given:

-   a `[LanguageModel](#languagemodel)` model,
    
-   a `[LanguageModelPrompt](#typedefdef-languagemodelprompt)` input,
    
-   a boolean omitResponseConstraintInput,
    
-   an object-or-null responseConstraint,
    
-   an algorithm-or-null error that takes [error information](https://webmachinelearning.github.io/writing-assistance-apis/#error-information) and returns nothing, and
    
-   an algorithm-or-null stopPrefilling that takes no arguments and returns a boolean,
    

perform the following steps:

1.  [Assert](https://infra.spec.whatwg.org/#assert): this algorithm is running [in parallel](https://html.spec.whatwg.org/multipage/infrastructure.html#in-parallel).
    
2.  Let messages be the result of [validating and canonicalizing a prompt](#validate-and-canonicalize-a-prompt) given input, expectedInputTypes, and true if model’s [current context usage](#languagemodel-current-context-usage) is greater than 0, otherwise false.
    
    If this throws an exception e, then:
    
    1.  If error is not null, perform error given a [DOMException error information](https://webmachinelearning.github.io/writing-assistance-apis/#domexception-error-information) whose [name](https://webmachinelearning.github.io/writing-assistance-apis/#domexception-error-information-name) is e’s [name](https://webidl.spec.whatwg.org/#domexception-name) and whose [details](https://webmachinelearning.github.io/writing-assistance-apis/#domexception-error-information-details) contain appropriate detail.
        
    2.  Return false.
        
3.  If responseConstraint is not null and omitResponseConstraintInput is false, then implementations may insert an [implementation-defined](https://infra.spec.whatwg.org/#implementation-defined) `[LanguageModelMessage](#dictdef-languagemodelmessage)` to messages to guide the model’s behavior.
    
4.  Let requested be the result of [measuring language model context usage](#measure-language-model-context-usage) given messages, and stopPrefilling.
    
5.  If requested is null, then return false.
    
6.  If requested is an [error information](https://webmachinelearning.github.io/writing-assistance-apis/#error-information), then:
    
    1.  If error is not null, perform error given requested.
        
    2.  Return false.
        
7.  [Assert](https://infra.spec.whatwg.org/#assert): requested is a number.
    
8.  If model’s [current context usage](#languagemodel-current-context-usage) + requested is greater than model’s [context window size](#languagemodel-context-window-size), then:
    
    1.  If error is not null, then:
        
        1.  Let errorInfo be a [quota exceeded error information](https://webmachinelearning.github.io/writing-assistance-apis/#quota-exceeded-error-information) with a [requested](https://webidl.spec.whatwg.org/#quotaexceedederror-requested) of model’s [current context usage](#languagemodel-current-context-usage) + requested and a [quota](https://webidl.spec.whatwg.org/#quotaexceedederror-quota) of model’s [context window size](#languagemodel-context-window-size).
            
        2.  Perform error given errorInfo.
            
    2.  Return false.
        
9.  Let expectedInputTypes be the result of [get the expected content types](#get-the-expected-content-types) given model’s [expected inputs](#languagemodel-expected-inputs).
    
10.  In an [implementation-defined](https://infra.spec.whatwg.org/#implementation-defined) manner, update the underlying model’s internal state to include messages.
     
     The process should use model’s [initial messages](#languagemodel-initial-messages), model’s [top K](#languagemodel-top-k), model’s [temperature](#languagemodel-temperature), model’s [expected inputs](#languagemodel-expected-inputs), model’s [expected outputs](#languagemodel-expected-outputs), and model’s [tools](#languagemodel-tools) to guide how the state is updated.
     
     The process must conform to the guidance given in [§ 4 Privacy considerations](#privacy) and [§ 5 Security considerations](#security).
     
     If during this process stopPrefilling returns true, then return false.
     
     If an error occurred during prefilling:
     
     1.  Let the error be represented as [error information](https://webmachinelearning.github.io/writing-assistance-apis/#error-information) errorInfo according to the guidance in [§ 3.3.4 Errors](#language-model-errors).
         
     2.  If error is not null, perform error given errorInfo.
         
     3.  Return false.
         
11.  Set model’s [current context usage](#languagemodel-current-context-usage) to model’s [current context usage](#languagemodel-current-context-usage) + requested.
     
12.  Return true.
     

To **generate** given:

-   a `[LanguageModel](#languagemodel)` model,
    
-   an object-or-null responseConstraint,
    
-   an algorithm-or-null chunkProduced that takes a [string](https://infra.spec.whatwg.org/#string) and returns nothing,
    
-   an algorithm-or-null done that takes no arguments and returns nothing,
    
-   an algorithm-or-null error that takes [error information](https://webmachinelearning.github.io/writing-assistance-apis/#error-information) and returns nothing, and
    
-   an algorithm-or-null stopProducing that takes no arguments and returns a boolean,
    

perform the following steps:

1.  [Assert](https://infra.spec.whatwg.org/#assert): this algorithm is running [in parallel](https://html.spec.whatwg.org/multipage/infrastructure.html#in-parallel).
    
2.  In an [implementation-defined](https://infra.spec.whatwg.org/#implementation-defined) manner, subject to the following guidelines, begin the process of producing a response from the language model based on its current internal state.
    
    The process should use model’s [initial messages](#languagemodel-initial-messages), model’s [top K](#languagemodel-top-k), model’s [temperature](#languagemodel-temperature), model’s [expected inputs](#languagemodel-expected-inputs), model’s [expected outputs](#languagemodel-expected-outputs), model’s [tools](#languagemodel-tools), and responseConstraint to guide the model’s behavior.
    
    The prompting process must conform to the guidance given in [§ 4 Privacy considerations](#privacy) and [§ 5 Security considerations](#security).
    
    If model’s [tools](#languagemodel-tools) is not empty, the model may use the provided tools by calling their execute functions.
    
3.  While true:
    
    1.  Wait for the next chunk of response data to be produced, for the process to finish, or for the result of calling stopProducing to become true.
        
    2.  If such a chunk is successfully produced:
        
        1.  Let it be represented as a [string](https://infra.spec.whatwg.org/#string) chunk.
            
        2.  If chunkProduced is not null, perform chunkProduced given chunk.
            
    3.  Otherwise, if the process has finished:
        
        1.  If done is not null, perform done.
            
        2.  [Break](https://infra.spec.whatwg.org/#iteration-break).
            
    4.  Otherwise, if stopProducing returns true, then [break](https://infra.spec.whatwg.org/#iteration-break).
        
    5.  Otherwise, if an error occurred during prompting:
        
        1.  Let the error be represented as [error information](https://webmachinelearning.github.io/writing-assistance-apis/#error-information) errorInfo according to the guidance in [§ 3.3.4 Errors](#language-model-errors).
            
        2.  If error is not null, perform error given errorInfo.
            
        3.  [Break](https://infra.spec.whatwg.org/#iteration-break).
            

#### 3.3.2. Usage[](#language-model-usage)

To **measure language model context usage** given:

-   a [list](https://infra.spec.whatwg.org/#list) of `[LanguageModelMessage](#dictdef-languagemodelmessage)` messages,
    
-   an algorithm stopMeasuring that takes no arguments and returns a boolean,
    

perform the following steps:

1.  [Assert](https://infra.spec.whatwg.org/#assert): this algorithm is running [in parallel](https://html.spec.whatwg.org/multipage/infrastructure.html#in-parallel).
    
2.  Let inputToModel be the [implementation-defined](https://infra.spec.whatwg.org/#implementation-defined) input that would be sent to the underlying model in order to [prefill](#prefill) given messages.
    
    This will generally consist of the encoding of all of the inputs, possibly with prompt engineering or other implementation-defined wrappers.
    
    If during this process stopMeasuring starts returning true, then return null.
    
    If an error occurs during this process, then return an appropriate [DOMException error information](https://webmachinelearning.github.io/writing-assistance-apis/#domexception-error-information) according to the guidance in [§ 3.3.4 Errors](#language-model-errors).
    
3.  Return the amount of context usage needed to represent inputToModel when given to the underlying model. The exact calculation procedure is [implementation-defined](https://infra.spec.whatwg.org/#implementation-defined), subject to the following constraints.
    
    The returned context usage must be nonnegative and finite. It should be roughly proportional to the amount of data in inputToModel.
    
    This might be the number of tokens needed to represent the input in a [language model tokenization scheme](https://arxiv.org/abs/2404.08335), or it might be related to the size of the data in bytes.
    
    If during this process stopMeasuring starts returning true, then instead return null.
    
    If an error occurs during this process, then instead return an appropriate [DOMException error information](https://webmachinelearning.github.io/writing-assistance-apis/#domexception-error-information) according to the guidance in [§ 3.3.4 Errors](#language-model-errors).
    

#### 3.3.3. Options[](#language-model-options)

To **get the expected content types** given a [list](https://infra.spec.whatwg.org/#list) of `[LanguageModelExpected](#dictdef-languagemodelexpected)`s expectedContents:

1.  Let expectedTypes be an empty [list](https://infra.spec.whatwg.org/#list) of `[LanguageModelMessageType](#enumdef-languagemodelmessagetype)`s.
    
2.  [For each](https://infra.spec.whatwg.org/#list-iterate) expected of expectedContents:
    
    1.  If expectedTypes does not [contain](https://infra.spec.whatwg.org/#list-contain) expected\["`[type](#dom-languagemodelexpected-type)`"\], then [append](https://infra.spec.whatwg.org/#list-append) expected\["`[type](#dom-languagemodelexpected-type)`"\] to expectedTypes.
        
3.  If expectedTypes does not [contain](https://infra.spec.whatwg.org/#list-contain) "`[text](#dom-languagemodelmessagetype-text)`", then [append](https://infra.spec.whatwg.org/#list-append) "`[text](#dom-languagemodelmessagetype-text)`" to expectedTypes.
    
4.  Return expectedTypes.
    

To **validate and canonicalize a prompt** given a `[LanguageModelPrompt](#typedefdef-languagemodelprompt)` input, a [list](https://infra.spec.whatwg.org/#list) of `[LanguageModelMessageType](#enumdef-languagemodelmessagetype)`s expectedTypes, and a boolean hasAppendedInput, perform the following steps. The return value will be a non-empty [list](https://infra.spec.whatwg.org/#list) of `[LanguageModelMessage](#dictdef-languagemodelmessage)`s in their "longhand" form.

1.  [Assert](https://infra.spec.whatwg.org/#assert): expectedTypes [contains](https://infra.spec.whatwg.org/#list-contain) "`[text](#dom-languagemodelmessagetype-text)`".
    
2.  If input is a [string](https://infra.spec.whatwg.org/#string), then return « «\[ "`[role](#dom-languagemodelmessage-role)`" → "`[user](#dom-languagemodelmessagerole-user)`", "`[content](#dom-languagemodelmessage-content)`" → « «\[ "`[type](#dom-languagemodelmessagecontent-type)`" → "`[text](#dom-languagemodelmessagetype-text)`", "`[value](#dom-languagemodelmessagecontent-value)`" → input \]» », "`[prefix](#dom-languagemodelmessage-prefix)`" → false \]» ».
    
3.  [Assert](https://infra.spec.whatwg.org/#assert): input is a [list](https://infra.spec.whatwg.org/#list) of `[LanguageModelMessage](#dictdef-languagemodelmessage)`s.
    
4.  If input is an empty [list](https://infra.spec.whatwg.org/#list), then return « «\[ "`[role](#dom-languagemodelmessage-role)`" → "`[user](#dom-languagemodelmessagerole-user)`", "`[content](#dom-languagemodelmessage-content)`" → « «\[ "`[type](#dom-languagemodelmessagecontent-type)`" → "`[text](#dom-languagemodelmessagetype-text)`", "`[value](#dom-languagemodelmessagecontent-value)`" → "" \]» », "`[prefix](#dom-languagemodelmessage-prefix)`" → false \]» ».
    
5.  Let messages be an empty [list](https://infra.spec.whatwg.org/#list) of `[LanguageModelMessage](#dictdef-languagemodelmessage)`s.
    
6.  [For each](https://infra.spec.whatwg.org/#list-iterate) message of input:
    
    1.  If message\["`[content](#dom-languagemodelmessage-content)`"\] is a [string](https://infra.spec.whatwg.org/#string), then set message to «\[ "`[role](#dom-languagemodelmessage-role)`" → message\["`[role](#dom-languagemodelmessage-role)`"\], "`[content](#dom-languagemodelmessage-content)`" → « «\[ "`[type](#dom-languagemodelmessagecontent-type)`" → "`[text](#dom-languagemodelmessagetype-text)`", "`[value](#dom-languagemodelmessagecontent-value)`" → message\["`[content](#dom-languagemodelmessage-content)`"\] \]» », "`[prefix](#dom-languagemodelmessage-prefix)`" → message\["`[prefix](#dom-languagemodelmessage-prefix)`"\] \]».
        
    2.  If message\["`[prefix](#dom-languagemodelmessage-prefix)`"\] is true, then:
        
        1.  If message\["`[role](#dom-languagemodelmessage-role)`"\] is not "`[assistant](#dom-languagemodelmessagerole-assistant)`", then throw a "`[SyntaxError](https://webidl.spec.whatwg.org/#syntaxerror)`" `[DOMException](https://webidl.spec.whatwg.org/#idl-DOMException)`.
            
        2.  If message is not the last item in messages, then throw a "`[SyntaxError](https://webidl.spec.whatwg.org/#syntaxerror)`" `[DOMException](https://webidl.spec.whatwg.org/#idl-DOMException)`.
            
    3.  If message\["`[role](#dom-languagemodelmessage-role)`"\] is "`[system](#dom-languagemodelmessagerole-system)`", then:
        
        1.  If hasAppendedInput is true, then throw a "`[TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror)`" `[DOMException](https://webidl.spec.whatwg.org/#idl-DOMException)`.
            
    4.  If message\["`[content](#dom-languagemodelmessage-content)`"\] is an empty [list](https://infra.spec.whatwg.org/#list), then:
        
        1.  Let emptyContent be a new `[LanguageModelMessageContent](#dictdef-languagemodelmessagecontent)` initialized with «\[ "`[type](#dom-languagemodelmessagecontent-type)`" → "`[text](#dom-languagemodelmessagetype-text)`", "`[value](#dom-languagemodelmessagecontent-value)`" → "" \]».
            
        2.  [append](https://infra.spec.whatwg.org/#list-append) emptyContent to message\["`[content](#dom-languagemodelmessage-content)`"\].
            
    5.  [For each](https://infra.spec.whatwg.org/#list-iterate) content of message\["`[content](#dom-languagemodelmessage-content)`"\]:
        
        1.  If message\["`[role](#dom-languagemodelmessage-role)`"\] is "`[assistant](#dom-languagemodelmessagerole-assistant)`" and content\["`[type](#dom-languagemodelmessagecontent-type)`"\] is not "`[text](#dom-languagemodelmessagetype-text)`", then throw a "`[NotSupportedError](https://webidl.spec.whatwg.org/#notsupportederror)`" `[DOMException](https://webidl.spec.whatwg.org/#idl-DOMException)`.
            
        2.  If content\["`[type](#dom-languagemodelmessagecontent-type)`"\] is "`[text](#dom-languagemodelmessagetype-text)`" and content\["`[value](#dom-languagemodelmessagecontent-value)`"\] is not a [string](https://infra.spec.whatwg.org/#string), then throw a "`[TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror)`" `[DOMException](https://webidl.spec.whatwg.org/#idl-DOMException)`.
            
        3.  If content\["`[type](#dom-languagemodelmessagecontent-type)`"\] is "`[image](#dom-languagemodelmessagetype-image)`", then:
            
            1.  If expectedTypes does not [contain](https://infra.spec.whatwg.org/#list-contain) "`[image](#dom-languagemodelmessagetype-image)`", then throw a "`[NotSupportedError](https://webidl.spec.whatwg.org/#notsupportederror)`" `[DOMException](https://webidl.spec.whatwg.org/#idl-DOMException)`.
                
            2.  If content\["`[value](#dom-languagemodelmessagecontent-value)`"\] is not an `[ImageBitmapSource](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#imagebitmapsource)` or `[BufferSource](https://webidl.spec.whatwg.org/#BufferSource)`, then throw a "`[TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror)`" `[DOMException](https://webidl.spec.whatwg.org/#idl-DOMException)`.
                
        4.  If content\["`[type](#dom-languagemodelmessagecontent-type)`"\] is "`[audio](#dom-languagemodelmessagetype-audio)`", then:
            
            1.  If expectedTypes does not [contain](https://infra.spec.whatwg.org/#list-contain) "`[audio](#dom-languagemodelmessagetype-audio)`", then throw a "`[NotSupportedError](https://webidl.spec.whatwg.org/#notsupportederror)`" `[DOMException](https://webidl.spec.whatwg.org/#idl-DOMException)`.
                
            2.  If content\["`[value](#dom-languagemodelmessagecontent-value)`"\] is not an `[AudioBuffer](https://webaudio.github.io/web-audio-api/#AudioBuffer)`, `[BufferSource](https://webidl.spec.whatwg.org/#BufferSource)`, or `[Blob](https://w3c.github.io/FileAPI/#dfn-Blob)`, then throw a "`[TypeError](https://webidl.spec.whatwg.org/#exceptiondef-typeerror)`" `[DOMException](https://webidl.spec.whatwg.org/#idl-DOMException)`.
                
    6.  Let contentWithContiguousTextCollapsed be an empty [list](https://infra.spec.whatwg.org/#list) of `[LanguageModelMessageContent](#dictdef-languagemodelmessagecontent)`s.
        
    7.  Let lastTextContent be null.
        
    8.  [For each](https://infra.spec.whatwg.org/#list-iterate) content of message\["`[content](#dom-languagemodelmessage-content)`"\]:
        
        1.  If content\["`[type](#dom-languagemodelmessagecontent-type)`"\] is "`[text](#dom-languagemodelmessagetype-text)`":
            
            1.  If lastTextContent is null:
                
                1.  [Append](https://infra.spec.whatwg.org/#list-append) content to contentWithContiguousTextCollapsed.
                    
                2.  Set lastTextContent to content.
                    
            2.  Otherwise, set lastTextContent\["`[value](#dom-languagemodelmessagecontent-value)`"\] to the concatenation of lastTextContent\["`[value](#dom-languagemodelmessagecontent-value)`"\] and content\["`[value](#dom-languagemodelmessagecontent-value)`"\].
                
                No space or other character is added. Thus, « «\[ "`[type](#dom-languagemodelmessagecontent-type)`" → "`[text](#dom-languagemodelmessagetype-text)`", "`foo`" \]», «\[ "`[type](#dom-languagemodelmessagecontent-type)`" → "`[text](#dom-languagemodelmessagetype-text)`", "`bar`" \]» » is canonicalized to « «\[ "`[type](#dom-languagemodelmessagecontent-type)`" → "`[text](#dom-languagemodelmessagetype-text)`", "`foobar`" \]».
                
        2.  Otherwise:
            
            1.  [Append](https://infra.spec.whatwg.org/#list-append) content to contentWithContiguousTextCollapsed.
                
            2.  Set lastTextContent to null.
                
        3.  Set message\["`[content](#dom-languagemodelmessage-content)`"\] to contentWithContiguousTextCollapsed.
            
    9.  [Append](https://infra.spec.whatwg.org/#list-append) message to messages.
        
    10.  Set hasAppendedInput to true.
         
7.  If messages [is empty](https://infra.spec.whatwg.org/#list-is-empty), then throw a "`[SyntaxError](https://webidl.spec.whatwg.org/#syntaxerror)`" `[DOMException](https://webidl.spec.whatwg.org/#idl-DOMException)`.
    
8.  Return messages.
    

#### 3.3.4. Errors[](#language-model-errors)

When prompting fails, the following possible reasons may be surfaced to the web developer. This table lists the possible `[DOMException](https://webidl.spec.whatwg.org/#idl-DOMException)` [names](https://webidl.spec.whatwg.org/#domexception-name) and the cases in which an implementation should use them:

| `[DOMException](https://webidl.spec.whatwg.org/#idl-DOMException)` [name](https://webidl.spec.whatwg.org/#domexception-name) | Scenarios |
| --- | --- |
| "`[NotAllowedError](https://webidl.spec.whatwg.org/#notallowederror)`" | 
Prompting is disabled by user choice or user agent policy.

 |
| "`[NotReadableError](https://webidl.spec.whatwg.org/#notreadableerror)`" | 

The model output was filtered by the user agent, e.g., because it was detected to be harmful, inaccurate, or nonsensical.

 |
| "`[NotSupportedError](https://webidl.spec.whatwg.org/#notsupportederror)`" | 

The input to be processed was in a language that the user agent does not support, or was not provided properly in the call to `[create()](#dom-languagemodel-create)`.

The model output ended up being in a language that the user agent does not support (e.g., because the user agent has not performed sufficient quality control tests on that output language).

 |
| "`[UnknownError](https://webidl.spec.whatwg.org/#unknownerror)`" | 

All other scenarios, including if the user agent believes it cannot prompt the model and also meet the requirements given in [§ 4 Privacy considerations](#privacy) or [§ 5 Security considerations](#security). Or, if the user agent would prefer not to disclose the failure reason.

 |

This table does not give the complete list of exceptions that can be surfaced by the prompt API. It only contains those which can come from certain [implementation-defined](https://infra.spec.whatwg.org/#implementation-defined) steps.

To **clone a language model** given a `[LanguageModel](#languagemodel)` model and a `[LanguageModelCloneOptions](#dictdef-languagemodelcloneoptions)` options:

1.  Let global be model’s [relevant global object](https://html.spec.whatwg.org/multipage/webappapis.html#concept-relevant-global).
    
2.  [Assert](https://infra.spec.whatwg.org/#assert): global is a `[Window](https://html.spec.whatwg.org/multipage/nav-history-apis.html#window)` object.
    
3.  If global’s [associated Document](https://html.spec.whatwg.org/multipage/nav-history-apis.html#concept-document-window) is not [fully active](https://html.spec.whatwg.org/multipage/document-sequences.html#fully-active), then return [a promise rejected with](https://webidl.spec.whatwg.org/#a-promise-rejected-with) an "`[InvalidStateError](https://webidl.spec.whatwg.org/#invalidstateerror)`" `[DOMException](https://webidl.spec.whatwg.org/#idl-DOMException)`.
    
4.  Let signals be « model’s [destruction abort controller](https://webmachinelearning.github.io/writing-assistance-apis/#destroyablemodel-destruction-abort-controller)’s [signal](https://dom.spec.whatwg.org/#abortcontroller-signal) ».
    
5.  If options\["`signal`"\] [exists](https://infra.spec.whatwg.org/#map-exists), then [append](https://infra.spec.whatwg.org/#set-append) it to signals.
    
6.  Let compositeSignal be the result of [creating a dependent abort signal](https://dom.spec.whatwg.org/#create-a-dependent-abort-signal) given signals using `[AbortSignal](https://dom.spec.whatwg.org/#abortsignal)` and model’s [relevant realm](https://html.spec.whatwg.org/multipage/webappapis.html#concept-relevant-realm).
    
7.  If compositeSignal is [aborted](https://dom.spec.whatwg.org/#abortsignal-aborted), then return [a promise rejected with](https://webidl.spec.whatwg.org/#a-promise-rejected-with) compositeSignal’s [abort reason](https://dom.spec.whatwg.org/#abortsignal-abort-reason).
    
8.  Let signal be options\["`[signal](#dom-languagemodelcloneoptions-signal)`"\] if it [exists](https://infra.spec.whatwg.org/#map-exists); otherwise null.
    
9.  If signal is not null and is [aborted](https://dom.spec.whatwg.org/#abortsignal-aborted), then return a promise rejected with signal’s [abort reason](https://dom.spec.whatwg.org/#abortsignal-abort-reason).
    
10.  Let promise be [a new promise](https://webidl.spec.whatwg.org/#a-new-promise) created in model’s [relevant realm](https://html.spec.whatwg.org/multipage/webappapis.html#concept-relevant-realm).
     
11.  Let abortedDuringOperation be false.
     
     This variable will be written to from the [event loop](https://html.spec.whatwg.org/multipage/webappapis.html#event-loop), but read from [in parallel](https://html.spec.whatwg.org/multipage/infrastructure.html#in-parallel).
     
12.  [Add the following abort steps](https://dom.spec.whatwg.org/#abortsignal-add) to compositeSignal:
     
     1.  Set abortedDuringOperation to true.
         
     2.  [Reject](https://webidl.spec.whatwg.org/#reject) promise with compositeSignal’s [abort reason](https://dom.spec.whatwg.org/#abortsignal-abort-reason).
         
13.  [In parallel](https://html.spec.whatwg.org/multipage/infrastructure.html#in-parallel):
     
     1.  [Queue a global task](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-global-task) on the [AI task source](https://webmachinelearning.github.io/writing-assistance-apis/#ai-task-source) to perform the following steps:
         
         1.  If abortedDuringOperation is true, then return.
             
         2.  Let clonedModel be a new `[LanguageModel](#languagemodel)` object with:
             
             -   [initial messages](#languagemodel-initial-messages) set to model’s [initial messages](#languagemodel-initial-messages).
                 
             -   [top K](#languagemodel-top-k) set to model’s [top K](#languagemodel-top-k).
                 
             -   [temperature](#languagemodel-temperature) set to model’s [temperature](#languagemodel-temperature).
                 
             -   [expected inputs](#languagemodel-expected-inputs) set to model’s [expected inputs](#languagemodel-expected-inputs).
                 
             -   [expected outputs](#languagemodel-expected-outputs) set to model’s [expected outputs](#languagemodel-expected-outputs).
                 
             -   [tools](#languagemodel-tools) set to model’s [tools](#languagemodel-tools).
                 
             -   [context window size](#languagemodel-context-window-size) set to model’s [context window size](#languagemodel-context-window-size).
                 
             -   [current context usage](#languagemodel-current-context-usage) set to model’s [current context usage](#languagemodel-current-context-usage).
                 
         3.  In an [implementation-defined](https://infra.spec.whatwg.org/#implementation-defined) manner, copy any other state from model to clonedModel.
             
         4.  If the copy operation fails:
             
             1.  [Reject](https://webidl.spec.whatwg.org/#reject) promise with a "`[OperationError](https://webidl.spec.whatwg.org/#operationerror)`" `[DOMException](https://webidl.spec.whatwg.org/#idl-DOMException)`.
                 
             2.  Return.
                 
         5.  [Resolve](https://webidl.spec.whatwg.org/#resolve) promise with clonedModel.
             
14.  Return promise.
     

### 3.4. Permissions policy integration[](#permissions-policy)

Access to the prompt API is gated behind the [policy-controlled feature](https://w3c.github.io/webappsec-permissions-policy/#policy-controlled-feature) "**`language-model`**", which has a [default allowlist](https://w3c.github.io/webappsec-permissions-policy/#policy-controlled-feature-default-allowlist) of `['self'](https://w3c.github.io/webappsec-permissions-policy/#default-allowlist-self)`.

## 4\. Privacy considerations[](#privacy)

Please see [Writing Assistance APIs § 6 Privacy considerations](https://webmachinelearning.github.io/writing-assistance-apis/#privacy) for a discussion of privacy considerations for the prompt API. That text was written to apply to all APIs sharing the same infrastructure, as noted in [§ 2 Dependencies](#dependencies).

## 5\. Security considerations[](#security)

Please see [Writing Assistance APIs § 7 Security considerations](https://webmachinelearning.github.io/writing-assistance-apis/#security) for a discussion of security considerations for the prompt API. That text was written to apply to all APIs sharing the same infrastructure, as noted in [§ 2 Dependencies](#dependencies).

## Index[](#index)

### Terms defined by this specification[](#index-defined-here)

-   [append(input)](#dom-languagemodel-append), in § 3.3
-   [append(input, options)](#dom-languagemodel-append), in § 3.3
-   ["assistant"](#dom-languagemodelmessagerole-assistant), in § 3
-   ["audio"](#dom-languagemodelmessagetype-audio), in § 3
-   [availability()](#dom-languagemodel-availability), in § 3.2
-   [availability(options)](#dom-languagemodel-availability), in § 3.2
-   ["balanced"](#dom-languagemodelsamplingmode-balanced), in § 3
-   [clone()](#dom-languagemodel-clone), in § 3.3
-   [clone a language model](#clone-a-language-model), in § 3.3.4
-   [clone(options)](#dom-languagemodel-clone), in § 3.3
-   [compute language model options availability](#compute-language-model-options-availability), in § 3.2
-   [content](#dom-languagemodelmessage-content), in § 3
-   [contextoverflow](#eventdef-languagemodel-contextoverflow), in § 3.3
-   [contextUsage](#dom-languagemodel-contextusage), in § 3.3
-   [contextWindow](#dom-languagemodel-contextwindow), in § 3.3
-   [context window size](#languagemodel-context-window-size), in § 3.3
-   [create()](#dom-languagemodel-create), in § 3.1
-   [create a language model object](#create-a-language-model-object), in § 3.1
-   [create(options)](#dom-languagemodel-create), in § 3.1
-   ["creative"](#dom-languagemodelsamplingmode-creative), in § 3
-   [current context usage](#languagemodel-current-context-usage), in § 3.3
-   [defaultTemperature](#dom-languagemodelparams-defaulttemperature), in § 3
-   [defaultTopK](#dom-languagemodelparams-defaulttopk), in § 3
-   [description](#dom-languagemodeltool-description), in § 3
-   [download the language model](#download-the-language-model), in § 3.1
-   [execute](#dom-languagemodeltool-execute), in § 3
-   [expected inputs](#languagemodel-expected-inputs), in § 3.3
-   [expectedInputs](#dom-languagemodelcreatecoreoptions-expectedinputs), in § 3
-   [expected outputs](#languagemodel-expected-outputs), in § 3.3
-   [expectedOutputs](#dom-languagemodelcreatecoreoptions-expectedoutputs), in § 3
-   [generate](#generate), in § 3.3.1
-   [get the expected content types](#get-the-expected-content-types), in § 3.3.3
-   ["image"](#dom-languagemodelmessagetype-image), in § 3
-   [initialize the language model](#initialize-the-language-model), in § 3.1
-   [initial messages](#languagemodel-initial-messages), in § 3.3
-   [initialPrompts](#dom-languagemodelcreateoptions-initialprompts), in § 3
-   [inputQuota](#dom-languagemodel-inputquota), in § 3.3
-   [inputSchema](#dom-languagemodeltool-inputschema), in § 3
-   [inputUsage](#dom-languagemodel-inputusage), in § 3.3
-   [language-model](#permissiondef-language-model), in § 3.4
-   [LanguageModel](#languagemodel), in § 3
-   [LanguageModelAppendOptions](#dictdef-languagemodelappendoptions), in § 3
-   [LanguageModelCloneOptions](#dictdef-languagemodelcloneoptions), in § 3
-   [language model content type availability](#language-model-content-type-availability), in § 3.2
-   [LanguageModelCreateCoreOptions](#dictdef-languagemodelcreatecoreoptions), in § 3
-   [LanguageModelCreateOptions](#dictdef-languagemodelcreateoptions), in § 3
-   [LanguageModelExpected](#dictdef-languagemodelexpected), in § 3
-   [LanguageModelMessage](#dictdef-languagemodelmessage), in § 3
-   [LanguageModelMessageContent](#dictdef-languagemodelmessagecontent), in § 3
-   [LanguageModelMessageRole](#enumdef-languagemodelmessagerole), in § 3
-   [LanguageModelMessageType](#enumdef-languagemodelmessagetype), in § 3
-   [LanguageModelMessageValue](#typedefdef-languagemodelmessagevalue), in § 3
-   [language model non-options availability](#language-model-non-options-availability), in § 3.2
-   [LanguageModelParams](#languagemodelparams), in § 3
-   [LanguageModelPrompt](#typedefdef-languagemodelprompt), in § 3
-   [LanguageModelPromptOptions](#dictdef-languagemodelpromptoptions), in § 3
-   [LanguageModelSamplingMode](#enumdef-languagemodelsamplingmode), in § 3
-   [LanguageModelTool](#dictdef-languagemodeltool), in § 3
-   [LanguageModelToolFunction](#callbackdef-languagemodeltoolfunction), in § 3
-   [languages](#dom-languagemodelexpected-languages), in § 3
-   [maxTemperature](#dom-languagemodelparams-maxtemperature), in § 3
-   [maxTopK](#dom-languagemodelparams-maxtopk), in § 3
-   [measureContextUsage(input)](#dom-languagemodel-measurecontextusage), in § 3.3
-   [measureContextUsage(input, options)](#dom-languagemodel-measurecontextusage), in § 3.3
-   [measureInputUsage(input)](#dom-languagemodel-measureinputusage), in § 3.3
-   [measureInputUsage(input, options)](#dom-languagemodel-measureinputusage), in § 3.3
-   [measure language model context usage](#measure-language-model-context-usage), in § 3.3.2
-   [monitor](#dom-languagemodelcreateoptions-monitor), in § 3
-   ["most-creative"](#dom-languagemodelsamplingmode-most-creative), in § 3
-   ["most-predictable"](#dom-languagemodelsamplingmode-most-predictable), in § 3
-   [name](#dom-languagemodeltool-name), in § 3
-   [omitResponseConstraintInput](#dom-languagemodelpromptoptions-omitresponseconstraintinput), in § 3
-   [oncontextoverflow](#dom-languagemodel-oncontextoverflow), in § 3.3
-   [onquotaoverflow](#dom-languagemodel-onquotaoverflow), in § 3.3
-   [params()](#dom-languagemodel-params), in § 3
-   ["predictable"](#dom-languagemodelsamplingmode-predictable), in § 3
-   [prefill](#prefill), in § 3.3.1
-   [prefix](#dom-languagemodelmessage-prefix), in § 3
-   [prompt(input)](#dom-languagemodel-prompt), in § 3.3
-   [prompt(input, options)](#dom-languagemodel-prompt), in § 3.3
-   [promptStreaming(input)](#dom-languagemodel-promptstreaming), in § 3.3
-   [promptStreaming(input, options)](#dom-languagemodel-promptstreaming), in § 3.3
-   [quotaoverflow](#eventdef-languagemodel-quotaoverflow), in § 3.3
-   [responseConstraint](#dom-languagemodelpromptoptions-responseconstraint), in § 3
-   [role](#dom-languagemodelmessage-role), in § 3
-   samplingMode
    -   [attribute for LanguageModel](#dom-languagemodel-samplingmode), in § 3
    -   [dict-member for LanguageModelCreateCoreOptions](#dom-languagemodelcreatecoreoptions-samplingmode), in § 3
-   signal
    -   [dict-member for LanguageModelAppendOptions](#dom-languagemodelappendoptions-signal), in § 3
    -   [dict-member for LanguageModelCloneOptions](#dom-languagemodelcloneoptions-signal), in § 3
    -   [dict-member for LanguageModelCreateOptions](#dom-languagemodelcreateoptions-signal), in § 3
    -   [dict-member for LanguageModelPromptOptions](#dom-languagemodelpromptoptions-signal), in § 3
-   ["slightly-creative"](#dom-languagemodelsamplingmode-slightly-creative), in § 3
-   ["slightly-predictable"](#dom-languagemodelsamplingmode-slightly-predictable), in § 3
-   ["system"](#dom-languagemodelmessagerole-system), in § 3
-   temperature
    -   [attribute for LanguageModel](#dom-languagemodel-temperature), in § 3.3
    -   [dfn for LanguageModel](#languagemodel-temperature), in § 3.3
    -   [dict-member for LanguageModelCreateCoreOptions](#dom-languagemodelcreatecoreoptions-temperature), in § 3
-   ["text"](#dom-languagemodelmessagetype-text), in § 3
-   ["tool-call"](#dom-languagemodelmessagetype-tool-call), in § 3
-   ["tool-response"](#dom-languagemodelmessagetype-tool-response), in § 3
-   tools
    -   [dfn for LanguageModel](#languagemodel-tools), in § 3.3
    -   [dict-member for LanguageModelCreateCoreOptions](#dom-languagemodelcreatecoreoptions-tools), in § 3
-   [top K](#languagemodel-top-k), in § 3.3
-   topK
    -   [attribute for LanguageModel](#dom-languagemodel-topk), in § 3.3
    -   [dict-member for LanguageModelCreateCoreOptions](#dom-languagemodelcreatecoreoptions-topk), in § 3
-   type
    -   [dict-member for LanguageModelExpected](#dom-languagemodelexpected-type), in § 3
    -   [dict-member for LanguageModelMessageContent](#dom-languagemodelmessagecontent-type), in § 3
-   ["user"](#dom-languagemodelmessagerole-user), in § 3
-   [validate and canonicalize a prompt](#validate-and-canonicalize-a-prompt), in § 3.3.3
-   [validate and canonicalize language model options](#validate-and-canonicalize-language-model-options), in § 3.1
-   [validating and canonicalizing a prompt](#validate-and-canonicalize-a-prompt), in § 3.3.3
-   [value](#dom-languagemodelmessagecontent-value), in § 3

### Terms defined by reference[](#index-defined-elsewhere)

-   \[DOM\] defines the following terms:
    -   AbortSignal
    -   EventTarget
    -   abort reason
    -   aborted
    -   add
    -   create a dependent abort signal
    -   signal
-   \[ECMASCRIPT\] defines the following terms:
    -   realm
    -   surrounding agent
-   \[FileAPI\] defines the following terms:
    -   Blob
-   \[HTML\] defines the following terms:
    -   EventHandler
    -   ImageBitmapSource
    -   Window
    -   associated Document
    -   event handler
    -   event handler event type
    -   event handler IDL attribute
    -   event loop
    -   event loop (for agent)
    -   fully active
    -   in parallel
    -   queue a global task
    -   relevant global object
    -   relevant realm
-   \[INFRA\] defines the following terms:
    -   append (for list)
    -   append (for set)
    -   assert
    -   break
    -   contain
    -   exist
    -   for each
    -   implementation-defined
    -   is empty
    -   list
    -   string
-   \[PERMISSIONS-POLICY-1\] defines the following terms:
    -   'self'
    -   default allowlist
    -   policy-controlled feature
-   \[STREAMS\] defines the following terms:
    -   ReadableStream
-   \[WEBAUDIO-1.0\] defines the following terms:
    -   AudioBuffer
-   \[WEBIDL\] defines the following terms:
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
    -   a new promise
    -   a promise rejected with
    -   any
    -   boolean
    -   double
    -   float
    -   name
    -   object
    -   quota
    -   reject
    -   requested
    -   resolve
    -   sequence
    -   this
    -   undefined
    -   unrestricted double
    -   unsigned long
-   \[WRITING-ASSISTANCE-APIS\] defines the following terms:
    -   "available"
    -   "downloadable"
    -   "downloading"
    -   "unavailable"
    -   Availability
    -   CreateMonitorCallback
    -   DestroyableModel
    -   AI task source
    -   can support
    -   compute AI model availability
    -   compute language availability
    -   create an AI model object
    -   currently supports
    -   destruction abort controller
    -   details
    -   DOMException error information
    -   error information
    -   get a streaming AI model result
    -   get an aggregated AI model result
    -   get the language availabilities partition
    -   measure AI model input usage
    -   minimum availability
    -   name
    -   quota exceeded error information
    -   supports
    -   validate and canonicalize language tags

## References[](#references)

### Normative References[](#normative)

\[DOM\]

Anne van Kesteren. [DOM Standard](https://dom.spec.whatwg.org/). Living Standard. URL: [https://dom.spec.whatwg.org/](https://dom.spec.whatwg.org/)

\[ECMA-402\]

[ECMAScript Internationalization API Specification](https://tc39.es/ecma402/). URL: [https://tc39.es/ecma402/](https://tc39.es/ecma402/)

\[ECMASCRIPT\]

[ECMAScript Language Specification](https://tc39.es/ecma262/multipage/). URL: [https://tc39.es/ecma262/multipage/](https://tc39.es/ecma262/multipage/)

\[FileAPI\]

Marijn Kruisselbrink. [File API](https://w3c.github.io/FileAPI/). URL: [https://w3c.github.io/FileAPI/](https://w3c.github.io/FileAPI/)

\[HTML\]

Anne van Kesteren; et al. [HTML Standard](https://html.spec.whatwg.org/multipage/). Living Standard. URL: [https://html.spec.whatwg.org/multipage/](https://html.spec.whatwg.org/multipage/)

\[INFRA\]

Anne van Kesteren; Domenic Denicola. [Infra Standard](https://infra.spec.whatwg.org/). Living Standard. URL: [https://infra.spec.whatwg.org/](https://infra.spec.whatwg.org/)

\[PERMISSIONS-POLICY-1\]

Ian Clelland. [Permissions Policy](https://w3c.github.io/webappsec-permissions-policy/). URL: [https://w3c.github.io/webappsec-permissions-policy/](https://w3c.github.io/webappsec-permissions-policy/)

\[STREAMS\]

Adam Rice; et al. [Streams Standard](https://streams.spec.whatwg.org/). Living Standard. URL: [https://streams.spec.whatwg.org/](https://streams.spec.whatwg.org/)

\[WEBAUDIO-1.0\]

Paul Adenot; Hongchan Choi. [Web Audio API](https://webaudio.github.io/web-audio-api/). URL: [https://webaudio.github.io/web-audio-api/](https://webaudio.github.io/web-audio-api/)

\[WEBIDL\]

Edgar Chen; Timothy Gu. [Web IDL Standard](https://webidl.spec.whatwg.org/). Living Standard. URL: [https://webidl.spec.whatwg.org/](https://webidl.spec.whatwg.org/)

\[WRITING-ASSISTANCE-APIS\]

[Writing Assistance APIs](https://webmachinelearning.github.io/writing-assistance-apis/). Draft Community Group Report. URL: [https://webmachinelearning.github.io/writing-assistance-apis/](https://webmachinelearning.github.io/writing-assistance-apis/)

### Non-Normative References[](#informative)

\[BCP47\]

A. Phillips, Ed.; M. Davis, Ed.. [Tags for Identifying Languages](https://www.rfc-editor.org/info/rfc5646/). September 2009. Best Current Practice. URL: [https://www.rfc-editor.org/info/rfc5646/](https://www.rfc-editor.org/info/rfc5646/)

\[UTS35\]

Mark Davis; et al. [Unicode Locale Data Markup Language (LDML)](https://www.unicode.org/reports/tr35/tr35-61/tr35.html). 23 October 2020. Unicode Technical Standard #35. URL: [https://www.unicode.org/reports/tr35/tr35-61/tr35.html](https://www.unicode.org/reports/tr35/tr35-61/tr35.html)

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