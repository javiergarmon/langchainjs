import type { OpenAI as OpenAIClient } from "openai";
import { BaseMessage, BaseMessageLike, BasePromptValue, LLMResult } from "../schema/index.js";
import { BaseCallbackConfig, CallbackManager, Callbacks } from "../callbacks/manager.js";
import { AsyncCaller, AsyncCallerParams } from "../util/async_caller.js";
import { Runnable, RunnableConfig } from "../schema/runnable.js";
export type SerializedLLM = {
    _model: string;
    _type: string;
} & Record<string, any>;
export interface BaseLangChainParams {
    verbose?: boolean;
    callbacks?: Callbacks;
    tags?: string[];
    metadata?: Record<string, unknown>;
}
/**
 * Base class for language models, chains, tools.
 */
export declare abstract class BaseLangChain<RunInput, RunOutput, CallOptions extends RunnableConfig = RunnableConfig> extends Runnable<RunInput, RunOutput, CallOptions> implements BaseLangChainParams {
    /**
     * Whether to print out response text.
     */
    verbose: boolean;
    callbacks?: Callbacks;
    tags?: string[];
    metadata?: Record<string, unknown>;
    get lc_attributes(): {
        [key: string]: undefined;
    } | undefined;
    constructor(params: BaseLangChainParams);
}
/**
 * Base interface for language model parameters.
 * A subclass of {@link BaseLanguageModel} should have a constructor that
 * takes in a parameter that extends this interface.
 */
export interface BaseLanguageModelParams extends AsyncCallerParams, BaseLangChainParams {
    /**
     * @deprecated Use `callbacks` instead
     */
    callbackManager?: CallbackManager;
}
export interface BaseLanguageModelCallOptions extends BaseCallbackConfig {
    /**
     * Stop tokens to use for this call.
     * If not provided, the default stop tokens for the model will be used.
     */
    stop?: string[];
    /**
     * Timeout for this call in milliseconds.
     */
    timeout?: number;
    /**
     * Abort signal for this call.
     * If provided, the call will be aborted when the signal is aborted.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
     */
    signal?: AbortSignal;
}
export interface BaseFunctionCallOptions extends BaseLanguageModelCallOptions {
    function_call?: OpenAIClient.Chat.ChatCompletionCreateParams.FunctionCallOption;
    functions?: OpenAIClient.Chat.ChatCompletionCreateParams.Function[];
}
export type BaseLanguageModelInput = BasePromptValue | string | BaseMessageLike[];
/**
 * Base class for language models.
 */
export declare abstract class BaseLanguageModel<RunOutput = any, CallOptions extends BaseLanguageModelCallOptions = BaseLanguageModelCallOptions> extends BaseLangChain<BaseLanguageModelInput, RunOutput, CallOptions> implements BaseLanguageModelParams {
    CallOptions: CallOptions;
    /**
     * Keys that the language model accepts as call options.
     */
    get callKeys(): string[];
    /**
     * The async caller should be used by subclasses to make any async calls,
     * which will thus benefit from the concurrency and retry logic.
     */
    caller: AsyncCaller;
    constructor({ callbacks, callbackManager, ...params }: BaseLanguageModelParams);
    abstract generatePrompt(promptValues: BasePromptValue[], options?: string[] | CallOptions, callbacks?: Callbacks): Promise<LLMResult>;
    abstract predict(text: string, options?: string[] | CallOptions, callbacks?: Callbacks): Promise<string>;
    abstract predictMessages(messages: BaseMessage[], options?: string[] | CallOptions, callbacks?: Callbacks): Promise<BaseMessage>;
    abstract _modelType(): string;
    abstract _llmType(): string;
    private _encoding?;
    getNumTokens(text: string): Promise<number>;
    protected static _convertInputToPromptValue(input: BaseLanguageModelInput): BasePromptValue;
    /**
     * Get the identifying parameters of the LLM.
     */
    _identifyingParams(): Record<string, any>;
    /**
     * @deprecated
     * Return a json-like object representing this LLM.
     */
    serialize(): SerializedLLM;
    /**
     * @deprecated
     * Load an LLM from a json-like object describing it.
     */
    static deserialize(data: SerializedLLM): Promise<BaseLanguageModel>;
}
export { calculateMaxTokens } from "./count_tokens.js";
