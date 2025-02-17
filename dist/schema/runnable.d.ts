import { BaseCallbackConfig, CallbackManager, CallbackManagerForChainRun } from "../callbacks/manager.js";
import { Serializable } from "../load/serializable.js";
import { IterableReadableStream } from "../util/stream.js";
export type RunnableConfig = BaseCallbackConfig;
export type RunnableFunc<RunInput, RunOutput> = (input: RunInput) => RunOutput | Promise<RunOutput>;
export type RunnableLike<RunInput = any, RunOutput = any> = Runnable<RunInput, RunOutput> | RunnableFunc<RunInput, RunOutput> | {
    [key: string]: RunnableLike<RunInput, RunOutput>;
};
/**
 * A Runnable is a generic unit of work that can be invoked, batched, streamed, and/or
 * transformed.
 */
export declare abstract class Runnable<RunInput = any, RunOutput = any, CallOptions extends RunnableConfig = RunnableConfig> extends Serializable {
    protected lc_runnable: boolean;
    abstract invoke(input: RunInput, options?: Partial<CallOptions>): Promise<RunOutput>;
    /**
     * Bind arguments to a Runnable, returning a new Runnable.
     * @param kwargs
     * @returns A new RunnableBinding that, when invoked, will apply the bound args.
     */
    bind(kwargs: Partial<CallOptions>): RunnableBinding<RunInput, RunOutput, CallOptions>;
    /**
     * Create a new runnable from the current one that will try invoking
     * other passed fallback runnables if the initial invocation fails.
     * @param fields.fallbacks Other runnables to call if the runnable errors.
     * @returns A new RunnableWithFallbacks.
     */
    withFallbacks(fields: {
        fallbacks: Runnable<RunInput, RunOutput>[];
    }): RunnableWithFallbacks<RunInput, RunOutput>;
    protected _getOptionsList(options: Partial<CallOptions> | Partial<CallOptions>[], length?: number): Partial<CallOptions>[];
    /**
     * Default implementation of batch, which calls invoke N times.
     * Subclasses should override this method if they can batch more efficiently.
     * @param inputs Array of inputs to each batch call.
     * @param options Either a single call options object to apply to each batch call or an array for each call.
     * @param batchOptions.maxConcurrency Maximum number of calls to run at once.
     * @returns An array of RunOutputs
     */
    batch(inputs: RunInput[], options?: Partial<CallOptions> | Partial<CallOptions>[], batchOptions?: {
        maxConcurrency?: number;
    }): Promise<RunOutput[]>;
    /**
     * Default streaming implementation.
     * Subclasses should override this method if they support streaming output.
     * @param input
     * @param options
     */
    _streamIterator(input: RunInput, options?: Partial<CallOptions>): AsyncGenerator<RunOutput>;
    /**
     * Stream output in chunks.
     * @param input
     * @param options
     * @returns A readable stream that is also an iterable.
     */
    stream(input: RunInput, options?: Partial<CallOptions>): Promise<IterableReadableStream<RunOutput>>;
    protected _separateRunnableConfigFromCallOptions(options?: Partial<CallOptions>): [RunnableConfig, Omit<Partial<CallOptions>, keyof RunnableConfig>];
    protected _callWithConfig<T extends RunInput>(func: (input: T) => Promise<RunOutput>, input: T, options?: RunnableConfig & {
        runType?: string;
    }): Promise<RunOutput>;
    /**
     * Helper method to transform an Iterator of Input values into an Iterator of
     * Output values, with callbacks.
     * Use this to implement `stream()` or `transform()` in Runnable subclasses.
     */
    protected _transformStreamWithConfig<I extends RunInput, O extends RunOutput>(inputGenerator: AsyncGenerator<I>, transformer: (generator: AsyncGenerator<I>, runManager?: CallbackManagerForChainRun, options?: Partial<RunnableConfig>) => AsyncGenerator<O>, options?: RunnableConfig & {
        runType?: string;
    }): AsyncGenerator<O>;
    _patchConfig(config?: Partial<CallOptions>, callbackManager?: CallbackManager | undefined): Partial<CallOptions>;
    /**
     * Create a new runnable sequence that runs each individual runnable in series,
     * piping the output of one runnable into another runnable or runnable-like.
     * @param coerceable A runnable, function, or object whose values are functions or runnables.
     * @returns A new runnable sequence.
     */
    pipe<NewRunOutput>(coerceable: RunnableLike<RunOutput, NewRunOutput>): RunnableSequence<RunInput, NewRunOutput>;
    /**
     * Default implementation of transform, which buffers input and then calls stream.
     * Subclasses should override this method if they can start producing output while
     * input is still being generated.
     * @param generator
     * @param options
     */
    transform?(generator: AsyncGenerator<RunInput>, options: Partial<CallOptions>): AsyncGenerator<RunOutput>;
    static isRunnable(thing: any): thing is Runnable;
}
/**
 * A sequence of runnables, where the output of each is the input of the next.
 */
export declare class RunnableSequence<RunInput = any, RunOutput = any> extends Runnable<RunInput, RunOutput> {
    static lc_name(): string;
    protected first: Runnable<RunInput>;
    protected middle: Runnable[];
    protected last: Runnable<any, RunOutput>;
    lc_serializable: boolean;
    lc_namespace: string[];
    constructor(fields: {
        first: Runnable<RunInput>;
        middle?: Runnable[];
        last: Runnable<any, RunOutput>;
    });
    get steps(): Runnable<RunInput, any, BaseCallbackConfig>[];
    invoke(input: RunInput, options?: RunnableConfig): Promise<RunOutput>;
    batch(inputs: RunInput[], options?: RunnableConfig | RunnableConfig[], batchOptions?: {
        maxConcurrency?: number;
    }): Promise<RunOutput[]>;
    _streamIterator(input: RunInput, options?: RunnableConfig): AsyncGenerator<RunOutput>;
    pipe<NewRunOutput>(coerceable: RunnableLike<RunOutput, NewRunOutput>): RunnableSequence<RunInput, NewRunOutput>;
    static isRunnableSequence(thing: any): thing is RunnableSequence;
    static from<RunInput, RunOutput>([first, ...runnables]: [
        RunnableLike<RunInput>,
        ...RunnableLike[],
        RunnableLike<any, RunOutput>
    ]): RunnableSequence<RunInput, RunOutput>;
}
/**
 * A runnable that runs a mapping of runnables in parallel,
 * and returns a mapping of their outputs.
 */
export declare class RunnableMap<RunInput> extends Runnable<RunInput, Record<string, any>> {
    static lc_name(): string;
    lc_namespace: string[];
    lc_serializable: boolean;
    protected steps: Record<string, Runnable<RunInput>>;
    constructor(fields: {
        steps: Record<string, RunnableLike<RunInput>>;
    });
    invoke(input: RunInput, options?: Partial<BaseCallbackConfig>): Promise<Record<string, any>>;
}
/**
 * A runnable that runs a callable.
 */
export declare class RunnableLambda<RunInput, RunOutput> extends Runnable<RunInput, RunOutput> {
    static lc_name(): string;
    lc_namespace: string[];
    protected func: RunnableFunc<RunInput, RunOutput>;
    constructor(fields: {
        func: RunnableFunc<RunInput, RunOutput>;
    });
    invoke(input: RunInput, options?: Partial<BaseCallbackConfig>): Promise<RunOutput>;
}
/**
 * A runnable that passes through the input.
 */
export declare class RunnablePassthrough<RunInput> extends Runnable<RunInput, RunInput> {
    static lc_name(): string;
    lc_namespace: string[];
    lc_serializable: boolean;
    invoke(input: RunInput, options?: Partial<BaseCallbackConfig>): Promise<RunInput>;
}
/**
 * A runnable that delegates calls to another runnable with a set of kwargs.
 */
export declare class RunnableBinding<RunInput, RunOutput, CallOptions extends BaseCallbackConfig> extends Runnable<RunInput, RunOutput, CallOptions> {
    static lc_name(): string;
    lc_namespace: string[];
    lc_serializable: boolean;
    protected bound: Runnable<RunInput, RunOutput, CallOptions>;
    protected kwargs: Partial<CallOptions>;
    constructor(fields: {
        bound: Runnable<RunInput, RunOutput, CallOptions>;
        kwargs: Partial<CallOptions>;
    });
    bind(kwargs: Partial<CallOptions>): RunnableBinding<RunInput, RunOutput, CallOptions>;
    invoke(input: RunInput, options?: Partial<CallOptions>): Promise<RunOutput>;
    batch(inputs: RunInput[], options?: Partial<CallOptions> | Partial<CallOptions>[], batchOptions?: {
        maxConcurrency?: number;
    }): Promise<RunOutput[]>;
    _streamIterator(input: RunInput, options?: Partial<CallOptions> | undefined): AsyncGenerator<Awaited<RunOutput>, void, unknown>;
    stream(input: RunInput, options?: Partial<CallOptions> | undefined): Promise<IterableReadableStream<RunOutput>>;
}
export type RouterInput = {
    key: string;
    input: any;
};
/**
 * A runnable that routes to a set of runnables based on Input['key'].
 * Returns the output of the selected runnable.
 */
export declare class RouterRunnable<RunInput extends RouterInput, RunnableInput, RunOutput> extends Runnable<RunInput, RunOutput> {
    static lc_name(): string;
    lc_namespace: string[];
    lc_serializable: boolean;
    runnables: Record<string, Runnable<RunnableInput, RunOutput>>;
    constructor(fields: {
        runnables: Record<string, Runnable<RunnableInput, RunOutput>>;
    });
    invoke(input: RunInput, options?: Partial<BaseCallbackConfig>): Promise<RunOutput>;
    batch(inputs: RunInput[], options?: Partial<BaseCallbackConfig> | Partial<BaseCallbackConfig>[], batchOptions?: {
        maxConcurrency?: number;
    }): Promise<RunOutput[]>;
    stream(input: RunInput, options?: Partial<BaseCallbackConfig>): Promise<IterableReadableStream<RunOutput>>;
}
/**
 * A Runnable that can fallback to other Runnables if it fails.
 */
export declare class RunnableWithFallbacks<RunInput, RunOutput> extends Runnable<RunInput, RunOutput> {
    static lc_name(): string;
    lc_namespace: string[];
    lc_serializable: boolean;
    protected runnable: Runnable<RunInput, RunOutput>;
    protected fallbacks: Runnable<RunInput, RunOutput>[];
    constructor(fields: {
        runnable: Runnable<RunInput, RunOutput>;
        fallbacks: Runnable<RunInput, RunOutput>[];
    });
    runnables(): Generator<Runnable<RunInput, RunOutput, BaseCallbackConfig>, void, unknown>;
    invoke(input: RunInput, options?: Partial<BaseCallbackConfig>): Promise<RunOutput>;
    batch(inputs: RunInput[], options?: Partial<BaseCallbackConfig> | Partial<BaseCallbackConfig>[], batchOptions?: {
        maxConcurrency?: number;
    }): Promise<RunOutput[]>;
}
