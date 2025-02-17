import { CallbackManager, } from "../callbacks/manager.js";
import { Serializable } from "../load/serializable.js";
import { IterableReadableStream } from "../util/stream.js";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function _coerceToDict(value, defaultKey) {
    return value && !Array.isArray(value) && typeof value === "object"
        ? value
        : { [defaultKey]: value };
}
/**
 * A Runnable is a generic unit of work that can be invoked, batched, streamed, and/or
 * transformed.
 */
export class Runnable extends Serializable {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "lc_runnable", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
    }
    /**
     * Bind arguments to a Runnable, returning a new Runnable.
     * @param kwargs
     * @returns A new RunnableBinding that, when invoked, will apply the bound args.
     */
    bind(kwargs) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        return new RunnableBinding({ bound: this, kwargs });
    }
    /**
     * Create a new runnable from the current one that will try invoking
     * other passed fallback runnables if the initial invocation fails.
     * @param fields.fallbacks Other runnables to call if the runnable errors.
     * @returns A new RunnableWithFallbacks.
     */
    withFallbacks(fields) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        return new RunnableWithFallbacks({
            runnable: this,
            fallbacks: fields.fallbacks,
        });
    }
    _getOptionsList(options, length = 0) {
        if (Array.isArray(options)) {
            if (options.length !== length) {
                throw new Error(`Passed "options" must be an array with the same length as the inputs, but got ${options.length} options for ${length} inputs`);
            }
            return options;
        }
        return Array.from({ length }, () => options);
    }
    /**
     * Default implementation of batch, which calls invoke N times.
     * Subclasses should override this method if they can batch more efficiently.
     * @param inputs Array of inputs to each batch call.
     * @param options Either a single call options object to apply to each batch call or an array for each call.
     * @param batchOptions.maxConcurrency Maximum number of calls to run at once.
     * @returns An array of RunOutputs
     */
    async batch(inputs, options, batchOptions) {
        const configList = this._getOptionsList(options ?? {}, inputs.length);
        const batchSize = batchOptions?.maxConcurrency && batchOptions.maxConcurrency > 0
            ? batchOptions?.maxConcurrency
            : inputs.length;
        const batchResults = [];
        for (let i = 0; i < inputs.length; i += batchSize) {
            const batchPromises = inputs
                .slice(i, i + batchSize)
                .map((input, j) => this.invoke(input, configList[j]));
            const batchResult = await Promise.all(batchPromises);
            batchResults.push(batchResult);
        }
        return batchResults.flat();
    }
    /**
     * Default streaming implementation.
     * Subclasses should override this method if they support streaming output.
     * @param input
     * @param options
     */
    async *_streamIterator(input, options) {
        yield this.invoke(input, options);
    }
    /**
     * Stream output in chunks.
     * @param input
     * @param options
     * @returns A readable stream that is also an iterable.
     */
    async stream(input, options) {
        return IterableReadableStream.fromAsyncGenerator(this._streamIterator(input, options));
    }
    _separateRunnableConfigFromCallOptions(options = {}) {
        const runnableConfig = {
            callbacks: options.callbacks,
            tags: options.tags,
            metadata: options.metadata,
        };
        const callOptions = { ...options };
        delete callOptions.callbacks;
        delete callOptions.tags;
        delete callOptions.metadata;
        return [runnableConfig, callOptions];
    }
    async _callWithConfig(func, input, options) {
        const callbackManager_ = await CallbackManager.configure(options?.callbacks, undefined, options?.tags, undefined, options?.metadata);
        const runManager = await callbackManager_?.handleChainStart(this.toJSON(), _coerceToDict(input, "input"), undefined, options?.runType);
        let output;
        try {
            output = await func.bind(this)(input);
        }
        catch (e) {
            await runManager?.handleChainError(e);
            throw e;
        }
        await runManager?.handleChainEnd(_coerceToDict(output, "output"));
        return output;
    }
    /**
     * Helper method to transform an Iterator of Input values into an Iterator of
     * Output values, with callbacks.
     * Use this to implement `stream()` or `transform()` in Runnable subclasses.
     */
    async *_transformStreamWithConfig(inputGenerator, transformer, options) {
        let finalInput;
        let finalInputSupported = true;
        let finalOutput;
        let finalOutputSupported = true;
        const callbackManager_ = await CallbackManager.configure(options?.callbacks, undefined, options?.tags, undefined, options?.metadata);
        let runManager;
        const serializedRepresentation = this.toJSON();
        async function* wrapInputForTracing() {
            for await (const chunk of inputGenerator) {
                if (!runManager) {
                    // Start the run manager AFTER the iterator starts to preserve
                    // tracing order
                    runManager = await callbackManager_?.handleChainStart(serializedRepresentation, { input: "" }, undefined, options?.runType);
                }
                if (finalInputSupported) {
                    if (finalInput === undefined) {
                        finalInput = chunk;
                    }
                    else {
                        try {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            finalInput = finalInput.concat(chunk);
                        }
                        catch {
                            finalInput = undefined;
                            finalInputSupported = false;
                        }
                    }
                }
                yield chunk;
            }
        }
        const wrappedInputGenerator = wrapInputForTracing();
        try {
            const outputIterator = transformer(wrappedInputGenerator, runManager, options);
            for await (const chunk of outputIterator) {
                yield chunk;
                if (finalOutputSupported) {
                    if (finalOutput === undefined) {
                        finalOutput = chunk;
                    }
                    else {
                        try {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            finalOutput = finalOutput.concat(chunk);
                        }
                        catch {
                            finalOutput = undefined;
                            finalOutputSupported = false;
                        }
                    }
                }
            }
        }
        catch (e) {
            await runManager?.handleChainError(e, undefined, undefined, undefined, {
                inputs: _coerceToDict(finalInput, "input"),
            });
            throw e;
        }
        await runManager?.handleChainEnd(finalOutput ?? {}, undefined, undefined, undefined, { inputs: _coerceToDict(finalInput, "input") });
    }
    _patchConfig(config = {}, callbackManager = undefined) {
        return { ...config, callbacks: callbackManager };
    }
    /**
     * Create a new runnable sequence that runs each individual runnable in series,
     * piping the output of one runnable into another runnable or runnable-like.
     * @param coerceable A runnable, function, or object whose values are functions or runnables.
     * @returns A new runnable sequence.
     */
    pipe(coerceable) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        return new RunnableSequence({
            first: this,
            last: _coerceToRunnable(coerceable),
        });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static isRunnable(thing) {
        return thing.lc_runnable;
    }
}
/**
 * A sequence of runnables, where the output of each is the input of the next.
 */
export class RunnableSequence extends Runnable {
    static lc_name() {
        return "RunnableSequence";
    }
    constructor(fields) {
        super(fields);
        Object.defineProperty(this, "first", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "middle", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Object.defineProperty(this, "last", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "lc_serializable", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "lc_namespace", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ["langchain", "schema", "runnable"]
        });
        this.first = fields.first;
        this.middle = fields.middle ?? this.middle;
        this.last = fields.last;
    }
    get steps() {
        return [this.first, ...this.middle, this.last];
    }
    async invoke(input, options) {
        const callbackManager_ = await CallbackManager.configure(options?.callbacks, undefined, options?.tags, undefined, options?.metadata);
        const runManager = await callbackManager_?.handleChainStart(this.toJSON(), _coerceToDict(input, "input"));
        let nextStepInput = input;
        let finalOutput;
        try {
            for (const step of [this.first, ...this.middle]) {
                nextStepInput = await step.invoke(nextStepInput, this._patchConfig(options, runManager?.getChild()));
            }
            // TypeScript can't detect that the last output of the sequence returns RunOutput, so call it out of the loop here
            finalOutput = await this.last.invoke(nextStepInput, this._patchConfig(options, runManager?.getChild()));
        }
        catch (e) {
            await runManager?.handleChainError(e);
            throw e;
        }
        await runManager?.handleChainEnd(_coerceToDict(finalOutput, "output"));
        return finalOutput;
    }
    async batch(inputs, options, batchOptions) {
        const configList = this._getOptionsList(options ?? {}, inputs.length);
        const callbackManagers = await Promise.all(configList.map((config) => CallbackManager.configure(config?.callbacks, undefined, config?.tags, undefined, config?.metadata)));
        const runManagers = await Promise.all(callbackManagers.map((callbackManager, i) => callbackManager?.handleChainStart(this.toJSON(), _coerceToDict(inputs[i], "input"))));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let nextStepInputs = inputs;
        let finalOutputs;
        try {
            for (let i = 0; i < [this.first, ...this.middle].length; i += 1) {
                const step = this.steps[i];
                nextStepInputs = await step.batch(nextStepInputs, runManagers.map((runManager, j) => this._patchConfig(configList[j], runManager?.getChild())), batchOptions);
            }
            finalOutputs = await this.last.batch(nextStepInputs, runManagers.map((runManager) => this._patchConfig(configList[this.steps.length - 1], runManager?.getChild())), batchOptions);
        }
        catch (e) {
            await Promise.all(runManagers.map((runManager) => runManager?.handleChainError(e)));
            throw e;
        }
        await Promise.all(runManagers.map((runManager, i) => runManager?.handleChainEnd(_coerceToDict(finalOutputs[i], "output"))));
        return finalOutputs;
    }
    async *_streamIterator(input, options) {
        const callbackManager_ = await CallbackManager.configure(options?.callbacks, undefined, options?.tags, undefined, options?.metadata);
        const runManager = await callbackManager_?.handleChainStart(this.toJSON(), _coerceToDict(input, "input"));
        let nextStepInput = input;
        const steps = [this.first, ...this.middle, this.last];
        // Find the index of the last runnable in the sequence that doesn't have a .transform() method
        // and start streaming from there
        const streamingStartStepIndex = steps.length -
            [...steps]
                .reverse()
                .findIndex((step) => typeof step.transform !== "function") -
            1;
        try {
            for (const step of steps.slice(0, streamingStartStepIndex)) {
                nextStepInput = await step.invoke(nextStepInput, this._patchConfig(options, runManager?.getChild()));
            }
        }
        catch (e) {
            await runManager?.handleChainError(e);
            throw e;
        }
        let concatSupported = true;
        let finalOutput;
        try {
            let finalGenerator = await steps[streamingStartStepIndex]._streamIterator(nextStepInput, this._patchConfig(options, runManager?.getChild()));
            for (const step of steps.slice(streamingStartStepIndex + 1)) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                finalGenerator = await step.transform(finalGenerator, this._patchConfig(options, runManager?.getChild()));
            }
            for await (const chunk of finalGenerator) {
                yield chunk;
                if (concatSupported) {
                    if (finalOutput === undefined) {
                        finalOutput = chunk;
                    }
                    else {
                        try {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            finalOutput = finalOutput.concat(chunk);
                        }
                        catch (e) {
                            finalOutput = undefined;
                            concatSupported = false;
                        }
                    }
                }
            }
        }
        catch (e) {
            await runManager?.handleChainError(e);
            throw e;
        }
        await runManager?.handleChainEnd(_coerceToDict(finalOutput, "output"));
    }
    pipe(coerceable) {
        if (RunnableSequence.isRunnableSequence(coerceable)) {
            return new RunnableSequence({
                first: this.first,
                middle: this.middle.concat([
                    this.last,
                    coerceable.first,
                    ...coerceable.middle,
                ]),
                last: coerceable.last,
            });
        }
        else {
            return new RunnableSequence({
                first: this.first,
                middle: [...this.middle, this.last],
                last: _coerceToRunnable(coerceable),
            });
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static isRunnableSequence(thing) {
        return Array.isArray(thing.middle) && Runnable.isRunnable(thing);
    }
    static from([first, ...runnables]) {
        return new RunnableSequence({
            first: _coerceToRunnable(first),
            middle: runnables.slice(0, -1).map(_coerceToRunnable),
            last: _coerceToRunnable(runnables[runnables.length - 1]),
        });
    }
}
/**
 * A runnable that runs a mapping of runnables in parallel,
 * and returns a mapping of their outputs.
 */
export class RunnableMap extends Runnable {
    static lc_name() {
        return "RunnableMap";
    }
    constructor(fields) {
        super(fields);
        Object.defineProperty(this, "lc_namespace", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ["langchain", "schema", "runnable"]
        });
        Object.defineProperty(this, "lc_serializable", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "steps", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.steps = {};
        for (const [key, value] of Object.entries(fields.steps)) {
            this.steps[key] = _coerceToRunnable(value);
        }
    }
    async invoke(input, options
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) {
        const callbackManager_ = await CallbackManager.configure(options?.callbacks, undefined, options?.tags, undefined, options?.metadata);
        const runManager = await callbackManager_?.handleChainStart(this.toJSON(), {
            input,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const output = {};
        try {
            for (const [key, runnable] of Object.entries(this.steps)) {
                const result = await runnable.invoke(input, this._patchConfig(options, runManager?.getChild()));
                output[key] = result;
            }
        }
        catch (e) {
            await runManager?.handleChainError(e);
            throw e;
        }
        await runManager?.handleChainEnd(output);
        return output;
    }
}
/**
 * A runnable that runs a callable.
 */
export class RunnableLambda extends Runnable {
    static lc_name() {
        return "RunnableLambda";
    }
    constructor(fields) {
        super(fields);
        Object.defineProperty(this, "lc_namespace", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ["langchain", "schema", "runnable"]
        });
        Object.defineProperty(this, "func", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.func = fields.func;
    }
    async invoke(input, options) {
        return this._callWithConfig(async (input) => this.func(input), input, options);
    }
}
/**
 * A runnable that passes through the input.
 */
export class RunnablePassthrough extends Runnable {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "lc_namespace", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ["langchain", "schema", "runnable"]
        });
        Object.defineProperty(this, "lc_serializable", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
    }
    static lc_name() {
        return "RunnablePassthrough";
    }
    async invoke(input, options) {
        return this._callWithConfig((input) => Promise.resolve(input), input, options);
    }
}
/**
 * A runnable that delegates calls to another runnable with a set of kwargs.
 */
export class RunnableBinding extends Runnable {
    static lc_name() {
        return "RunnableBinding";
    }
    constructor(fields) {
        super(fields);
        Object.defineProperty(this, "lc_namespace", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ["langchain", "schema", "runnable"]
        });
        Object.defineProperty(this, "lc_serializable", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "bound", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "kwargs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.bound = fields.bound;
        this.kwargs = fields.kwargs;
    }
    bind(kwargs) {
        return new RunnableBinding({
            bound: this.bound,
            kwargs: { ...this.kwargs, ...kwargs },
        });
    }
    async invoke(input, options) {
        return this.bound.invoke(input, { ...options, ...this.kwargs });
    }
    async batch(inputs, options, batchOptions) {
        const mergedOptions = Array.isArray(options)
            ? options.map((individualOption) => ({
                ...individualOption,
                ...this.kwargs,
            }))
            : { ...options, ...this.kwargs };
        return this.bound.batch(inputs, mergedOptions, batchOptions);
    }
    async *_streamIterator(input, options) {
        yield* this.bound._streamIterator(input, { ...options, ...this.kwargs });
    }
    async stream(input, options) {
        return this.bound.stream(input, { ...options, ...this.kwargs });
    }
}
/**
 * A runnable that routes to a set of runnables based on Input['key'].
 * Returns the output of the selected runnable.
 */
export class RouterRunnable extends Runnable {
    static lc_name() {
        return "RouterRunnable";
    }
    constructor(fields) {
        super(fields);
        Object.defineProperty(this, "lc_namespace", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ["langchain", "schema", "runnable"]
        });
        Object.defineProperty(this, "lc_serializable", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "runnables", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.runnables = fields.runnables;
    }
    async invoke(input, options) {
        const { key, input: actualInput } = input;
        const runnable = this.runnables[key];
        if (runnable === undefined) {
            throw new Error(`No runnable associated with key "${key}".`);
        }
        return runnable.invoke(actualInput, options);
    }
    async batch(inputs, options, batchOptions) {
        const keys = inputs.map((input) => input.key);
        const actualInputs = inputs.map((input) => input.input);
        const missingKey = keys.find((key) => this.runnables[key] === undefined);
        if (missingKey !== undefined) {
            throw new Error(`One or more keys do not have a corresponding runnable.`);
        }
        const runnables = keys.map((key) => this.runnables[key]);
        const optionsList = this._getOptionsList(options ?? {}, inputs.length);
        const batchSize = batchOptions?.maxConcurrency && batchOptions.maxConcurrency > 0
            ? batchOptions?.maxConcurrency
            : inputs.length;
        const batchResults = [];
        for (let i = 0; i < actualInputs.length; i += batchSize) {
            const batchPromises = actualInputs
                .slice(i, i + batchSize)
                .map((actualInput, i) => runnables[i].invoke(actualInput, optionsList[i]));
            const batchResult = await Promise.all(batchPromises);
            batchResults.push(batchResult);
        }
        return batchResults.flat();
    }
    async stream(input, options) {
        const { key, input: actualInput } = input;
        const runnable = this.runnables[key];
        if (runnable === undefined) {
            throw new Error(`No runnable associated with key "${key}".`);
        }
        return runnable.stream(actualInput, options);
    }
}
/**
 * A Runnable that can fallback to other Runnables if it fails.
 */
export class RunnableWithFallbacks extends Runnable {
    static lc_name() {
        return "RunnableWithFallbacks";
    }
    constructor(fields) {
        super(fields);
        Object.defineProperty(this, "lc_namespace", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ["langchain", "schema", "runnable"]
        });
        Object.defineProperty(this, "lc_serializable", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "runnable", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "fallbacks", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.runnable = fields.runnable;
        this.fallbacks = fields.fallbacks;
    }
    *runnables() {
        yield this.runnable;
        for (const fallback of this.fallbacks) {
            yield fallback;
        }
    }
    async invoke(input, options) {
        const callbackManager_ = await CallbackManager.configure(options?.callbacks, undefined, options?.tags, undefined, options?.metadata);
        const runManager = await callbackManager_?.handleChainStart(this.toJSON(), _coerceToDict(input, "input"));
        let firstError;
        for (const runnable of this.runnables()) {
            try {
                const output = await runnable.invoke(input, this._patchConfig(options, runManager?.getChild()));
                await runManager?.handleChainEnd(_coerceToDict(output, "output"));
                return output;
            }
            catch (e) {
                if (firstError === undefined) {
                    firstError = e;
                }
            }
        }
        if (firstError === undefined) {
            throw new Error("No error stored at end of fallback.");
        }
        await runManager?.handleChainError(firstError);
        throw firstError;
    }
    async batch(inputs, options, batchOptions) {
        const configList = this._getOptionsList(options ?? {}, inputs.length);
        const callbackManagers = await Promise.all(configList.map((config) => CallbackManager.configure(config?.callbacks, undefined, config?.tags, undefined, config?.metadata)));
        const runManagers = await Promise.all(callbackManagers.map((callbackManager, i) => callbackManager?.handleChainStart(this.toJSON(), _coerceToDict(inputs[i], "input"))));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let firstError;
        for (const runnable of this.runnables()) {
            try {
                const outputs = await runnable.batch(inputs, runManagers.map((runManager, j) => this._patchConfig(configList[j], runManager?.getChild())), batchOptions);
                await Promise.all(runManagers.map((runManager, i) => runManager?.handleChainEnd(_coerceToDict(outputs[i], "output"))));
                return outputs;
            }
            catch (e) {
                if (firstError === undefined) {
                    firstError = e;
                }
            }
        }
        if (!firstError) {
            throw new Error("No error stored at end of fallbacks.");
        }
        await Promise.all(runManagers.map((runManager) => runManager?.handleChainError(firstError)));
        throw firstError;
    }
}
function _coerceToRunnable(coerceable) {
    if (typeof coerceable === "function") {
        return new RunnableLambda({ func: coerceable });
    }
    else if (Runnable.isRunnable(coerceable)) {
        return coerceable;
    }
    else if (!Array.isArray(coerceable) && typeof coerceable === "object") {
        const runnables = {};
        for (const [key, value] of Object.entries(coerceable)) {
            runnables[key] = _coerceToRunnable(value);
        }
        return new RunnableMap({ steps: runnables });
    }
    else {
        throw new Error(`Expected a Runnable, function or object.\nInstead got an unsupported type.`);
    }
}
